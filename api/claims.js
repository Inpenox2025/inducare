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
  // GET: List claims (Filtered by role / company / hospital)
  // ══════════════════════════════════════════════════════════
  if (req.method === "GET") {
    try {
      let rows;
      if (user.role === "insurer") {
        if (!user.insurance_company_id) {
          return res.status(400).json({ error: "Insurer account not linked to an insurance company." });
        }
        rows = await sql`
          SELECT c.*, p.full_name as patient_name, h.name as hospital_name, 
                 ic.name as insurance_company_name, i.invoice_no, i.amount as invoice_amount
          FROM claims c
          JOIN patients p ON c.patient_id = p.id
          JOIN hospitals h ON c.hospital_id = h.id
          JOIN insurance_companies ic ON c.insurance_company_id = ic.id
          JOIN invoices i ON c.invoice_id = i.id
          WHERE c.insurance_company_id = ${parseInt(user.insurance_company_id)}
          ORDER BY c.created_at DESC
        `;
      } else if (user.role === "super_admin") {
        rows = await sql`
          SELECT c.*, p.full_name as patient_name, h.name as hospital_name, 
                 ic.name as insurance_company_name, i.invoice_no, i.amount as invoice_amount
          FROM claims c
          JOIN patients p ON c.patient_id = p.id
          JOIN hospitals h ON c.hospital_id = h.id
          JOIN insurance_companies ic ON c.insurance_company_id = ic.id
          JOIN invoices i ON c.invoice_id = i.id
          ORDER BY c.created_at DESC
        `;
      } else {
        // Hospital staff (admin, nurse, doctor)
        rows = await sql`
          SELECT c.*, p.full_name as patient_name, h.name as hospital_name, 
                 ic.name as insurance_company_name, i.invoice_no, i.amount as invoice_amount
          FROM claims c
          JOIN patients p ON c.patient_id = p.id
          JOIN hospitals h ON c.hospital_id = h.id
          JOIN insurance_companies ic ON c.insurance_company_id = ic.id
          JOIN invoices i ON c.invoice_id = i.id
          WHERE c.hospital_id = ${user.hospital_id}
          ORDER BY c.created_at DESC
        `;
      }

      return res.status(200).json({ success: true, claims: rows });
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch claims", details: error.message });
    }
  }

  // ══════════════════════════════════════════════════════════
  // POST: Create or Action (Approve / Reject) a claim
  // ══════════════════════════════════════════════════════════
  if (req.method === "POST") {
    try {
      // Approval / Rejection actions (restricted to admins)
      if (action === "approve" || action === "reject") {
        if (user.role !== "admin" && user.role !== "super_admin") {
          return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }

        const { claim_id, notes } = req.body;
        if (!claim_id) return res.status(400).json({ error: "Claim ID is required" });

        // Retrieve the claim
        const claimRows = await sql`SELECT * FROM claims WHERE id = ${parseInt(claim_id)}`;
        if (claimRows.length === 0) return res.status(404).json({ error: "Claim not found" });
        const claim = claimRows[0];

        // Hospital Admin check
        if (user.role === "admin" && claim.hospital_id !== user.hospital_id) {
          return res.status(403).json({ error: "Access denied. Tenancy check failed." });
        }

        if (claim.status !== "pending") {
          return res.status(400).json({ error: "Claim has already been processed." });
        }

        if (action === "approve") {
          // 1. Update claim status to approved
          const updatedClaim = await sql`
            UPDATE claims
            SET status = 'approved',
                status_notes = ${notes || null},
                updated_at = NOW()
            WHERE id = ${claim.id}
            RETURNING *
          `;

          // 2. Fetch the corresponding invoice
          const invoiceRows = await sql`SELECT * FROM invoices WHERE id = ${claim.invoice_id}`;
          if (invoiceRows.length === 0) return res.status(404).json({ error: "Invoice not found" });
          const invoice = invoiceRows[0];

          // 3. Generate receipt and log payment
          const receiptNo = `REC-CLM-${claim.id}-${Date.now().toString().slice(-4)}`;
          await sql`
            INSERT INTO receipts (receipt_no, invoice_id, amount_paid, payment_mode, payment_date)
            VALUES (${receiptNo}, ${invoice.id}, ${claim.amount}, 'insurer', CURRENT_DATE)
          `;

          // 4. Update invoice dues and status
          const newPaid = parseFloat(invoice.paid_amount || 0) + parseFloat(claim.amount);
          const newDue = Math.max(0, parseFloat(invoice.amount) - newPaid);
          const newStatus = newDue <= 0 ? "paid" : "partially_paid";

          await sql`
            UPDATE invoices
            SET paid_amount = ${newPaid},
                due_amount = ${newDue},
                status = ${newStatus},
                payment_mode = 'insurer',
                payment_date = CURRENT_DATE,
                updated_at = NOW()
            WHERE id = ${invoice.id}
          `;

          return res.status(200).json({ success: true, message: "Claim approved and invoice payment logged successfully.", claim: updatedClaim[0] });
        } else {
          // Reject claim
          const updatedClaim = await sql`
            UPDATE claims
            SET status = 'rejected',
                status_notes = ${notes || null},
                updated_at = NOW()
            WHERE id = ${claim.id}
            RETURNING *
          `;
          return res.status(200).json({ success: true, message: "Claim rejected.", claim: updatedClaim[0] });
        }
      }

      // Default POST action: Submit a new Claim
      const { invoice_id, amount, insurance_company_id, document_data } = req.body;
      if (!invoice_id || !amount || !insurance_company_id || !document_data) {
        return res.status(400).json({ error: "invoice_id, amount, insurance_company_id, and document_data are required" });
      }

      // If user is insurer, verify they belong to the claim's insurance company
      if (user.role === "insurer" && parseInt(user.insurance_company_id) !== parseInt(insurance_company_id)) {
        return res.status(403).json({ error: "Access denied. Insurer company mismatch." });
      }

      // Retrieve invoice to verify patient and hospital
      const invoiceRows = await sql`SELECT * FROM invoices WHERE id = ${parseInt(invoice_id)}`;
      if (invoiceRows.length === 0) return res.status(404).json({ error: "Invoice not found" });
      const invoice = invoiceRows[0];

      // Verify relationship mapping exists
      const mappingRows = await sql`
        SELECT 1 FROM hospital_insurers 
        WHERE hospital_id = ${invoice.hospital_id} AND insurance_company_id = ${parseInt(insurance_company_id)}
      `;
      if (mappingRows.length === 0) {
        return res.status(400).json({ error: "This insurance company is not associated with this hospital." });
      }

      // Hospital check for staff
      if (user.role !== "insurer" && user.role !== "super_admin" && invoice.hospital_id !== user.hospital_id) {
        return res.status(403).json({ error: "Access denied. Tenancy check failed." });
      }

      // Check if there is already a pending claim for this invoice
      const existingClaims = await sql`
        SELECT id FROM claims 
        WHERE invoice_id = ${invoice.id} AND status = 'pending'
      `;
      if (existingClaims.length > 0) {
        return res.status(400).json({ error: "There is already a pending claim for this invoice." });
      }

      // Insert new pending claim
      const rows = await sql`
        INSERT INTO claims (insurance_company_id, patient_id, hospital_id, invoice_id, amount, document_data, status)
        VALUES (${parseInt(insurance_company_id)}, ${invoice.patient_id}, ${invoice.hospital_id}, ${invoice.id}, ${parseFloat(amount)}, ${document_data}, 'pending')
        RETURNING *
      `;

      return res.status(201).json({ success: true, claim: rows[0] });
    } catch (error) {
      return res.status(500).json({ error: "Failed to submit claim", details: error.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
