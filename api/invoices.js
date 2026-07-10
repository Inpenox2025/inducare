const { getSQL } = require("../shared/db");
const jwt = require("jsonwebtoken");
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

const JWT_SECRET =
  process.env.JWT_SECRET || "hospital-management-jwt-secret-key-2026";

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
  } catch {
    return null;
  }
}

function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(v) {
  if (!v && v !== 0) return "—";
  return (
    "₹ " + parseFloat(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })
  );
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const action = req.query.action;
  const id = req.query.id;
  const sql = getSQL();

  // ══════ ACTION: Export PDF Receipt (GET) ══════
  if (action === "export-pdf") {
    const pdfId = req.query.id;
    if (!pdfId)
      return res.status(400).json({ error: "Invoice ID is required (?id=X)" });

    try {
      const rows = await sql`
        SELECT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile, p.address as patient_address,
               a.doctor_name, a.appointment_date, a.appointment_time
        FROM invoices i
        JOIN patients p ON i.patient_id = p.id
        LEFT JOIN appointments a ON i.appointment_id = a.id
        WHERE i.id = ${parseInt(pdfId)}
      `;

      if (rows.length === 0)
        return res.status(404).json({ error: "Invoice not found" });
      const invoice = rows[0];

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${invoice.patient_name} - Ozonature.pdf"`,
      );
      doc.pipe(res);

      // Hospital Header
      const logoPath = path.join(__dirname, "../assets/ozonature logo.jpg");
      if (fs.existsSync(logoPath)) {
        // Draw centered logo image
        doc.image(logoPath, {
          fit: [140, 50],
          align: "center",
        });
        doc.moveDown(0.4);
      } else {
        doc
          .fontSize(22)
          .font("Helvetica-Bold")
          .fillColor("#00bba8")
          .text("OZONATURE", { align: "center" });
      }
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#607377")
        .text("THE HOLISTIC CARE", {
          align: "center",
        });
      doc.fontSize(9).text("Contact: +91 8688932150", {
        align: "center",
      });
      doc.moveDown(0.8);

      // Decorative divider
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#00bba8")
        .lineWidth(2)
        .stroke();
      doc.moveDown(1.2);

      // Receipt Title
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#1e293b")
        .text("FEES RECEIPT / INVOICE", { align: "center" });
      doc.moveDown(1);

      // Metainfo columns (left and right)
      const currentY = doc.y;
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#334155");
      doc.text("PATIENT DETAILS", 50, currentY);
      doc.text("INVOICE METADATA", 320, currentY);

      doc
        .moveTo(50, doc.y + 2)
        .lineTo(250, doc.y + 2)
        .strokeColor("#cbd5e1")
        .lineWidth(1)
        .stroke();
      doc
        .moveTo(320, doc.y + 2)
        .lineTo(545, doc.y + 2)
        .strokeColor("#cbd5e1")
        .lineWidth(1)
        .stroke();
      doc.moveDown(0.6);

      // Patient details left column
      const detailsY = doc.y;
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#475569");
      doc
        .text("Name: ", 50, detailsY, { continued: true })
        .font("Helvetica")
        .fillColor("#0f172a")
        .text(invoice.patient_name);
      doc
        .font("Helvetica-Bold")
        .fillColor("#475569")
        .text("Mobile: ", { continued: true })
        .font("Helvetica")
        .fillColor("#0f172a")
        .text(invoice.patient_mobile || "—");
      doc
        .font("Helvetica-Bold")
        .fillColor("#475569")
        .text("Address: ", { continued: true })
        .font("Helvetica")
        .fillColor("#0f172a")
        .text(invoice.patient_address || "—");

      // Invoice details right column
      doc
        .text("Receipt No: ", 320, detailsY, { continued: true })
        .font("Helvetica")
        .fillColor("#0f172a")
        .text(invoice.invoice_no);
      doc
        .font("Helvetica-Bold")
        .fillColor("#475569")
        .text("Date Issued: ", { continued: true })
        .font("Helvetica")
        .fillColor("#0f172a")
        .text(formatDate(invoice.created_at));

      const pMode = invoice.payment_mode
        ? invoice.payment_mode.toUpperCase()
        : "PENDING";
      doc
        .font("Helvetica-Bold")
        .fillColor("#475569")
        .text("Payment Mode: ", { continued: true })
        .font("Helvetica")
        .fillColor("#0f172a")
        .text(pMode);

      const pDate = invoice.payment_date
        ? formatDate(invoice.payment_date)
        : "—";
      doc
        .font("Helvetica-Bold")
        .fillColor("#475569")
        .text("Payment Date: ", { continued: true })
        .font("Helvetica")
        .fillColor("#0f172a")
        .text(pDate);

      doc.moveDown(1.5);

      // Medical Details (if appointment exists)
      if (invoice.doctor_name) {
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#334155")
          .text("CLINICAL VISIT DETAILS", 50);
        doc
          .moveTo(50, doc.y + 2)
          .lineTo(545, doc.y + 2)
          .strokeColor("#cbd5e1")
          .lineWidth(1)
          .stroke();
        doc.moveDown(0.6);

        const clinicalY = doc.y;
        doc
          .font("Helvetica-Bold")
          .fillColor("#475569")
          .text("Consultant: ", 50, clinicalY, { continued: true })
          .font("Helvetica")
          .fillColor("#0f172a")
          .text(invoice.doctor_name);
        doc
          .font("Helvetica-Bold")
          .fillColor("#475569")
          .text("Visit Date: ", { continued: true })
          .font("Helvetica")
          .fillColor("#0f172a")
          .text(
            formatDate(invoice.appointment_date) +
              " " +
              (invoice.appointment_time || ""),
          );
        doc.moveDown(1.5);
      }

      // Invoice Items Table
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .fillColor("#334155")
        .text("BILLING DESCRIPTION & CHARGES", 50);
      doc
        .moveTo(50, doc.y + 2)
        .lineTo(545, doc.y + 2)
        .strokeColor("#cbd5e1")
        .lineWidth(1)
        .stroke();
      doc.moveDown(0.6);

      const tableHeaderY = doc.y;
      doc.font("Helvetica-Bold").fillColor("#475569");
      doc.text("Description", 50, tableHeaderY);
      doc.text("Amount", 450, tableHeaderY, { align: "right", width: 95 });
      doc.moveDown(0.4);
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#e2e8f0")
        .lineWidth(1)
        .stroke();
      doc.moveDown(0.6);

      const tableRowY = doc.y;
      doc.font("Helvetica").fillColor("#0f172a");
      doc.text(
        invoice.description || "Medical Consultation Fee",
        50,
        tableRowY,
        { width: 380 },
      );
      doc.text(formatCurrency(invoice.amount), 450, tableRowY, {
        align: "right",
        width: 95,
      });
      doc.moveDown(1.5);

      // Totals & Balances
      doc
        .moveTo(300, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#cbd5e1")
        .lineWidth(1)
        .stroke();
      doc.moveDown(0.6);

      const totalsY = doc.y;
      doc
        .font("Helvetica-Bold")
        .fillColor("#475569")
        .text("Total Amount:", 320, totalsY);
      doc
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text(formatCurrency(invoice.amount), 450, totalsY, {
          align: "right",
          width: 95,
        });

      doc
        .font("Helvetica-Bold")
        .fillColor("#475569")
        .text("Paid Amount:", 320, totalsY + 16);
      doc
        .font("Helvetica-Bold")
        .fillColor("#10b981")
        .text(formatCurrency(invoice.paid_amount), 450, totalsY + 16, {
          align: "right",
          width: 95,
        });

      doc
        .font("Helvetica-Bold")
        .fillColor("#475569")
        .text("Outstanding Due:", 320, totalsY + 32);
      const dueColor =
        parseFloat(invoice.due_amount) > 0 ? "#ef4444" : "#10b981";
      doc
        .font("Helvetica-Bold")
        .fillColor(dueColor)
        .text(formatCurrency(invoice.due_amount), 450, totalsY + 32, {
          align: "right",
          width: 95,
        });

      doc.moveDown(3);

      // Reconciliation Status Banner
      const bannerY = doc.y;
      doc.rect(50, bannerY, 495, 40).fill("#f8fafc");
      doc.font("Helvetica-Bold").fillColor("#334155");
      const bannerText =
        invoice.status === "paid"
          ? `STATUS: FULLY PAID VIA ${pMode} ON ${pDate}`
          : `STATUS: PAYMENT OUTSTANDING — DUE AMOUNT ${formatCurrency(invoice.due_amount)}`;
      doc.text(bannerText, 70, bannerY + 14, { align: "center", width: 455 });

      // Footer signature space
      doc.moveDown(3);
      const signatureY = doc.y;
      doc.fontSize(9).font("Helvetica").fillColor("#64748b");
      doc.text("Prepared By: Staff/Nurse Desk", 50, signatureY);
      doc.text("Authorized Signature", 400, signatureY, {
        align: "right",
        width: 145,
      });
      doc
        .moveTo(400, signatureY - 5)
        .lineTo(545, signatureY - 5)
        .strokeColor("#94a3b8")
        .lineWidth(1)
        .stroke();

      doc.moveDown(2);
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#94a3b8")
        .text("This is a verified digital payment receipt from Ozonature.", {
          align: "center",
        });
      doc.moveDown(0.3);
      doc
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .fillColor("#00bba8")
        .text("Developed & Maintained by inspenox (inspenox.in)", {
          align: "center",
        });

      doc.end();
    } catch (error) {
      console.error("PDF receipt export error:", error);
      return res.status(500).json({
        error: "Failed to generate PDF receipt",
        details: error.message,
      });
    }
  }

  // ══════ VERIFY TOKEN FOR GENERAL CRUD ══════
  else {
    const user = verifyToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // ══════ SINGLE INVOICE ACTIONS ══════
    if (id) {
      // GET: Fetch single invoice
      if (req.method === "GET") {
        try {
          const rows = await sql`
            SELECT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
            FROM invoices i
            JOIN patients p ON i.patient_id = p.id
            WHERE i.id = ${parseInt(id)}
          `;
          if (rows.length === 0)
            return res.status(404).json({ error: "Invoice not found" });
          return res.status(200).json({ success: true, invoice: rows[0] });
        } catch (error) {
          return res
            .status(500)
            .json({ error: "Failed to fetch invoice", details: error.message });
        }
      }

      // PUT: Update reconciliation (mark paid/unpaid and payment mode)
      if (req.method === "PUT") {
        try {
          const { status, payment_mode, paid_amount, amount } = req.body;

          let updatedStatus = status || "unpaid";
          const totalAmount = parseFloat(amount);
          const totalPaid = parseFloat(paid_amount) || 0;
          const dueAmount = totalAmount - totalPaid;

          if (dueAmount <= 0) {
            updatedStatus = "paid";
          } else if (totalPaid > 0) {
            updatedStatus = "partially_paid";
          } else {
            updatedStatus = "unpaid";
          }

          const paymentDateVal =
            updatedStatus === "paid" || updatedStatus === "partially_paid"
              ? new Date().toISOString().split("T")[0]
              : null;

          const rows = await sql`
            UPDATE invoices SET
              status = ${updatedStatus},
              payment_mode = ${payment_mode || null},
              paid_amount = ${totalPaid},
              due_amount = ${dueAmount},
              payment_date = ${paymentDateVal},
              updated_at = NOW()
            WHERE id = ${parseInt(id)}
            RETURNING *
          `;

          if (rows.length === 0)
            return res.status(404).json({ error: "Invoice not found" });

          // Update appointment status to completed if full payment reconciliated and it is linked to an appointment
          if (updatedStatus === "paid" && rows[0].appointment_id) {
            await sql`
              UPDATE appointments SET status = 'completed', updated_at = NOW() 
              WHERE id = ${rows[0].appointment_id}
            `;
          }

          return res.status(200).json({ success: true, invoice: rows[0] });
        } catch (error) {
          return res.status(500).json({
            error: "Failed to update invoice reconciliation",
            details: error.message,
          });
        }
      }

      // DELETE: Delete invoice (Admin Only)
      if (req.method === "DELETE") {
        if (user.role !== "admin") {
          return res
            .status(403)
            .json({ error: "Access denied. Administrators only." });
        }

        try {
          const rows =
            await sql`DELETE FROM invoices WHERE id = ${parseInt(id)} RETURNING id`;
          if (rows.length === 0)
            return res.status(404).json({ error: "Invoice not found" });
          return res
            .status(200)
            .json({ success: true, message: "Invoice deleted successfully" });
        } catch (error) {
          return res.status(500).json({
            error: "Failed to delete invoice",
            details: error.message,
          });
        }
      }

      return res.status(405).json({ error: "Method not allowed" });
    }

    // ══════ COLLECTION OPERATIONS ══════
    else {
      // POST: Create a manual invoice receipt
      if (req.method === "POST") {
        try {
          const {
            patient_id,
            appointment_id,
            description,
            amount,
            status,
            payment_mode,
          } = req.body;
          if (!patient_id || !description || !amount) {
            return res
              .status(400)
              .json({ error: "Patient, Description and Amount are required" });
          }

          const invNo = `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
          const totalAmt = parseFloat(amount);

          let paidAmt = 0.0;
          let isPaid = status || "unpaid";
          if (isPaid === "paid") {
            paidAmt = totalAmt;
          }
          const dueAmt = totalAmt - paidAmt;

          const patientIdInt = parseInt(patient_id);
          const appointmentIdInt = appointment_id
            ? parseInt(appointment_id)
            : null;
          const paymentDateVal =
            isPaid === "paid" ? new Date().toISOString().split("T")[0] : null;

          const rows = await sql`
            INSERT INTO invoices (
              invoice_no, patient_id, appointment_id, description, amount, paid_amount, due_amount, status, payment_mode, payment_date, created_by
            ) VALUES (
              ${invNo}, ${patientIdInt}, ${appointmentIdInt}, ${description}, ${totalAmt}, ${paidAmt}, ${dueAmt}, ${isPaid},
              ${payment_mode || null}, ${paymentDateVal}, ${user.id}
            ) RETURNING *
          `;

          return res.status(201).json({ success: true, invoice: rows[0] });
        } catch (error) {
          console.error("Create invoice error:", error);
          return res.status(500).json({
            error: "Failed to create invoice",
            details: error.message,
          });
        }
      }

      // GET: List invoices with query searches and pagination
      if (req.method === "GET") {
        try {
          const search = req.query.search || "";
          const status = req.query.status || "";
          const page = parseInt(req.query.page) || 1;
          const limit = parseInt(req.query.limit) || 15;
          const offset = (page - 1) * limit;

          let countRows, dataRows;

          if (search || status) {
            const searchPattern = `%${search}%`;

            if (search && status) {
              countRows = await sql`
                SELECT COUNT(*) as total FROM invoices i JOIN patients p ON i.patient_id = p.id
                WHERE i.status = ${status} AND (p.full_name ILIKE ${searchPattern} OR i.invoice_no ILIKE ${searchPattern})
              `;
              dataRows = await sql`
                SELECT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM invoices i JOIN patients p ON i.patient_id = p.id
                WHERE i.status = ${status} AND (p.full_name ILIKE ${searchPattern} OR i.invoice_no ILIKE ${searchPattern})
                ORDER BY i.created_at DESC LIMIT ${limit} OFFSET ${offset}
              `;
            } else if (search) {
              countRows = await sql`
                SELECT COUNT(*) as total FROM invoices i JOIN patients p ON i.patient_id = p.id
                WHERE p.full_name ILIKE ${searchPattern} OR i.invoice_no ILIKE ${searchPattern}
              `;
              dataRows = await sql`
                SELECT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM invoices i JOIN patients p ON i.patient_id = p.id
                WHERE p.full_name ILIKE ${searchPattern} OR i.invoice_no ILIKE ${searchPattern}
                ORDER BY i.created_at DESC LIMIT ${limit} OFFSET ${offset}
              `;
            } else {
              countRows = await sql`
                SELECT COUNT(*) as total FROM invoices WHERE status = ${status}
              `;
              dataRows = await sql`
                SELECT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM invoices i JOIN patients p ON i.patient_id = p.id
                WHERE i.status = ${status}
                ORDER BY i.created_at DESC LIMIT ${limit} OFFSET ${offset}
              `;
            }
          } else {
            countRows = await sql`SELECT COUNT(*) as total FROM invoices`;
            dataRows = await sql`
              SELECT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
              FROM invoices i JOIN patients p ON i.patient_id = p.id
              ORDER BY i.created_at DESC LIMIT ${limit} OFFSET ${offset}
            `;
          }

          const total = parseInt(countRows[0].total);
          const totalPages = Math.ceil(total / limit);

          return res.status(200).json({
            success: true,
            invoices: dataRows,
            pagination: { page, limit, total, totalPages },
          });
        } catch (error) {
          console.error("List invoices error:", error);
          return res.status(500).json({
            error: "Failed to fetch invoices",
            details: error.message,
          });
        }
      }
    }
  }
};
