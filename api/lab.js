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
  const action = req.query.action || "tests";
  const targetHospitalId = user.role === "super_admin" ? (req.query.hospital_id ? parseInt(req.query.hospital_id) : null) : user.hospital_id;

  try {
    // ═════════════════════════════════════════════════════════════════════
    // ACTION: TESTS (Lab Test Catalog)
    // ═════════════════════════════════════════════════════════════════════
    if (action === "tests") {
      if (req.method === "GET") {
        const id = req.query.id;
        const q = req.query.q ? req.query.q.trim() : null;

        if (id) {
          const rows = await sql`
            SELECT * FROM lab_tests 
            WHERE id = ${id} ${targetHospitalId !== null ? sql`AND hospital_id = ${targetHospitalId}` : sql``}
          `;
          if (rows.length === 0) return res.status(404).json({ error: "Lab test not found" });
          return res.status(200).json({ success: true, test: rows[0] });
        }

        if (q) {
          const pattern = `%${q}%`;
          const rows = targetHospitalId !== null
            ? await sql`
                SELECT * FROM lab_tests 
                WHERE hospital_id = ${targetHospitalId}
                AND (test_name ILIKE ${pattern} OR test_code ILIKE ${pattern} OR category ILIKE ${pattern})
                ORDER BY test_name ASC
              `
            : await sql`
                SELECT * FROM lab_tests 
                WHERE (test_name ILIKE ${pattern} OR test_code ILIKE ${pattern} OR category ILIKE ${pattern})
                ORDER BY test_name ASC
              `;
          return res.status(200).json({ success: true, tests: rows });
        }

        const rows = targetHospitalId !== null
          ? await sql`SELECT * FROM lab_tests WHERE hospital_id = ${targetHospitalId} ORDER BY test_name ASC`
          : await sql`SELECT * FROM lab_tests ORDER BY test_name ASC`;

        return res.status(200).json({ success: true, tests: rows });
      }

      if (req.method === "POST") {
        const { test_code, test_name, category, price, normal_range, sample_type, description } = req.body;
        if (!test_name) {
          return res.status(400).json({ error: "Test name is required" });
        }

        const hostId = targetHospitalId || user.hospital_id || 1;
        const testPrice = parseFloat(price) || 0.00;
        const code = test_code ? test_code.trim() : `LAB-${Math.floor(1000 + Math.random() * 9000)}`;

        const rows = await sql`
          INSERT INTO lab_tests (
            test_code, test_name, category, price, normal_range, sample_type, description, hospital_id
          ) VALUES (
            ${code}, ${test_name.trim()}, ${category ? category.trim() : "Pathology"}, ${testPrice},
            ${normal_range ? normal_range.trim() : null}, ${sample_type ? sample_type.trim() : "Blood"},
            ${description ? description.trim() : null}, ${hostId}
          )
          RETURNING *
        `;
        return res.status(201).json({ success: true, test: rows[0] });
      }

      if (req.method === "PUT") {
        const id = req.query.id || req.body.id;
        if (!id) return res.status(400).json({ error: "Test ID is required" });

        const { test_code, test_name, category, price, normal_range, sample_type, description } = req.body;
        if (!test_name) return res.status(400).json({ error: "Test name is required" });

        const testPrice = parseFloat(price) || 0.00;

        const rows = await sql`
          UPDATE lab_tests SET
            test_code = ${test_code ? test_code.trim() : null},
            test_name = ${test_name.trim()},
            category = ${category ? category.trim() : "Pathology"},
            price = ${testPrice},
            normal_range = ${normal_range ? normal_range.trim() : null},
            sample_type = ${sample_type ? sample_type.trim() : "Blood"},
            description = ${description ? description.trim() : null},
            updated_at = NOW()
          WHERE id = ${id} ${targetHospitalId !== null ? sql`AND hospital_id = ${targetHospitalId}` : sql``}
          RETURNING *
        `;
        if (rows.length === 0) return res.status(404).json({ error: "Lab test not found or update unauthorized" });
        return res.status(200).json({ success: true, test: rows[0] });
      }

      if (req.method === "DELETE") {
        const id = req.query.id;
        if (!id) return res.status(400).json({ error: "Test ID is required" });

        await sql`
          DELETE FROM lab_tests 
          WHERE id = ${id} ${targetHospitalId !== null ? sql`AND hospital_id = ${targetHospitalId}` : sql``}
        `;
        return res.status(200).json({ success: true, message: "Lab test removed successfully" });
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // ACTION: INVOICES (Lab Billing & Orders)
    // ═════════════════════════════════════════════════════════════════════
    else if (action === "invoices") {
      if (req.method === "GET") {
        const id = req.query.id;
        if (id) {
          const invRows = await sql`
            SELECT li.*, p.full_name as patient_name, p.mobile_no as patient_phone, d.name as doctor_name, u.username as created_by_username
            FROM lab_invoices li
            LEFT JOIN patients p ON li.patient_id = p.id
            LEFT JOIN doctors d ON li.doctor_id = d.id
            LEFT JOIN users u ON li.created_by = u.id
            WHERE li.id = ${id} ${targetHospitalId !== null ? sql`AND li.hospital_id = ${targetHospitalId}` : sql``}
          `;
          if (invRows.length === 0) return res.status(404).json({ error: "Lab invoice not found" });

          const items = await sql`
            SELECT lii.*, lt.test_code, lt.normal_range, lt.sample_type
            FROM lab_invoice_items lii
            LEFT JOIN lab_tests lt ON lii.lab_test_id = lt.id
            WHERE lii.lab_invoice_id = ${id}
          `;

          const receipts = await sql`
            SELECT * FROM lab_receipts WHERE lab_invoice_id = ${id} ORDER BY created_at DESC
          `;

          const reports = await sql`
            SELECT * FROM lab_reports WHERE lab_invoice_id = ${id} ORDER BY created_at ASC
          `;

          return res.status(200).json({ success: true, invoice: invRows[0], items, receipts, reports });
        }

        const rows = targetHospitalId !== null
          ? await sql`
              SELECT li.*, p.full_name as patient_name, p.mobile_no as patient_phone, d.name as doctor_name
              FROM lab_invoices li
              LEFT JOIN patients p ON li.patient_id = p.id
              LEFT JOIN doctors d ON li.doctor_id = d.id
              WHERE li.hospital_id = ${targetHospitalId}
              ORDER BY li.created_at DESC
            `
          : await sql`
              SELECT li.*, p.full_name as patient_name, p.mobile_no as patient_phone, d.name as doctor_name
              FROM lab_invoices li
              LEFT JOIN patients p ON li.patient_id = p.id
              LEFT JOIN doctors d ON li.doctor_id = d.id
              ORDER BY li.created_at DESC
            `;

        return res.status(200).json({ success: true, invoices: rows });
      }

      if (req.method === "POST") {
        const { patient_id, doctor_id, description, tests, discount_amount, tax_amount, paid_amount, payment_mode } = req.body;
        if (!patient_id || !tests || !Array.isArray(tests) || tests.length === 0) {
          return res.status(400).json({ error: "Patient and at least one lab test item are required" });
        }

        const hostId = targetHospitalId || user.hospital_id || 1;
        let totalAmt = 0.00;

        // Process lab tests total
        const processedTests = [];
        for (const t of tests) {
          const testPrice = parseFloat(t.price) || 0.00;
          totalAmt += testPrice;
          processedTests.push({
            lab_test_id: t.lab_test_id ? parseInt(t.lab_test_id) : null,
            test_name: t.test_name ? t.test_name.trim() : "Lab Test",
            price: testPrice,
            normal_range: t.normal_range || ""
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

        const invNo = `LAB-INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

        const invRows = await sql`
          INSERT INTO lab_invoices (
            invoice_no, patient_id, doctor_id, description, total_amount, discount_amount, tax_amount,
            net_amount, paid_amount, due_amount, status, payment_mode, hospital_id, created_by
          ) VALUES (
            ${invNo}, ${parseInt(patient_id)}, ${doctor_id ? parseInt(doctor_id) : null}, ${description ? description.trim() : "Lab Test Order"},
            ${totalAmt}, ${discAmt}, ${taxAmt}, ${netAmt}, ${initialPaid}, ${dueAmt}, ${status}, ${payment_mode || "cash"},
            ${hostId}, ${user.id}
          )
          RETURNING *
        `;

        const invoice = invRows[0];

        // Insert line items & lab reports records for test result entry
        for (const item of processedTests) {
          await sql`
            INSERT INTO lab_invoice_items (
              lab_invoice_id, lab_test_id, test_name, price
            ) VALUES (
              ${invoice.id}, ${item.lab_test_id}, ${item.test_name}, ${item.price}
            )
          `;

          await sql`
            INSERT INTO lab_reports (
              lab_invoice_id, patient_id, doctor_id, lab_test_id, test_name, normal_range, status, hospital_id
            ) VALUES (
              ${invoice.id}, ${parseInt(patient_id)}, ${doctor_id ? parseInt(doctor_id) : null}, ${item.lab_test_id}, ${item.test_name}, ${item.normal_range}, 'pending', ${hostId}
            )
          `;
        }

        // Record initial payment receipt if paid > 0
        if (initialPaid > 0) {
          const rctNo = `LAB-RCT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
          await sql`
            INSERT INTO lab_receipts (
              receipt_no, lab_invoice_id, amount_paid, payment_mode, payment_date, hospital_id
            ) VALUES (
              ${rctNo}, ${invoice.id}, ${initialPaid}, ${payment_mode || "cash"}, CURRENT_DATE, ${hostId}
            )
          `;
        }

        return res.status(201).json({ success: true, invoice });
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // ACTION: RECEIPTS (Lab Payment Receipts)
    // ═════════════════════════════════════════════════════════════════════
    else if (action === "receipts") {
      if (req.method === "GET") {
        const rows = targetHospitalId !== null
          ? await sql`
              SELECT lr.*, li.invoice_no, li.patient_id, li.doctor_id, li.net_amount, li.due_amount,
                     p.full_name as patient_name, d.name as doctor_name
              FROM lab_receipts lr
              JOIN lab_invoices li ON lr.lab_invoice_id = li.id
              LEFT JOIN patients p ON li.patient_id = p.id
              LEFT JOIN doctors d ON li.doctor_id = d.id
              WHERE lr.hospital_id = ${targetHospitalId}
              ORDER BY lr.created_at DESC
            `
          : await sql`
              SELECT lr.*, li.invoice_no, li.patient_id, li.doctor_id, li.net_amount, li.due_amount,
                     p.full_name as patient_name, d.name as doctor_name
              FROM lab_receipts lr
              JOIN lab_invoices li ON lr.lab_invoice_id = li.id
              LEFT JOIN patients p ON li.patient_id = p.id
              LEFT JOIN doctors d ON li.doctor_id = d.id
              ORDER BY lr.created_at DESC
            `;
        return res.status(200).json({ success: true, receipts: rows });
      }

      if (req.method === "POST") {
        const { lab_invoice_id, amount_paid, payment_mode, payment_date } = req.body;
        if (!lab_invoice_id || !amount_paid || parseFloat(amount_paid) <= 0) {
          return res.status(400).json({ error: "Lab invoice ID and valid payment amount are required" });
        }

        const invRows = await sql`SELECT * FROM lab_invoices WHERE id = ${lab_invoice_id}`;
        if (invRows.length === 0) return res.status(404).json({ error: "Lab invoice not found" });

        const inv = invRows[0];
        const payVal = parseFloat(amount_paid);
        const hostId = targetHospitalId || user.hospital_id || 1;

        const rctNo = `LAB-RCT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
        const rctRows = await sql`
          INSERT INTO lab_receipts (
            receipt_no, lab_invoice_id, amount_paid, payment_mode, payment_date, hospital_id
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
          UPDATE lab_invoices SET
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
    // ACTION: REPORTS (Lab Patient Test Result Reports)
    // ═════════════════════════════════════════════════════════════════════
    else if (action === "reports") {
      if (req.method === "GET") {
        const invId = req.query.invoice_id;
        const patId = req.query.patient_id;

        let query = targetHospitalId !== null
          ? sql`
              SELECT lr.*, p.full_name as patient_name, d.name as doctor_name, li.invoice_no
              FROM lab_reports lr
              LEFT JOIN patients p ON lr.patient_id = p.id
              LEFT JOIN doctors d ON lr.doctor_id = d.id
              LEFT JOIN lab_invoices li ON lr.lab_invoice_id = li.id
              WHERE lr.hospital_id = ${targetHospitalId}
            `
          : sql`
              SELECT lr.*, p.full_name as patient_name, d.name as doctor_name, li.invoice_no
              FROM lab_reports lr
              LEFT JOIN patients p ON lr.patient_id = p.id
              LEFT JOIN doctors d ON lr.doctor_id = d.id
              LEFT JOIN lab_invoices li ON lr.lab_invoice_id = li.id
              WHERE 1=1
            `;

        if (invId) {
          const rows = await sql`
            SELECT lr.*, p.full_name as patient_name, d.name as doctor_name, li.invoice_no
            FROM lab_reports lr
            LEFT JOIN patients p ON lr.patient_id = p.id
            LEFT JOIN doctors d ON lr.doctor_id = d.id
            LEFT JOIN lab_invoices li ON lr.lab_invoice_id = li.id
            WHERE lr.lab_invoice_id = ${invId}
            ORDER BY lr.created_at ASC
          `;
          return res.status(200).json({ success: true, reports: rows });
        }

        if (patId) {
          const rows = await sql`
            SELECT lr.*, p.full_name as patient_name, d.name as doctor_name, li.invoice_no
            FROM lab_reports lr
            LEFT JOIN patients p ON lr.patient_id = p.id
            LEFT JOIN doctors d ON lr.doctor_id = d.id
            LEFT JOIN lab_invoices li ON lr.lab_invoice_id = li.id
            WHERE lr.patient_id = ${patId}
            ORDER BY lr.created_at DESC
          `;
          return res.status(200).json({ success: true, reports: rows });
        }

        const rows = targetHospitalId !== null
          ? await sql`
              SELECT lr.*, p.full_name as patient_name, d.name as doctor_name, li.invoice_no
              FROM lab_reports lr
              LEFT JOIN patients p ON lr.patient_id = p.id
              LEFT JOIN doctors d ON lr.doctor_id = d.id
              LEFT JOIN lab_invoices li ON lr.lab_invoice_id = li.id
              WHERE lr.hospital_id = ${targetHospitalId}
              ORDER BY lr.created_at DESC
            `
          : await sql`
              SELECT lr.*, p.full_name as patient_name, d.name as doctor_name, li.invoice_no
              FROM lab_reports lr
              LEFT JOIN patients p ON lr.patient_id = p.id
              LEFT JOIN doctors d ON lr.doctor_id = d.id
              LEFT JOIN lab_invoices li ON lr.lab_invoice_id = li.id
              ORDER BY lr.created_at DESC
            `;

        return res.status(200).json({ success: true, reports: rows });
      }

      if (req.method === "POST" || req.method === "PUT") {
        const { report_id, result_value, normal_range, notes, status } = req.body;
        const id = report_id || req.query.id;

        if (!id) return res.status(400).json({ error: "Report ID is required" });

        const rows = await sql`
          UPDATE lab_reports SET
            result_value = ${result_value !== undefined ? result_value.trim() : null},
            normal_range = ${normal_range !== undefined ? normal_range.trim() : null},
            notes = ${notes !== undefined ? notes.trim() : null},
            status = ${status || "completed"},
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;
        if (rows.length === 0) return res.status(404).json({ error: "Lab report record not found" });
        return res.status(200).json({ success: true, report: rows[0] });
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // ACTION: EXPORT PDF (Lab Bill / Invoice PDF & Test Report PDF)
    // ═════════════════════════════════════════════════════════════════════
    else if (action === "export-pdf") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "Lab invoice ID is required" });

      const invRows = await sql`
        SELECT li.*, p.full_name as patient_name, p.mobile_no as patient_phone,
               d.name as doctor_name, d.specialization as doctor_spec,
               h.name as hospital_name
        FROM lab_invoices li
        LEFT JOIN patients p ON li.patient_id = p.id
        LEFT JOIN doctors d ON li.doctor_id = d.id
        LEFT JOIN hospitals h ON li.hospital_id = h.id
        WHERE li.id = ${id}
      `;
      if (invRows.length === 0) return res.status(404).json({ error: "Lab invoice not found" });
      const inv = invRows[0];

      const items = await sql`
        SELECT * FROM lab_invoice_items WHERE lab_invoice_id = ${id}
      `;

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="Lab_Invoice_${inv.invoice_no}.pdf"`);
      doc.pipe(res);

      // Header
      doc.fontSize(20).font("Helvetica-Bold").fillColor("#0284c7").text(inv.hospital_name || "CARE HOSPITAL", 50, 45);
      doc.fontSize(10).font("Helvetica").fillColor("#64748b").text("LABORATORY DIAGNOSTICS BILL & RECEIPT", 50, 70);
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#0f172a").text(`LAB ORDER #: ${inv.invoice_no}`, 380, 45, { align: "right" });
      doc.fontSize(9).font("Helvetica").fillColor("#64748b").text(`Date: ${formatDate(inv.created_at)}`, 380, 65, { align: "right" });

      doc.moveTo(50, 95).lineTo(545, 95).strokeColor("#e2e8f0").lineWidth(1).stroke();

      // Patient & Doctor Box
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#0f172a").text("Patient Information:", 50, 110);
      doc.fontSize(9).font("Helvetica").fillColor("#334155").text(`Name: ${inv.patient_name || "—"}`, 50, 125);
      doc.text(`Mobile: ${inv.patient_phone || "—"}`, 50, 138);

      doc.fontSize(10).font("Helvetica-Bold").fillColor("#0f172a").text("Prescribed Doctor:", 320, 110);
      doc.fontSize(9).font("Helvetica").fillColor("#334155").text(`Dr. ${inv.doctor_name || "General Practitioner"}`, 320, 125);
      doc.text(`Specialization: ${inv.doctor_spec || "General Medicine"}`, 320, 138);

      // Items Table
      let y = 170;
      doc.rect(50, y, 495, 24).fill("#f0f9ff");
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#0369a1");
      doc.text("LAB DIAGNOSTIC TEST NAME", 60, y + 7);
      doc.text("PRICE", 440, y + 7, { width: 95, align: "right" });

      y += 28;
      doc.font("Helvetica").fillColor("#0f172a");

      for (const item of items) {
        doc.text(item.test_name, 60, y);
        doc.text(formatCurrency(item.price), 440, y, { width: 95, align: "right" });
        y += 20;
      }

      doc.moveTo(50, y + 5).lineTo(545, y + 5).strokeColor("#e2e8f0").stroke();
      y += 15;

      // Summary
      doc.fontSize(9).font("Helvetica").fillColor("#475569");
      doc.text("Total Charges:", 350, y, { width: 80, align: "right" });
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
    console.error(`[Lab Handler Error] Action ${action}:`, error);
    return res.status(500).json({ error: "Lab server request failed", details: error.message });
  }
};
