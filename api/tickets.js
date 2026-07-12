const { getSQL } = require("../shared/db");
const jwt = require("jsonwebtoken");

const JWT_SECRET =
  process.env.JWT_SECRET || "hospital-management-jwt-secret-key-2026";

function verifyUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = verifyUser(req);
  if (!user) {
    return res.status(401).json({ error: "Access denied. Valid token required." });
  }

  const sql = getSQL();
  const action = req.query.action;

  // ══════════════════════════════════════════════════════════
  // GET: List tickets or fetch ticket messages
  // ══════════════════════════════════════════════════════════
  if (req.method === "GET") {
    try {
      // Action: Fetch chat messages of a specific ticket
      if (action === "messages") {
        const ticketId = req.query.ticket_id;
        if (!ticketId) {
          return res.status(400).json({ error: "Ticket ID is required" });
        }

        // Fetch ticket detail to verify ownership
        const ticketRows = await sql`
          SELECT * FROM support_tickets WHERE id = ${parseInt(ticketId)}
        `;
        if (ticketRows.length === 0) {
          return res.status(404).json({ error: "Ticket not found" });
        }
        const ticket = ticketRows[0];

        // Access control: only superadmin or hospital admins of same hospital
        if (user.role !== "super_admin" && parseInt(ticket.hospital_id) !== parseInt(user.hospital_id)) {
          return res.status(403).json({ error: "Access denied to this support ticket." });
        }

        const messages = await sql`
          SELECT tm.*, u.username, u.role as sender_role
          FROM support_ticket_messages tm
          JOIN users u ON tm.sender_id = u.id
          WHERE tm.ticket_id = ${parseInt(ticketId)}
          ORDER BY tm.created_at ASC
        `;

        return res.status(200).json({ success: true, ticket, messages });
      }

      // Default: List support tickets
      let tickets;
      if (user.role === "super_admin") {
        // Superadmin gets cross-tenant view
        tickets = await sql`
          SELECT t.*, h.name as hospital_name
          FROM support_tickets t
          LEFT JOIN hospitals h ON t.hospital_id = h.id
          ORDER BY t.created_at DESC
        `;
      } else {
        // Hospital admin/staff gets their hospital's tickets
        if (!user.hospital_id) {
          return res.status(400).json({ error: "User account is not linked to any hospital." });
        }
        tickets = await sql`
          SELECT t.*
          FROM support_tickets t
          WHERE t.hospital_id = ${parseInt(user.hospital_id)}
          ORDER BY t.created_at DESC
        `;
      }

      return res.status(200).json({ success: true, tickets });
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch support tickets", details: error.message });
    }
  }

  // ══════════════════════════════════════════════════════════
  // POST: Create tickets, send messages, or resolve tickets
  // ══════════════════════════════════════════════════════════
  if (req.method === "POST") {
    try {
      // Action: Raise new ticket
      if (action === "create") {
        const { subject, description } = req.body;
        if (!subject) {
          return res.status(400).json({ error: "Subject is required" });
        }
        if (!user.hospital_id) {
          return res.status(400).json({ error: "Only hospital users can raise support tickets." });
        }

        // Insert ticket
        const ticketRows = await sql`
          INSERT INTO support_tickets (hospital_id, subject, description, created_by)
          VALUES (${parseInt(user.hospital_id)}, ${subject}, ${description || ""}, ${parseInt(user.id)})
          RETURNING id
        `;
        const ticketId = ticketRows[0].id;

        // Add initial message from user if description is provided
        if (description) {
          await sql`
            INSERT INTO support_ticket_messages (ticket_id, sender_id, message)
            VALUES (${parseInt(ticketId)}, ${parseInt(user.id)}, ${description})
          `;
        }

        return res.status(200).json({ success: true, ticket_id: ticketId });
      }

      // Action: Send support ticket message
      if (action === "message") {
        const { ticket_id, message } = req.body;
        if (!ticket_id || !message) {
          return res.status(400).json({ error: "Ticket ID and message body are required" });
        }

        // Verify ticket access
        const ticketRows = await sql`
          SELECT * FROM support_tickets WHERE id = ${parseInt(ticket_id)}
        `;
        if (ticketRows.length === 0) {
          return res.status(404).json({ error: "Ticket not found" });
        }
        const ticket = ticketRows[0];

        if (user.role !== "super_admin" && parseInt(ticket.hospital_id) !== parseInt(user.hospital_id)) {
          return res.status(403).json({ error: "Access denied to this ticket chat." });
        }

        // Send message
        await sql`
          INSERT INTO support_ticket_messages (ticket_id, sender_id, message)
          VALUES (${parseInt(ticket_id)}, ${parseInt(user.id)}, ${message})
        `;

        // Update ticket updated_at
        await sql`
          UPDATE support_tickets SET updated_at = NOW() WHERE id = ${parseInt(ticket_id)}
        `;

        return res.status(200).json({ success: true });
      }

      // Action: Resolve ticket (Superadmin only)
      if (action === "resolve") {
        const { ticket_id } = req.body;
        if (!ticket_id) {
          return res.status(400).json({ error: "Ticket ID is required" });
        }

        if (user.role !== "super_admin") {
          return res.status(403).json({ error: "Only Superadmin can resolve support tickets." });
        }

        await sql`
          UPDATE support_tickets 
          SET status = 'resolved', updated_at = NOW() 
          WHERE id = ${parseInt(ticket_id)}
        `;

        return res.status(200).json({ success: true });
      }

      // Action: Delete ticket (Superadmin only)
      if (action === "delete") {
        const { ticket_id } = req.body;
        if (!ticket_id) {
          return res.status(400).json({ error: "Ticket ID is required" });
        }

        if (user.role !== "super_admin") {
          return res.status(403).json({ error: "Only Superadmin can delete support tickets." });
        }

        await sql`
          DELETE FROM support_tickets 
          WHERE id = ${parseInt(ticket_id)}
        `;

        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: "Unknown action" });
    } catch (error) {
      return res.status(500).json({ error: "Action processing failed", details: error.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
