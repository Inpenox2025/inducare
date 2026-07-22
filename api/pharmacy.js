const { getSQL } = require("../shared/db");
const jwt = require("jsonwebtoken");
const PDFDocument = require("pdfkit");

const JWT_SECRET = process.env.JWT_SECRET || "hospital-management-jwt-secret-key-2026";

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
  return "₹ " + parseFloat(v).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized access" });
  }

  const sql = getSQL();
  const action = req.query.action || "medicines";
  const targetHospitalId = user.role === "super_admin" ? (req.query.hospital_id ? parseInt(req.query.hospital_id) : null) : user.hospital_id;

  try {
    // ═════════════════════════════════════════════════════════════════════
    // ACTION: MEDICINES (Inventory Management)
    // ═════════════════════════════════════════════════════════════════════
    if (action === "medicines") {
      if (req.method === "GET") {
        const id = req.query.id;
        const q = req.query.q ? req.query.q.trim() : null;
        const barcode = req.query.barcode ? req.query.barcode.trim() : null;

        if (id) {
          const rows = await sql`
            SELECT * FROM medicines 
            WHERE id = ${id} ${targetHospitalId !== null ? sql`AND hospital_id = ${targetHospitalId}` : sql``}
          `;
          if (rows.length === 0) return res.status(404).json({ error: "Medicine not found" });
          return res.status(200).json({ success: true, medicine: rows[0] });
        }

        if (barcode) {
          const rows = await sql`
            SELECT * FROM medicines 
            WHERE barcode = ${barcode} ${targetHospitalId !== null ? sql`AND hospital_id = ${targetHospitalId}` : sql``}
            LIMIT 1
          `;
          return res.status(200).json({ success: true, medicine: rows[0] || null });
        }

        if (q) {
          const pattern = `%${q}%`;
          const rows = targetHospitalId !== null
            ? await sql`
                SELECT * FROM medicines 
                WHERE hospital_id = ${targetHospitalId}
                AND (name ILIKE ${pattern} OR generic_name ILIKE ${pattern} OR barcode ILIKE ${pattern} OR category ILIKE ${pattern})
                ORDER BY name ASC
              `
            : await sql`
                SELECT * FROM medicines 
                WHERE (name ILIKE ${pattern} OR generic_name ILIKE ${pattern} OR barcode ILIKE ${pattern} OR category ILIKE ${pattern})
                ORDER BY name ASC
              `;
          return res.status(200).json({ success: true, medicines: rows });
        }

        const rows = targetHospitalId !== null
          ? await sql`SELECT * FROM medicines WHERE hospital_id = ${targetHospitalId} ORDER BY name ASC`
          : await sql`SELECT * FROM medicines ORDER BY name ASC`;

        return res.status(200).json({ success: true, medicines: rows });
      }

      if (req.method === "POST") {
        const { barcode, name, generic_name, category, manufacturer, unit_price, mrp, stock_quantity, reorder_level, expiry_date, rack_location } = req.body;
        if (!name) {
          return res.status(400).json({ error: "Medicine name is required" });
        }

        const hostId = targetHospitalId || user.hospital_id || 1;
        const uPrice = parseFloat(unit_price) || 0.00;
        const mrpVal = parseFloat(mrp) || uPrice;
        const stockQty = parseInt(stock_quantity) || 0;
        const reorderLvl = parseInt(reorder_level) || 10;

        const rows = await sql`
          INSERT INTO medicines (
            barcode, name, generic_name, category, manufacturer, unit_price, mrp, 
            stock_quantity, reorder_level, expiry_date, rack_location, hospital_id
          ) VALUES (
            ${barcode ? barcode.trim() : null}, ${name.trim()}, ${generic_name ? generic_name.trim() : null},
            ${category ? category.trim() : "General"}, ${manufacturer ? manufacturer.trim() : null},
            ${uPrice}, ${mrpVal}, ${stockQty}, ${reorderLvl},
            ${expiry_date || null}, ${rack_location ? rack_location.trim() : null}, ${hostId}
          )
          RETURNING *
        `;
        return res.status(201).json({ success: true, medicine: rows[0] });
      }

      if (req.method === "PUT") {
        const id = req.query.id || req.body.id;
        if (!id) return res.status(400).json({ error: "Medicine ID is required" });

        const { barcode, name, generic_name, category, manufacturer, unit_price, mrp, stock_quantity, reorder_level, expiry_date, rack_location } = req.body;
        if (!name) return res.status(400).json({ error: "Medicine name is required" });

        const uPrice = parseFloat(unit_price) || 0.00;
        const mrpVal = parseFloat(mrp) || uPrice;
        const stockQty = parseInt(stock_quantity) || 0;
        const reorderLvl = parseInt(reorder_level) || 10;

        const rows = await sql`
          UPDATE medicines SET
            barcode = ${barcode ? barcode.trim() : null},
            name = ${name.trim()},
            generic_name = ${generic_name ? generic_name.trim() : null},
            category = ${category ? category.trim() : "General"},
            manufacturer = ${manufacturer ? manufacturer.trim() : null},
            unit_price = ${uPrice},
            mrp = ${mrpVal},
            stock_quantity = ${stockQty},
            reorder_level = ${reorderLvl},
            expiry_date = ${expiry_date || null},
            rack_location = ${rack_location ? rack_location.trim() : null},
            updated_at = NOW()
          WHERE id = ${id} ${targetHospitalId !== null ? sql`AND hospital_id = ${targetHospitalId}` : sql``}
          RETURNING *
        `;
        if (rows.length === 0) return res.status(404).json({ error: "Medicine not found or update unauthorized" });
        return res.status(200).json({ success: true, medicine: rows[0] });
      }

      if (req.method === "DELETE") {
        const id = req.query.id;
        if (!id) return res.status(400).json({ error: "Medicine ID is required" });

        await sql`
          DELETE FROM medicines 
          WHERE id = ${id} ${targetHospitalId !== null ? sql`AND hospital_id = ${targetHospitalId}` : sql``}
        `;
        return res.status(200).json({ success: true, message: "Medicine removed successfully" });
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // ACTION: INVOICES (Pharmacy Billing)
    // ═════════════════════════════════════════════════════════════════════
    else if (action === "invoices") {
      if (req.method === "GET") {
        const id = req.query.id;
        if (id) {
          const invRows = await sql`
            SELECT pi.*, p.full_name as patient_name, p.mobile_no as patient_phone, d.name as doctor_name, u.username as created_by_username
            FROM pharmacy_invoices pi
            LEFT JOIN patients p ON pi.patient_id = p.id
            LEFT JOIN doctors d ON pi.doctor_id = d.id
            LEFT JOIN users u ON pi.created_by = u.id
            WHERE pi.id = ${id} ${targetHospitalId !== null ? sql`AND pi.hospital_id = ${targetHospitalId}` : sql``}
          `;
          if (invRows.length === 0) return res.status(404).json({ error: "Pharmacy invoice not found" });

          const items = await sql`
            SELECT pii.*, m.barcode, m.generic_name
            FROM pharmacy_invoice_items pii
            LEFT JOIN medicines m ON pii.medicine_id = m.id
            WHERE pii.pharmacy_invoice_id = ${id}
          `;

          const receipts = await sql`
            SELECT * FROM pharmacy_receipts WHERE pharmacy_invoice_id = ${id} ORDER BY created_at DESC
          `;

          return res.status(200).json({ success: true, invoice: invRows[0], items, receipts });
        }

        const rows = targetHospitalId !== null
          ? await sql`
              SELECT pi.*, p.full_name as patient_name, p.mobile_no as patient_phone, d.name as doctor_name
              FROM pharmacy_invoices pi
              LEFT JOIN patients p ON pi.patient_id = p.id
              LEFT JOIN doctors d ON pi.doctor_id = d.id
              WHERE pi.hospital_id = ${targetHospitalId}
              ORDER BY pi.created_at DESC
            `
          : await sql`
              SELECT pi.*, p.full_name as patient_name, p.mobile_no as patient_phone, d.name as doctor_name
              FROM pharmacy_invoices pi
              LEFT JOIN patients p ON pi.patient_id = p.id
              LEFT JOIN doctors d ON pi.doctor_id = d.id
              ORDER BY pi.created_at DESC
            `;

        return res.status(200).json({ success: true, invoices: rows });
      }

      if (req.method === "POST") {
        const { patient_id, doctor_id, description, items, discount_amount, tax_amount, paid_amount, payment_mode } = req.body;
        if (!patient_id || !items || !Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ error: "Patient and at least one medicine item are required" });
        }

        const hostId = targetHospitalId || user.hospital_id || 1;
        let totalAmt = 0.00;

        // Process line items total
        const processedItems = [];
        for (const item of items) {
          const qty = parseInt(item.quantity) || 1;
          const uPrice = parseFloat(item.unit_price) || 0.00;
          const tPrice = qty * uPrice;
          totalAmt += tPrice;
          processedItems.push({
            medicine_id: item.medicine_id ? parseInt(item.medicine_id) : null,
            medicine_name: item.medicine_name ? item.medicine_name.trim() : "Medicine",
            quantity: qty,
            unit_price: uPrice,
            total_price: tPrice
          });
        }

        const discAmt = parseFloat(discount_amount) || 0.00;
        const taxAmt = parseFloat(tax_amount) || 0.00;
        const netAmt = Math.max(0.00, totalAmt - discAmt + taxAmt);
        const initialPaid = parseFloat(paid_amount) || 0.00;
        const dueAmt = Math.max(0.00, netAmt - initialPaid);

        let status = "unpaid";
        if (dueAmt <= 0 && netAmt > 0) status = "paid";
        else if (initialPaid > 0) status = "partially_paid";

        const invNo = `PHR-INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

        const invRows = await sql`
          INSERT INTO pharmacy_invoices (
            invoice_no, patient_id, doctor_id, description, total_amount, discount_amount, tax_amount,
            net_amount, paid_amount, due_amount, status, payment_mode, hospital_id, created_by
          ) VALUES (
            ${invNo}, ${parseInt(patient_id)}, ${doctor_id ? parseInt(doctor_id) : null}, ${description ? description.trim() : "Pharmacy Prescription"},
            ${totalAmt}, ${discAmt}, ${taxAmt}, ${netAmt}, ${initialPaid}, ${dueAmt}, ${status}, ${payment_mode || "cash"},
            ${hostId}, ${user.id}
          )
          RETURNING *
        `;

        const invoice = invRows[0];

        // Insert items and reduce stock
        for (const item of processedItems) {
          await sql`
            INSERT INTO pharmacy_invoice_items (
              pharmacy_invoice_id, medicine_id, medicine_name, quantity, unit_price, total_price
            ) VALUES (
              ${invoice.id}, ${item.medicine_id}, ${item.medicine_name}, ${item.quantity}, ${item.unit_price}, ${item.total_price}
            )
          `;

          if (item.medicine_id) {
            await sql`
              UPDATE medicines 
              SET stock_quantity = GREATEST(0, stock_quantity - ${item.quantity}), updated_at = NOW()
              WHERE id = ${item.medicine_id}
            `;
          }
        }

        // Record initial payment receipt if paid > 0
        if (initialPaid > 0) {
          const rctNo = `PHR-RCT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
          await sql`
            INSERT INTO pharmacy_receipts (
              receipt_no, pharmacy_invoice_id, amount_paid, payment_mode, payment_date, hospital_id
            ) VALUES (
              ${rctNo}, ${invoice.id}, ${initialPaid}, ${payment_mode || "cash"}, CURRENT_DATE, ${hostId}
            )
          `;
        }

        return res.status(201).json({ success: true, invoice });
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // ACTION: RECEIPTS (Pharmacy Payment Receipts)
    // ═════════════════════════════════════════════════════════════════════
    else if (action === "receipts") {
      if (req.method === "GET") {
        const rows = targetHospitalId !== null
          ? await sql`
              SELECT pr.*, pi.invoice_no, pi.patient_id, pi.doctor_id, pi.net_amount, pi.due_amount,
                     p.full_name as patient_name, d.name as doctor_name
              FROM pharmacy_receipts pr
              JOIN pharmacy_invoices pi ON pr.pharmacy_invoice_id = pi.id
              LEFT JOIN patients p ON pi.patient_id = p.id
              LEFT JOIN doctors d ON pi.doctor_id = d.id
              WHERE pr.hospital_id = ${targetHospitalId}
              ORDER BY pr.created_at DESC
            `
          : await sql`
              SELECT pr.*, pi.invoice_no, pi.patient_id, pi.doctor_id, pi.net_amount, pi.due_amount,
                     p.full_name as patient_name, d.name as doctor_name
              FROM pharmacy_receipts pr
              JOIN pharmacy_invoices pi ON pr.pharmacy_invoice_id = pi.id
              LEFT JOIN patients p ON pi.patient_id = p.id
              LEFT JOIN doctors d ON pi.doctor_id = d.id
              ORDER BY pr.created_at DESC
            `;
        return res.status(200).json({ success: true, receipts: rows });
      }

      if (req.method === "POST") {
        const { pharmacy_invoice_id, amount_paid, payment_mode, payment_date } = req.body;
        if (!pharmacy_invoice_id || !amount_paid || parseFloat(amount_paid) <= 0) {
          return res.status(400).json({ error: "Invoice ID and valid payment amount are required" });
        }

        const invRows = await sql`SELECT * FROM pharmacy_invoices WHERE id = ${pharmacy_invoice_id}`;
        if (invRows.length === 0) return res.status(404).json({ error: "Pharmacy invoice not found" });

        const inv = invRows[0];
        const payVal = parseFloat(amount_paid);
        const hostId = targetHospitalId || user.hospital_id || 1;

        const rctNo = `PHR-RCT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
        const rctRows = await sql`
          INSERT INTO pharmacy_receipts (
            receipt_no, pharmacy_invoice_id, amount_paid, payment_mode, payment_date, hospital_id
          ) VALUES (
            ${rctNo}, ${inv.id}, ${payVal}, ${payment_mode || "cash"}, ${payment_date || new Date().toISOString().split("T")[0]}, ${hostId}
          )
          RETURNING *
        `;

        const newPaid = (parseFloat(inv.paid_amount) || 0.00) + payVal;
        const newDue = Math.max(0.00, (parseFloat(inv.net_amount) || 0.00) - newPaid);
        let newStatus = inv.status;
        if (newDue <= 0) newStatus = "paid";
        else if (newPaid > 0) newStatus = "partially_paid";

        await sql`
          UPDATE pharmacy_invoices SET
            paid_amount = ${newPaid},
            due_amount = ${newDue},
            status = ${newStatus},
            updated_at = NOW()
          WHERE id = ${inv.id}
        `;

        return res.status(201).json({ success: true, receipt: rctRows[0] });
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // ACTION: EXPORT PDF (Pharmacy Invoice PDF)
    // ═════════════════════════════════════════════════════════════════════
    else if (action === "export-pdf") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "Pharmacy invoice ID is required" });

      const invRows = await sql`
        SELECT pi.*, p.full_name as patient_name, p.mobile_no as patient_phone, p.address as patient_address,
               d.name as doctor_name, d.specialization as doctor_spec,
               h.name as hospital_name, h.logo_data as hospital_logo
        FROM pharmacy_invoices pi
        LEFT JOIN patients p ON pi.patient_id = p.id
        LEFT JOIN doctors d ON pi.doctor_id = d.id
        LEFT JOIN hospitals h ON pi.hospital_id = h.id
        WHERE pi.id = ${id}
      `;
      if (invRows.length === 0) return res.status(404).json({ error: "Invoice not found" });
      const inv = invRows[0];

      const items = await sql`
        SELECT * FROM pharmacy_invoice_items WHERE pharmacy_invoice_id = ${id}
      `;

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="Pharmacy_Invoice_${inv.invoice_no}.pdf"`);
      doc.pipe(res);

      // Header
      doc.fontSize(20).font("Helvetica-Bold").fillColor("#00bba8").text(inv.hospital_name || "CARE HOSPITAL", 50, 45);
      doc.fontSize(10).font("Helvetica").fillColor("#64748b").text("PHARMACY BILL & PRESCRIPTION RECEIPT", 50, 70);
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#0f172a").text(`INVOICE #: ${inv.invoice_no}`, 380, 45, { align: "right" });
      doc.fontSize(9).font("Helvetica").fillColor("#64748b").text(`Date: ${formatDate(inv.created_at)}`, 380, 65, { align: "right" });

      doc.moveTo(50, 95).lineTo(545, 95).strokeColor("#e2e8f0").lineWidth(1).stroke();

      // Patient & Doctor Box
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#0f172a").text("Patient Details:", 50, 110);
      doc.fontSize(9).font("Helvetica").fillColor("#334155").text(`Name: ${inv.patient_name || "—"}`, 50, 125);
      doc.text(`Phone: ${inv.patient_phone || "—"}`, 50, 138);

      doc.fontSize(10).font("Helvetica-Bold").fillColor("#0f172a").text("Prescribed Doctor:", 320, 110);
      doc.fontSize(9).font("Helvetica").fillColor("#334155").text(`Dr. ${inv.doctor_name || "General Prescriber"}`, 320, 125);
      doc.text(`Specialization: ${inv.doctor_spec || "General Practice"}`, 320, 138);

      // Items Table
      let y = 170;
      doc.rect(50, y, 495, 24).fill("#f8fafc");
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#475569");
      doc.text("ITEM / MEDICINE", 60, y + 7);
      doc.text("QTY", 280, y + 7, { width: 50, align: "center" });
      doc.text("UNIT PRICE", 350, y + 7, { width: 80, align: "right" });
      doc.text("TOTAL", 440, y + 7, { width: 95, align: "right" });

      y += 28;
      doc.font("Helvetica").fillColor("#0f172a");

      for (const item of items) {
        doc.text(item.medicine_name, 60, y);
        doc.text(item.quantity.toString(), 280, y, { width: 50, align: "center" });
        doc.text(formatCurrency(item.unit_price), 350, y, { width: 80, align: "right" });
        doc.text(formatCurrency(item.total_price), 440, y, { width: 95, align: "right" });
        y += 20;
      }

      doc.moveTo(50, y + 5).lineTo(545, y + 5).strokeColor("#e2e8f0").stroke();
      y += 15;

      // Summary
      doc.fontSize(9).font("Helvetica").fillColor("#475569");
      doc.text("Total Amount:", 350, y, { width: 80, align: "right" });
      doc.text(formatCurrency(inv.total_amount), 440, y, { width: 95, align: "right" });
      y += 15;

      if (parseFloat(inv.discount_amount) > 0) {
        doc.text("Discount:", 350, y, { width: 80, align: "right" });
        doc.text(`- ${formatCurrency(inv.discount_amount)}`, 440, y, { width: 95, align: "right" });
        y += 15;
      }

      doc.fontSize(10).font("Helvetica-Bold").fillColor("#0f172a");
      doc.text("Net Payable:", 350, y, { width: 80, align: "right" });
      doc.text(formatCurrency(inv.net_amount), 440, y, { width: 95, align: "right" });
      y += 18;

      doc.fontSize(9).font("Helvetica").fillColor("#16a34a");
      doc.text("Amount Paid:", 350, y, { width: 80, align: "right" });
      doc.text(formatCurrency(inv.paid_amount), 440, y, { width: 95, align: "right" });
      y += 15;

      doc.fontSize(9).font("Helvetica-Bold").fillColor("#dc2626");
      doc.text("Balance Due:", 350, y, { width: 80, align: "right" });
      doc.text(formatCurrency(inv.due_amount), 440, y, { width: 95, align: "right" });

      doc.end();
    }

    else {
      return res.status(404).json({ error: "Invalid action parameter" });
    }
  } catch (error) {
    console.error(`[Pharmacy Handler Error] Action ${action}:`, error);
    return res.status(500).json({ error: "Pharmacy server request failed", details: error.message });
  }
};
