const { getSQL } = require("../shared/db");
const jwt = require("jsonwebtoken");
const PDFDocument = require("pdfkit");

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

async function syncRoomInvoices(sql, targetHospitalId) {
  try {
    const activeAllocations =
      targetHospitalId !== null
        ? await sql`
        SELECT ra.*, r.price_per_day, r.room_no, r.room_type,
               h.gst_no, h.gst_percent, h.tax_name as hosp_tax_name
        FROM room_allocations ra
        JOIN rooms r ON ra.room_id = r.id
        LEFT JOIN hospitals h ON ra.hospital_id = h.id
        WHERE ra.status = 'active' AND ra.hospital_id = ${targetHospitalId}
      `
        : await sql`
        SELECT ra.*, r.price_per_day, r.room_no, r.room_type,
               h.gst_no, h.gst_percent, h.tax_name as hosp_tax_name
        FROM room_allocations ra
        JOIN rooms r ON ra.room_id = r.id
        LEFT JOIN hospitals h ON ra.hospital_id = h.id
        WHERE ra.status = 'active'
      `;

    for (const alloc of activeAllocations) {
      const now = new Date();
      const admit = new Date(alloc.admitted_at);
      const diffMs = now - admit;
      const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      const invRes =
        await sql`SELECT * FROM invoices WHERE allocation_id = ${alloc.id}`;
      if (invRes.length > 0) {
        const inv = invRes[0];

        // Query allocation services sum
        let servicesTotal = 0.00;
        try {
          const servicesRes = await sql`
            SELECT COALESCE(SUM(price * quantity), 0) as total 
            FROM allocation_services 
            WHERE allocation_id = ${alloc.id}
          `;
          servicesTotal = parseFloat(servicesRes[0].total) || 0.00;
        } catch (e) {
          console.error("syncRoomInvoices: allocation_services query error", e);
        }

        const pricePerDay = parseFloat(alloc.price_per_day) || 0.0;
        const newRawFee = (pricePerDay * days) + servicesTotal;

        let newTaxableAmt = newRawFee;
        let newGstAmt = 0.0;
        let newGstRate = parseFloat(inv.gst_rate) || 0.0;
        let newFinalTotalAmt = newRawFee;

        if (newGstRate > 0) {
          newGstAmt = Math.round(((newRawFee * newGstRate) / 100) * 100) / 100;
          newFinalTotalAmt = newRawFee + newGstAmt;
        }

        const paid = parseFloat(inv.paid_amount) || 0.0;
        const newDue = Math.max(0.0, newFinalTotalAmt - paid);
        let newStatus = inv.status;
        if (newDue <= 0) {
          newStatus = "paid";
        } else if (paid > 0) {
          newStatus = "partially_paid";
        } else {
          newStatus = "unpaid";
        }

        let newDesc = `Room Charge (Active: ${days} ${days === 1 ? "Day" : "Days"}) - Room ${alloc.room_no} (${alloc.room_type})`;
        if (servicesTotal > 0) {
          newDesc += ` + Patient Services (Treatment/Consumables)`;
        }

        if (Math.abs(parseFloat(inv.amount) - newFinalTotalAmt) > 0.01) {
          await sql`
            UPDATE invoices SET
              amount = ${newFinalTotalAmt},
              due_amount = ${newDue},
              status = ${newStatus},
              description = ${newDesc},
              taxable_amount = ${newTaxableAmt},
              gst_amount = ${newGstAmt},
              updated_at = NOW()
            WHERE id = ${inv.id}
          `;
        }
      }
    }
  } catch (err) {
    console.error("Failed to sync running room invoices:", err);
  }
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const action = req.query.action;
  const id = req.query.id;
  const sql = getSQL();

  // ══════ GLOBAL AUTH CHECK ══════
  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  // ══════ ACTION: Reconciliation Overview ══════
  if (action === "reconciliation") {
    try {
      const targetHospitalId = user.role === 'super_admin' ? (req.query.hospital_id ? parseInt(req.query.hospital_id) : null) : user.hospital_id;
      let aggregates, cashCollected, onlineCollected, statusCounts, patientCount, appointmentCount, todayAppointments, doctorStats, recentInvoices;

      if (targetHospitalId !== null) {
        aggregates = await sql`
          SELECT COALESCE(SUM(amount), 0) as total_invoiced, COALESCE(SUM(paid_amount), 0) as total_collected, COALESCE(SUM(due_amount), 0) as total_due
          FROM invoices WHERE hospital_id = ${targetHospitalId}
        `;
        cashCollected = await sql`
          SELECT COALESCE(SUM(paid_amount), 0) as total FROM invoices WHERE payment_mode = 'cash' AND hospital_id = ${targetHospitalId}
        `;
        onlineCollected = await sql`
          SELECT COALESCE(SUM(paid_amount), 0) as total FROM invoices WHERE payment_mode = 'online' AND hospital_id = ${targetHospitalId}
        `;
        statusCounts = await sql`
          SELECT status, COUNT(*) as count FROM invoices WHERE hospital_id = ${targetHospitalId} GROUP BY status
        `;
        patientCount = await sql`SELECT COUNT(*) as total FROM patients WHERE hospital_id = ${targetHospitalId}`;
        appointmentCount = await sql`SELECT COUNT(*) as total FROM appointments WHERE hospital_id = ${targetHospitalId}`;
        todayAppointments = await sql`
          SELECT COUNT(*) as total FROM appointments WHERE appointment_date = CURRENT_DATE AND hospital_id = ${targetHospitalId}
        `;
        doctorStats = await sql`
          SELECT doctor_name, COUNT(*) as visit_count, COALESCE(SUM(fee), 0) as total_revenue
          FROM appointments WHERE hospital_id = ${targetHospitalId} GROUP BY doctor_name ORDER BY total_revenue DESC
        `;
        recentInvoices = await sql`
          SELECT i.*, p.full_name as patient_name FROM invoices i JOIN patients p ON i.patient_id = p.id WHERE i.hospital_id = ${targetHospitalId} ORDER BY i.updated_at DESC LIMIT 5
        `;
      } else {
        aggregates = await sql`
          SELECT COALESCE(SUM(amount), 0) as total_invoiced, COALESCE(SUM(paid_amount), 0) as total_collected, COALESCE(SUM(due_amount), 0) as total_due FROM invoices
        `;
        cashCollected = await sql`SELECT COALESCE(SUM(paid_amount), 0) as total FROM invoices WHERE payment_mode = 'cash'`;
        onlineCollected = await sql`SELECT COALESCE(SUM(paid_amount), 0) as total FROM invoices WHERE payment_mode = 'online'`;
        statusCounts = await sql`SELECT status, COUNT(*) as count FROM invoices GROUP BY status`;
        patientCount = await sql`SELECT COUNT(*) as total FROM patients`;
        appointmentCount = await sql`SELECT COUNT(*) as total FROM appointments`;
        todayAppointments = await sql`SELECT COUNT(*) as total FROM appointments WHERE appointment_date = CURRENT_DATE`;
        doctorStats = await sql`
          SELECT doctor_name, COUNT(*) as visit_count, COALESCE(SUM(fee), 0) as total_revenue FROM appointments GROUP BY doctor_name ORDER BY total_revenue DESC
        `;
        recentInvoices = await sql`
          SELECT i.*, p.full_name as patient_name FROM invoices i JOIN patients p ON i.patient_id = p.id ORDER BY i.updated_at DESC LIMIT 5
        `;
      }

      const summary = {
        totalInvoiced: parseFloat(aggregates[0].total_invoiced),
        totalCollected: parseFloat(aggregates[0].total_collected),
        totalDue: parseFloat(aggregates[0].total_due),
        cashCollected: parseFloat(cashCollected[0].total),
        onlineCollected: parseFloat(onlineCollected[0].total),
        patientsCount: parseInt(patientCount[0].total),
        appointmentsCount: parseInt(appointmentCount[0].total),
        todayAppointmentsCount: parseInt(todayAppointments[0].total),
        statusBreakdown: statusCounts.reduce((acc, row) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        }, { paid: 0, unpaid: 0, partially_paid: 0 }),
        doctorBreakdown: doctorStats.map(row => ({
          doctorName: row.doctor_name,
          visitCount: parseInt(row.visit_count),
          totalRevenue: parseFloat(row.total_revenue)
        })),
        recentActivity: recentInvoices
      };

      return res.status(200).json({ success: true, summary });
    } catch (error) {
      return res.status(500).json({ error: 'Reconciliation aggregation failed', details: error.message });
    }
  }

  // ══════ ACTION: List receipts (GET) ══════
  if (action === "receipts") {
    const targetHospitalId =
      user.role === "super_admin"
        ? req.query.hospital_id
          ? parseInt(req.query.hospital_id)
          : null
        : user.hospital_id;

    const invoiceId = req.query.invoice_id;
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;

    try {
      if (invoiceId) {
        // Fetch receipts log for a specific invoice (in Pay Now modal log)
        const rows = await sql`
          SELECT r.*, i.invoice_no 
          FROM receipts r
          JOIN invoices i ON r.invoice_id = i.id
          WHERE r.invoice_id = ${parseInt(invoiceId)}
          ORDER BY r.created_at ASC
        `;
        return res.status(200).json({ success: true, receipts: rows });
      } else {
        // Fetch all receipts with tenant isolation & search filtering
        const searchPattern = `%${search}%`;
        let countRows, dataRows;

        if (targetHospitalId !== null) {
          countRows = await sql`
            SELECT COUNT(*) as total 
            FROM receipts r
            JOIN invoices i ON r.invoice_id = i.id
            JOIN patients p ON i.patient_id = p.id
            WHERE i.hospital_id = ${targetHospitalId}
              AND (r.receipt_no ILIKE ${searchPattern} OR i.invoice_no ILIKE ${searchPattern} OR p.full_name ILIKE ${searchPattern} OR p.mobile_no ILIKE ${searchPattern})
          `;

          dataRows = await sql`
            SELECT r.*, i.invoice_no, p.full_name as patient_name
            FROM receipts r
            JOIN invoices i ON r.invoice_id = i.id
            JOIN patients p ON i.patient_id = p.id
            WHERE i.hospital_id = ${targetHospitalId}
              AND (r.receipt_no ILIKE ${searchPattern} OR i.invoice_no ILIKE ${searchPattern} OR p.full_name ILIKE ${searchPattern} OR p.mobile_no ILIKE ${searchPattern})
            ORDER BY r.created_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `;
        } else {
          // Super Admin can list all cross-tenant
          countRows = await sql`
            SELECT COUNT(*) as total 
            FROM receipts r
            JOIN invoices i ON r.invoice_id = i.id
            JOIN patients p ON i.patient_id = p.id
            WHERE r.receipt_no ILIKE ${searchPattern} OR i.invoice_no ILIKE ${searchPattern} OR p.full_name ILIKE ${searchPattern} OR p.mobile_no ILIKE ${searchPattern}
          `;

          dataRows = await sql`
            SELECT r.*, i.invoice_no, p.full_name as patient_name
            FROM receipts r
            JOIN invoices i ON r.invoice_id = i.id
            JOIN patients p ON i.patient_id = p.id
            WHERE r.receipt_no ILIKE ${searchPattern} OR i.invoice_no ILIKE ${searchPattern} OR p.full_name ILIKE ${searchPattern} OR p.mobile_no ILIKE ${searchPattern}
            ORDER BY r.created_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `;
        }

        const total = parseInt(countRows[0].total);
        return res.status(200).json({
          success: true,
          receipts: dataRows,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        });
      }
    } catch (error) {
      return res
        .status(500)
        .json({
          error: "Failed to fetch receipts list",
          details: error.message,
        });
    }
  }

  // ══════ ACTION: Export PDF for a single transaction receipt (GET) ══════
  if (action === "export-receipt-pdf") {
    const receiptId = req.query.receipt_id;
    if (!receiptId)
      return res.status(400).json({ error: "Receipt ID is required" });
    try {
      const rows = await sql`
        SELECT r.*, i.invoice_no, i.amount as total_amount, i.paid_amount as total_paid, i.due_amount as total_due, i.description as invoice_desc,
               i.allocation_id, i.taxable_amount, i.gst_amount, i.gst_rate,
               p.full_name as patient_name, p.mobile_no as patient_mobile, p.address as patient_address,
               h.name as hospital_name, h.logo_data as hospital_logo, h.gst_no as gst_no,
               COALESCE(i.tax_name, h.tax_name, 'GST') as tax_name,
               ic.name as insurance_company_name, c.insurance_company_id as claim_insurance_company_id
        FROM receipts r
        JOIN invoices i ON r.invoice_id = i.id
        JOIN patients p ON i.patient_id = p.id
        LEFT JOIN hospitals h ON i.hospital_id = h.id
        LEFT JOIN claims c ON i.id = c.invoice_id AND c.status = 'approved'
        LEFT JOIN insurance_companies ic ON c.insurance_company_id = ic.id
        WHERE r.id = ${parseInt(receiptId)}
      `;
      if (rows.length === 0)
        return res.status(404).json({ error: "Receipt transaction not found" });
      const receipt = rows[0];

      if (user.role === "insurer") {
        const insurerCompanyId = parseInt(user.insurance_company_id);
        if (!insurerCompanyId || parseInt(receipt.claim_insurance_company_id) !== insurerCompanyId) {
          return res.status(403).json({ error: "Access denied. Not authorized for this receipt." });
        }
      }


      const doc = new PDFDocument({ margin: 50, size: "A4" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Receipt_${receipt.receipt_no}.pdf"`,
      );
      doc.pipe(res);

      let logoWritten = false;
      const headerStartY = 45;
      if (
        receipt.hospital_logo &&
        receipt.hospital_logo.startsWith("data:image")
      ) {
        try {
          const base64Data = receipt.hospital_logo.split(",")[1];
          const imgBuffer = Buffer.from(base64Data, "base64");
          doc.image(imgBuffer, 50, headerStartY, { fit: [140, 50] });
          logoWritten = true;
        } catch (e) {
          console.error("Failed to render logo in PDF receipt:", e);
        }
      }
      if (!logoWritten) {
        doc
          .fontSize(22)
          .font("Helvetica-Bold")
          .fillColor("#00bba8")
          .text(
            receipt.hospital_name
              ? receipt.hospital_name.toUpperCase()
              : "icare",
            50,
            headerStartY,
          );
      }

      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text(
          (receipt.hospital_name || "icare").toUpperCase(),
          350,
          headerStartY,
          { align: "right", width: 195 },
        );
      doc
        .fontSize(8.5)
        .font("Helvetica")
        .fillColor("#64748b")
        .text("TRANSACTION PAYMENT RECEIPT", 350, headerStartY + 15, {
          align: "right",
          width: 195,
        });

      let nextYOffset = 27;
      if (receipt.gst_no) {
        const taxName = (receipt.tax_name || "GST").toUpperCase();
        const taxLabel = taxName === "GST" ? "GSTIN" : `${taxName} No`;
        doc.text(
          `${taxLabel}: ${receipt.gst_no.toUpperCase()}`,
          350,
          headerStartY + nextYOffset,
          { align: "right", width: 195 },
        );
        nextYOffset += 12;
      }

      doc.y = headerStartY + nextYOffset + 10;
      doc.moveDown(0.2);

      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#cbd5e1")
        .lineWidth(1.5)
        .stroke();
      doc.moveDown(0.8);

      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#00bba8")
        .text("PAYMENT RECEIPT", 50, doc.y, { align: "center", width: 495 });
      doc.moveDown(0.5);

      const infoY = doc.y;

      doc
        .fontSize(9.5)
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text("Receipt Details:", 50, infoY);
      doc
        .font("Helvetica")
        .fillColor("#475569")
        .text(`Receipt No: ${receipt.receipt_no}`, 50, infoY + 16)
        .text(
          `Payment Date: ${formatDate(receipt.payment_date)}`,
          50,
          infoY + 28,
        )
        .text(`Ref Invoice: ${receipt.invoice_no}`, 50, infoY + 40);

      doc
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text("Billed To:", 300, infoY);
      doc
        .font("Helvetica")
        .fillColor("#475569")
        .text(`Patient Name: ${receipt.patient_name}`, 300, infoY + 16)
        .text(`Contact: ${receipt.patient_mobile || "—"}`, 300, infoY + 28)
        .text(`Address: ${receipt.patient_address || "—"}`, 300, infoY + 40, {
          width: 240,
        });

      doc.moveDown(3.5);

      const tableHeaderY = doc.y;
      doc
        .moveTo(50, tableHeaderY - 4)
        .lineTo(545, tableHeaderY - 4)
        .strokeColor("#94a3b8")
        .lineWidth(1)
        .stroke();

      doc.font("Helvetica-Bold").fillColor("#475569");
      doc.text("Billed Description / Itemised Services", 50, tableHeaderY);
      doc.text("Amount", 450, tableHeaderY, { align: "right", width: 95 });
      doc.moveDown(0.4);
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#e2e8f0")
        .lineWidth(1)
        .stroke();
      doc.moveDown(0.6);

      let currentY = doc.y;

      // Draw itemized services table (same logic as invoice PDF)
      const printRowAmt = receipt.taxable_amount
        ? parseFloat(receipt.taxable_amount)
        : parseFloat(receipt.total_amount);

      if (receipt.allocation_id) {
        try {
          const allocRes = await sql`
            SELECT ra.*, r.price_per_day, r.room_no, r.room_type
            FROM room_allocations ra
            JOIN rooms r ON ra.room_id = r.id
            WHERE ra.id = ${parseInt(receipt.allocation_id)}
          `;
          if (allocRes.length > 0) {
            const alloc = allocRes[0];
            const now = alloc.status === 'discharged' && alloc.discharged_at ? new Date(alloc.discharged_at) : new Date();
            const admit = new Date(alloc.admitted_at);
            const diffMs = now - admit;
            const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
            const pricePerDay = parseFloat(alloc.price_per_day) || 0.00;
            const roomChargeBase = pricePerDay * days;

            doc.font("Helvetica").fillColor("#0f172a");
            const baseDesc = alloc.status === 'discharged' ? 'Discharge' : 'Active';
            doc.text(`Room Charge (${baseDesc}: ${days} ${days === 1 ? 'Day' : 'Days'}) - Room ${alloc.room_no} (${alloc.room_type})`, 50, currentY, { width: 380 });
            doc.text(formatCurrency(roomChargeBase), 450, currentY, { align: "right", width: 95 });
            currentY += 18;

            const services = await sql`
              SELECT * FROM allocation_services 
              WHERE allocation_id = ${alloc.id} 
              ORDER BY id ASC
            `;
            for (const s of services) {
              const qtyStr = s.quantity > 1 ? ` (Qty: ${s.quantity})` : '';
              doc.text(`${s.service_name}${qtyStr}`, 50, currentY, { width: 380 });
              doc.text(formatCurrency(parseFloat(s.price) * s.quantity), 450, currentY, { align: "right", width: 95 });
              currentY += 18;
            }
          } else {
            doc.font("Helvetica").fillColor("#0f172a");
            doc.text(receipt.invoice_desc || "Room Charge", 50, currentY, { width: 380 });
            doc.text(formatCurrency(printRowAmt), 450, currentY, { align: "right", width: 95 });
            currentY += 18;
          }
        } catch (e) {
          console.error("PDF receipt generation allocation check failed:", e);
          doc.font("Helvetica").fillColor("#0f172a");
          doc.text(receipt.invoice_desc || "Room Charge", 50, currentY, { width: 380 });
          doc.text(formatCurrency(printRowAmt), 450, currentY, { align: "right", width: 95 });
          currentY += 18;
        }
      } else {
        doc.font("Helvetica").fillColor("#0f172a");
        doc.text(
          receipt.invoice_desc || "Medical Consultation Fee",
          50,
          currentY,
          { width: 380 }
        );
        doc.text(formatCurrency(printRowAmt), 450, currentY, {
          align: "right",
          width: 95,
        });
        currentY += 18;
      }

      // Draw horizontal line separator
      doc.y = currentY + 10;
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#cbd5e1")
        .lineWidth(1)
        .stroke();
      doc.moveDown(0.6);

      // Draw transaction mode row
      const transModeY = doc.y;
      doc.font("Helvetica-Bold").fillColor("#0f172a");
      const pModeText = receipt.payment_mode === "insurer" && receipt.insurance_company_name
        ? `INSURER: ${receipt.insurance_company_name.toUpperCase()}`
        : receipt.payment_mode.toUpperCase();
      doc.text("Payment Receipt Logged (" + pModeText + ")", 50, transModeY);
      doc.text(formatCurrency(receipt.amount_paid), 450, transModeY, {
        align: "right",
        width: 95,
      });
      doc.moveDown(1.5);

      doc
        .moveTo(300, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#cbd5e1")
        .lineWidth(1)
        .stroke();
      doc.moveDown(0.6);

      let totalsY = doc.y;

      // Draw GST info if exists
      const taxRate = parseFloat(receipt.gst_rate) || 0.00;
      const taxAmt = parseFloat(receipt.gst_amount) || 0.00;
      const taxable = parseFloat(receipt.taxable_amount) || parseFloat(receipt.total_amount);
      const taxName = (receipt.tax_name || "GST").toUpperCase();

      if (taxAmt > 0) {
        doc
          .font("Helvetica")
          .fillColor("#475569")
          .text(`Taxable Value:`, 320, totalsY);
        doc
          .font("Helvetica")
          .fillColor("#0f172a")
          .text(formatCurrency(taxable), 450, totalsY, { align: "right", width: 95 });
        totalsY += 16;

        doc
          .font("Helvetica")
          .fillColor("#475569")
          .text(`${taxName} (${taxRate}%):`, 320, totalsY);
        doc
          .font("Helvetica")
          .fillColor("#0f172a")
          .text(formatCurrency(taxAmt), 450, totalsY, { align: "right", width: 95 });
        totalsY += 16;
      }

      doc
        .font("Helvetica-Bold")
        .fillColor("#475569")
        .text("Installment Paid:", 320, totalsY);
      doc
        .font("Helvetica-Bold")
        .fillColor("#00bba8")
        .text(formatCurrency(receipt.amount_paid), 450, totalsY, {
          align: "right",
          width: 95,
        });

      doc
        .font("Helvetica-Bold")
        .fillColor("#475569")
        .text("Total Invoice Billed:", 320, totalsY + 16);
      doc
        .font("Helvetica")
        .fillColor("#0f172a")
        .text(formatCurrency(receipt.total_amount), 450, totalsY + 16, {
          align: "right",
          width: 95,
        });

      doc
        .font("Helvetica-Bold")
        .fillColor("#475569")
        .text("Total Amount Paid:", 320, totalsY + 32);
      doc
        .font("Helvetica")
        .fillColor("#0f172a")
        .text(formatCurrency(receipt.total_paid), 450, totalsY + 32, {
          align: "right",
          width: 95,
        });

      doc
        .font("Helvetica-Bold")
        .fillColor("#475569")
        .text("Remaining Balance Due:", 320, totalsY + 48);
      doc
        .font("Helvetica-Bold")
        .fillColor("#ef4444")
        .text(formatCurrency(receipt.total_due), 450, totalsY + 48, {
          align: "right",
          width: 95,
        });

      doc
        .font("Helvetica-Bold")
        .fillColor("#ef4444")
        .text(formatCurrency(receipt.total_due), 450, totalsY + 48, {
          align: "right",
          width: 95,
        });

      doc.y = totalsY + 64;
      doc.moveDown(2);

      const signatureY = doc.y;
      doc.fontSize(9).font("Helvetica").fillColor("#64748b");
      doc.text("Received By: Staff Desk", 50, signatureY);
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

      doc.y = 745;
      doc
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .fillColor("#00bba8")
        .text("Developed & Maintained by inspenox (inspenox.in)", 50, doc.y, {
          align: "center",
          width: 495
        });
      doc.end();
    } catch (error) {
      console.error("PDF receipt transaction export error:", error);
      return res
        .status(500)
        .json({
          error: "Failed to compile transaction receipt PDF",
          details: error.message,
        });
    }
  }

  // ══════ ACTION: Export PDF Receipt (GET) ══════
  if (action === "export-pdf") {
    const pdfId = req.query.id;
    if (!pdfId) {
      return res.status(400).json({ error: "Invoice ID is required (?id=X)" });
    }

    try {
      const rows = await sql`
        SELECT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile, p.address as patient_address,
               a.doctor_name, a.appointment_date, a.appointment_time,
               h.name as hospital_name, h.logo_data as hospital_logo, h.gst_no as gst_no,
               COALESCE(i.tax_name, h.tax_name, 'GST') as tax_name,
               ic.name as insurance_company_name, c.policy_number, c.insurance_company_id as claim_insurance_company_id
        FROM invoices i
        JOIN patients p ON i.patient_id = p.id
        LEFT JOIN appointments a ON i.appointment_id = a.id
        LEFT JOIN hospitals h ON i.hospital_id = h.id
        LEFT JOIN claims c ON i.id = c.invoice_id AND c.status = 'approved'
        LEFT JOIN insurance_companies ic ON c.insurance_company_id = ic.id
        WHERE i.id = ${parseInt(pdfId)}
      `;

      if (rows.length === 0) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const invoice = rows[0];

      if (user.role === "insurer") {
        const insurerCompanyId = parseInt(user.insurance_company_id);
        if (!insurerCompanyId || parseInt(invoice.claim_insurance_company_id) !== insurerCompanyId) {
          return res.status(403).json({ error: "Access denied. Not authorized for this invoice." });
        }
      }

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${invoice.patient_name} - icare.pdf"`,
      );
      doc.pipe(res);

      // Hospital Header (Custom Dynamic Branding)
      let logoWritten = false;
      const headerStartY = 45;

      if (
        invoice.hospital_logo &&
        invoice.hospital_logo.startsWith("data:image")
      ) {
        try {
          const base64Data = invoice.hospital_logo.split(",")[1];
          const imgBuffer = Buffer.from(base64Data, "base64");
          doc.image(imgBuffer, 50, headerStartY, {
            fit: [140, 50],
          });
          logoWritten = true;
        } catch (e) {
          console.error("Failed to render custom base64 logo in PDF:", e);
        }
      }

      if (!logoWritten) {
        doc
          .fontSize(22)
          .font("Helvetica-Bold")
          .fillColor("#00bba8")
          .text(
            invoice.hospital_name
              ? invoice.hospital_name.toUpperCase()
              : "icare",
            50,
            headerStartY,
            { align: "left" },
          );
      }

      // Draw Hospital details on the top right
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text(
          (invoice.hospital_name || "icare").toUpperCase(),
          350,
          headerStartY,
          { align: "right", width: 195 },
        );

      doc
        .fontSize(8.5)
        .font("Helvetica")
        .fillColor("#64748b")
        .text(
          invoice.hospital_name
            ? "SMART CUSTOM RECEIPT"
            : "SMART CLINIC & HOSPITAL ERP",
          350,
          headerStartY + 15,
          { align: "right", width: 195 },
        );

      doc
        .fontSize(8.5)
        .font("Helvetica")
        .fillColor("#64748b")
        .text("Contact: +91 8688932150", 350, headerStartY + 27, {
          align: "right",
          width: 195,
        });

      let nextYOffset = 39;
      if (invoice.gst_no) {
        const taxName = (invoice.tax_name || "GST").toUpperCase();
        const taxLabel = taxName === "GST" ? "GSTIN" : `${taxName} No`;
        doc
          .fontSize(8.5)
          .font("Helvetica")
          .fillColor("#64748b")
          .text(
            `${taxLabel}: ${invoice.gst_no.toUpperCase()}`,
            350,
            headerStartY + nextYOffset,
            { align: "right", width: 195 },
          );
        nextYOffset += 12;
      }

      // Move cursor below the header
      doc.y = headerStartY + nextYOffset + 10;
      doc.moveDown(0.2);

      // Decorative divider
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#cbd5e1")
        .lineWidth(1.5)
        .stroke();
      doc.moveDown(0.8);

      // Title & Date
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text("INVOICE RECEIPT", 50, doc.y, { align: "center", width: 495 });
      doc.moveDown(0.5);

      const infoY = doc.y;

      // Invoice info (Left Column)
      doc
        .fontSize(9.5)
        .font("Helvetica-Bold")
        .text("Invoice Details:", 50, infoY);
      doc
        .font("Helvetica")
        .fillColor("#475569")
        .text(`Receipt No: ${invoice.invoice_no}`, 50, infoY + 16)
        .text(`Issued Date: ${formatDate(invoice.created_at)}`, 50, infoY + 28);

      if (invoice.payment_date) {
        doc.text(
          `Payment Date: ${formatDate(invoice.payment_date)}`,
          50,
          infoY + 40,
        );
      }
      if (invoice.payment_mode === "insurer" && invoice.insurance_company_name) {
        doc.text(
          `Insurer: ${invoice.insurance_company_name}`,
          50,
          infoY + 52,
        );
        if (invoice.policy_number) {
          doc.text(
            `Policy No: ${invoice.policy_number}`,
            50,
            infoY + 64,
          );
        }
      }

      // Patient Info (Right Column)
      doc
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text("Billed To:", 300, infoY);
      doc
        .font("Helvetica")
        .fillColor("#475569")
        .text(`Patient Name: ${invoice.patient_name}`, 300, infoY + 16)
        .text(`Contact: ${invoice.patient_mobile || "—"}`, 300, infoY + 28)
        .text(`Address: ${invoice.patient_address || "—"}`, 300, infoY + 40, {
          width: 240,
        });

      doc.y = Math.max(doc.y, infoY + (invoice.payment_mode === "insurer" ? 80 : 56));
      doc.moveDown(1.5);

      // Appointment check context
      if (invoice.doctor_name) {
        const checkupY = doc.y;
        doc
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text("Clinical Consultation Visit Info:", 50, checkupY);
        doc
          .font("Helvetica")
          .fillColor("#475569")
          .text(
            `Doctor: ${invoice.doctor_name} | Date: ${formatDate(invoice.appointment_date)} | Time: ${invoice.appointment_time || "—"}`,
            50,
            checkupY + 14,
          );
        doc.moveDown(2);
      }

      // Table Header
      const tableHeaderY = doc.y;
      doc
        .moveTo(50, tableHeaderY - 4)
        .lineTo(545, tableHeaderY - 4)
        .strokeColor("#94a3b8")
        .lineWidth(1)
        .stroke();

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

      let currentY = doc.y;
      doc.font("Helvetica").fillColor("#0f172a");

      const printRowAmt =
        invoice.gst_rate &&
        parseFloat(invoice.gst_rate) > 0 &&
        invoice.taxable_amount
          ? parseFloat(invoice.taxable_amount)
          : parseFloat(invoice.amount);

      if (invoice.allocation_id) {
        try {
          const allocRes = await sql`
            SELECT ra.*, r.price_per_day, r.room_no, r.room_type
            FROM room_allocations ra
            JOIN rooms r ON ra.room_id = r.id
            WHERE ra.id = ${parseInt(invoice.allocation_id)}
          `;
          if (allocRes.length > 0) {
            const alloc = allocRes[0];
            const now = alloc.status === 'discharged' && alloc.discharged_at ? new Date(alloc.discharged_at) : new Date();
            const admit = new Date(alloc.admitted_at);
            const diffMs = now - admit;
            const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
            const pricePerDay = parseFloat(alloc.price_per_day) || 0.00;
            const roomChargeBase = pricePerDay * days;

            // Draw base room stay charges row
            const baseDesc = alloc.status === 'discharged' ? 'Discharge' : 'Active';
            doc.text(`Room Charge (${baseDesc}: ${days} ${days === 1 ? 'Day' : 'Days'}) - Room ${alloc.room_no} (${alloc.room_type})`, 50, currentY, { width: 380 });
            doc.text(formatCurrency(roomChargeBase), 450, currentY, { align: "right", width: 95 });
            currentY += 18;

            // Draw each service row
            const services = await sql`
              SELECT * FROM allocation_services 
              WHERE allocation_id = ${alloc.id} 
              ORDER BY id ASC
            `;
            for (const s of services) {
              const qtyStr = s.quantity > 1 ? ` (Qty: ${s.quantity})` : '';
              doc.text(`${s.service_name}${qtyStr}`, 50, currentY, { width: 380 });
              doc.text(formatCurrency(parseFloat(s.price) * s.quantity), 450, currentY, { align: "right", width: 95 });
              currentY += 18;
            }
          } else {
            doc.text(invoice.description || "Room Charge", 50, currentY, { width: 380 });
            doc.text(formatCurrency(printRowAmt), 450, currentY, { align: "right", width: 95 });
            currentY += 18;
          }
        } catch (e) {
          console.error("PDF generation allocation check failed:", e);
          doc.text(invoice.description || "Room Charge", 50, currentY, { width: 380 });
          doc.text(formatCurrency(printRowAmt), 450, currentY, { align: "right", width: 95 });
          currentY += 18;
        }
      } else {
        doc.text(
          invoice.description || "Medical Consultation Fee",
          50,
          currentY,
          { width: 380 }
        );
        doc.text(formatCurrency(printRowAmt), 450, currentY, {
          align: "right",
          width: 95,
        });
        currentY += 18;
      }
      
      doc.y = currentY;
      doc.moveDown(1);

      // Totals & Balances
      doc
        .moveTo(300, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#cbd5e1")
        .lineWidth(1)
        .stroke();
      doc.moveDown(0.6);

      const totalsY = doc.y;
      let offset = 0;

      if (
        invoice.gst_rate &&
        parseFloat(invoice.gst_rate) > 0 &&
        invoice.taxable_amount
      ) {
        doc
          .font("Helvetica-Bold")
          .fillColor("#475569")
          .text("Taxable Value:", 320, totalsY);
        doc
          .font("Helvetica")
          .fillColor("#0f172a")
          .text(formatCurrency(invoice.taxable_amount), 450, totalsY, {
            align: "right",
            width: 95,
          });

        offset += 16;

        const taxName = (invoice.tax_name || "GST").toUpperCase();
        if (taxName === "GST" || taxName === "CGST/SGST") {
          const halfRate = parseFloat(invoice.gst_rate) / 2;
          const halfGstAmt = parseFloat(invoice.gst_amount) / 2;

          doc
            .font("Helvetica-Bold")
            .fillColor("#475569")
            .text(`CGST (${halfRate}%):`, 320, totalsY + offset);
          doc
            .font("Helvetica")
            .fillColor("#0f172a")
            .text(formatCurrency(halfGstAmt), 450, totalsY + offset, {
              align: "right",
              width: 95,
            });

          offset += 16;

          doc
            .font("Helvetica-Bold")
            .fillColor("#475569")
            .text(`SGST (${halfRate}%):`, 320, totalsY + offset);
          doc
            .font("Helvetica")
            .fillColor("#0f172a")
            .text(formatCurrency(halfGstAmt), 450, totalsY + offset, {
              align: "right",
              width: 95,
            });

          offset += 16;
        } else {
          doc
            .font("Helvetica-Bold")
            .fillColor("#475569")
            .text(
              `${invoice.tax_name || "Tax"} (${invoice.gst_rate}%):`,
              320,
              totalsY + offset,
            );
          doc
            .font("Helvetica")
            .fillColor("#0f172a")
            .text(formatCurrency(invoice.gst_amount), 450, totalsY + offset, {
              align: "right",
              width: 95,
            });

          offset += 16;
        }
      }

      doc
        .font("Helvetica-Bold")
        .fillColor("#475569")
        .text("Total Amount:", 320, totalsY + offset);
      doc
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text(formatCurrency(invoice.amount), 450, totalsY + offset, {
          align: "right",
          width: 95,
        });

      offset += 16;

      doc
        .font("Helvetica-Bold")
        .fillColor("#475569")
        .text("Amount Paid:", 320, totalsY + offset);
      doc
        .font("Helvetica")
        .fillColor("#0f172a")
        .text(formatCurrency(invoice.paid_amount), 450, totalsY + offset, {
          align: "right",
          width: 95,
        });

      offset += 16;

      doc
        .font("Helvetica-Bold")
        .fillColor("#475569")
        .text("Outstanding Due:", 320, totalsY + offset);
      doc
        .font("Helvetica-Bold")
        .fillColor("#ef4444")
        .text(formatCurrency(invoice.due_amount), 450, totalsY + offset, {
          align: "right",
          width: 95,
        });

      doc.y = totalsY + offset;

      // Highlight Status Banner
      doc.moveDown(3.5);
      const bannerY = doc.y;
      doc
        .rect(50, bannerY, 495, 30)
        .fill(invoice.status === "paid" ? "#d1fae5" : "#fee2e2");

      doc
        .fontSize(9.5)
        .font("Helvetica-Bold")
        .fillColor(invoice.status === "paid" ? "#065f46" : "#991b1b");
      const pMode = invoice.payment_mode === "insurer" && invoice.insurance_company_name
        ? `INSURER (${invoice.insurance_company_name.toUpperCase()})`
        : invoice.payment_mode
        ? invoice.payment_mode.toUpperCase()
        : "N/A";
      const pDate = invoice.payment_date
        ? formatDate(invoice.payment_date)
        : "N/A";
      const bannerText =
        invoice.status === "paid"
          ? `STATUS: FULLY PAID VIA ${pMode} ON ${pDate}`
          : `STATUS: PAYMENT OUTSTANDING — DUE AMOUNT ${formatCurrency(invoice.due_amount)}`;
      doc.text(bannerText, 70, bannerY + 10, { align: "center", width: 455 });

      // Footer signature space
      doc.moveDown(1.5);
      const signatureY = doc.y;
      doc.fontSize(9).font("Helvetica").fillColor("#64748b");
      doc.text("Prepared By: Staff Desk", 50, signatureY);
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

      doc.y = 745;
      doc
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .fillColor("#00bba8")
        .text("Developed & Maintained by inspenox (inspenox.in)", 50, doc.y, {
          align: "center",
          width: 495
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
    const targetHospitalId =
      user.role === "super_admin"
        ? req.query.hospital_id
          ? parseInt(req.query.hospital_id)
          : null
        : user.hospital_id;

    // ══════ SINGLE INVOICE ACTIONS ══════
    if (id) {
      // GET: Fetch single invoice
      if (req.method === "GET") {
        try {
          let rows;
          if (user.role === "insurer") {
            const insurerCompanyId = parseInt(user.insurance_company_id);
            rows = await sql`
              SELECT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
              FROM invoices i
              JOIN patients p ON i.patient_id = p.id
              JOIN claims c ON i.id = c.invoice_id
              WHERE i.id = ${parseInt(id)} AND c.insurance_company_id = ${insurerCompanyId}
            `;
          } else {
            rows =
              targetHospitalId !== null
                ? await sql`
                SELECT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM invoices i
                JOIN patients p ON i.patient_id = p.id
                WHERE i.id = ${parseInt(id)} AND i.hospital_id = ${targetHospitalId}
              `
                : await sql`
                SELECT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM invoices i
                JOIN patients p ON i.patient_id = p.id
                WHERE i.id = ${parseInt(id)}
              `;
          }
          if (rows.length === 0)
            return res.status(404).json({ error: "Invoice not found or access denied" });
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
          const { status, payment_mode, paid_amount, amount, amount_paid } =
            req.body;

          // 1. Fetch current invoice first
          const currentRows =
            targetHospitalId !== null
              ? await sql`SELECT * FROM invoices WHERE id = ${parseInt(id)} AND hospital_id = ${targetHospitalId}`
              : await sql`SELECT * FROM invoices WHERE id = ${parseInt(id)}`;
          if (currentRows.length === 0)
            return res.status(404).json({ error: "Invoice not found" });
          const currentInv = currentRows[0];

          let updatedStatus = status || currentInv.status;
          let totalAmount =
            amount !== undefined
              ? parseFloat(amount)
              : parseFloat(currentInv.amount);

          let totalPaid = 0;
          let newReceipt = null;

          if (amount_paid !== undefined) {
            // Logging a new installment transaction!
            const installment = parseFloat(amount_paid) || 0;
            if (installment <= 0) {
              return res
                .status(400)
                .json({
                  error: "Installment payment amount must be greater than zero",
                });
            }
            totalPaid = (parseFloat(currentInv.paid_amount) || 0) + installment;

            // Generate sequential receipt no
            const countRes =
              await sql`SELECT COUNT(*) as count FROM receipts WHERE invoice_id = ${currentInv.id}`;
            const rcptCount = parseInt(countRes[0].count) + 1;
            const rcptNo = `RCPT-${currentInv.invoice_no}-${rcptCount}`;

            const mode = payment_mode || "CASH";
            const dateVal = new Date().toISOString().split("T")[0];

            const rcptRows = await sql`
              INSERT INTO receipts (receipt_no, invoice_id, amount_paid, payment_mode, payment_date)
              VALUES (${rcptNo}, ${currentInv.id}, ${installment}, ${mode}, ${dateVal})
              RETURNING *
            `;
            newReceipt = rcptRows[0];
          } else {
            // Standard overwrite from dashboard (for manual adjustment/reconciliation)
            totalPaid =
              paid_amount !== undefined
                ? parseFloat(paid_amount)
                : parseFloat(currentInv.paid_amount);
          }

          const dueAmount = Math.max(0.0, totalAmount - totalPaid);
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

          const rows =
            targetHospitalId !== null
              ? await sql`
              UPDATE invoices SET
                status = ${updatedStatus},
                payment_mode = ${payment_mode || currentInv.payment_mode || null},
                paid_amount = ${totalPaid},
                due_amount = ${dueAmount},
                payment_date = ${paymentDateVal},
                updated_at = NOW()
              WHERE id = ${parseInt(id)} AND hospital_id = ${targetHospitalId}
              RETURNING *
            `
              : await sql`
              UPDATE invoices SET
                status = ${updatedStatus},
                payment_mode = ${payment_mode || currentInv.payment_mode || null},
                paid_amount = ${totalPaid},
                due_amount = ${dueAmount},
                payment_date = ${paymentDateVal},
                updated_at = NOW()
              WHERE id = ${parseInt(id)}
              RETURNING *
            `;

          // Update appointment status to completed if full payment reconciliated and it is linked to an appointment
          if (updatedStatus === "paid" && rows[0].appointment_id) {
            await sql`
              UPDATE appointments SET status = 'completed', updated_at = NOW() 
              WHERE id = ${rows[0].appointment_id}
            `;
          }

          return res
            .status(200)
            .json({ success: true, invoice: rows[0], receipt: newReceipt });
        } catch (error) {
          return res.status(500).json({
            error: "Failed to update invoice status",
            details: error.message,
          });
        }
      }

      // DELETE: Delete invoice (Admin Only)
      if (req.method === "DELETE") {
        if (user.role !== "admin" && user.role !== "super_admin") {
          return res
            .status(403)
            .json({ error: "Access denied. Administrators only." });
        }

        try {
          const rows =
            targetHospitalId !== null
              ? await sql`DELETE FROM invoices WHERE id = ${parseInt(id)} AND hospital_id = ${targetHospitalId} RETURNING id`
              : await sql`DELETE FROM invoices WHERE id = ${parseInt(id)} RETURNING id`;
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

          const hostId = targetHospitalId || 1;

          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, "0");
          const day = String(today.getDate()).padStart(2, "0");
          const dateStr = `${year}${month}${day}`;

          const countRes = await sql`
            SELECT COUNT(*) as total 
            FROM invoices 
            WHERE hospital_id = ${hostId} 
              AND created_at >= CURRENT_DATE
          `;
          const countVal = parseInt(countRes[0].total);
          const invNo = `INSP${hostId}${dateStr}${countVal}`;
          const totalAmt = parseFloat(amount);

          const hospRes =
            await sql`SELECT gst_no, gst_percent, tax_name FROM hospitals WHERE id = ${hostId}`;
          const hosp = hospRes[0];

          let taxableAmt = totalAmt;
          let gstAmt = 0.0;
          let gstRate = 0.0;
          let finalTotalAmt = totalAmt;
          const taxNameVal =
            hosp && hosp.tax_name ? hosp.tax_name.trim() : "GST";

          if (
            hosp &&
            hosp.gst_no &&
            hosp.gst_no.trim() !== "" &&
            hosp.gst_percent &&
            parseFloat(hosp.gst_percent) > 0
          ) {
            gstRate = parseFloat(hosp.gst_percent);
            gstAmt = Math.round(((totalAmt * gstRate) / 100) * 100) / 100;
            finalTotalAmt = totalAmt + gstAmt;
          }

          let paidAmt = 0.0;
          let isPaid = status || "unpaid";
          if (isPaid === "paid") {
            paidAmt = finalTotalAmt;
          }
          const dueAmt = finalTotalAmt - paidAmt;

          const patientIdInt = parseInt(patient_id);
          const appointmentIdInt = appointment_id
            ? parseInt(appointment_id)
            : null;
          const paymentDateVal =
            isPaid === "paid" ? new Date().toISOString().split("T")[0] : null;

          const rows = await sql`
            INSERT INTO invoices (
              invoice_no, patient_id, appointment_id, description, amount, paid_amount, due_amount, status, payment_mode, payment_date, created_by, hospital_id, taxable_amount, gst_amount, gst_rate, tax_name
            ) VALUES (
              ${invNo}, ${patientIdInt}, ${appointmentIdInt}, ${description}, ${finalTotalAmt}, ${paidAmt}, ${dueAmt}, ${isPaid},
              ${payment_mode || null}, ${paymentDateVal}, ${user.id}, ${hostId}, ${taxableAmt}, ${gstAmt}, ${gstRate}, ${taxNameVal}
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
          if (user.role === "insurer") {
            const insurerCompanyId = parseInt(user.insurance_company_id);
            if (!insurerCompanyId) {
              return res.status(200).json({ success: true, invoices: [], pagination: { total: 0, page: 1, limit: 15, totalPages: 0 } });
            }

            const queryPatientId = req.query.patient_id ? parseInt(req.query.patient_id) : null;
            if (queryPatientId) {
              const rows = await sql`
                SELECT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile
                FROM invoices i
                JOIN patients p ON i.patient_id = p.id
                JOIN claims c ON i.id = c.invoice_id
                WHERE i.patient_id = ${queryPatientId}
                  AND c.insurance_company_id = ${insurerCompanyId}
                  AND (i.status = 'unpaid' OR i.status = 'partially_paid')
                ORDER BY i.created_at DESC
              `;
              return res.status(200).json({ success: true, invoices: rows });
            }

            const search = req.query.search || "";
            const status = req.query.status || "";
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 15;
            const offset = (page - 1) * limit;
            const searchPattern = `%${search}%`;

            let countRows, dataRows;

            if (search || status) {
              if (search && status) {
                countRows = await sql`
                  SELECT COUNT(DISTINCT i.id) as total 
                  FROM invoices i 
                  JOIN patients p ON i.patient_id = p.id
                  JOIN claims c ON i.id = c.invoice_id
                  WHERE c.insurance_company_id = ${insurerCompanyId}
                    AND i.status = ${status} 
                    AND (p.full_name ILIKE ${searchPattern} OR i.invoice_no ILIKE ${searchPattern})
                `;
                dataRows = await sql`
                  SELECT DISTINCT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                  FROM invoices i 
                  JOIN patients p ON i.patient_id = p.id
                  JOIN claims c ON i.id = c.invoice_id
                  WHERE c.insurance_company_id = ${insurerCompanyId}
                    AND i.status = ${status} 
                    AND (p.full_name ILIKE ${searchPattern} OR i.invoice_no ILIKE ${searchPattern})
                  ORDER BY i.created_at DESC LIMIT ${limit} OFFSET ${offset}
                `;
              } else if (search) {
                countRows = await sql`
                  SELECT COUNT(DISTINCT i.id) as total 
                  FROM invoices i 
                  JOIN patients p ON i.patient_id = p.id
                  JOIN claims c ON i.id = c.invoice_id
                  WHERE c.insurance_company_id = ${insurerCompanyId}
                    AND (p.full_name ILIKE ${searchPattern} OR i.invoice_no ILIKE ${searchPattern})
                `;
                dataRows = await sql`
                  SELECT DISTINCT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                  FROM invoices i 
                  JOIN patients p ON i.patient_id = p.id
                  JOIN claims c ON i.id = c.invoice_id
                  WHERE c.insurance_company_id = ${insurerCompanyId}
                    AND (p.full_name ILIKE ${searchPattern} OR i.invoice_no ILIKE ${searchPattern})
                  ORDER BY i.created_at DESC LIMIT ${limit} OFFSET ${offset}
                `;
              } else {
                countRows = await sql`
                  SELECT COUNT(DISTINCT i.id) as total 
                  FROM invoices i 
                  JOIN claims c ON i.id = c.invoice_id
                  WHERE c.insurance_company_id = ${insurerCompanyId} AND i.status = ${status}
                `;
                dataRows = await sql`
                  SELECT DISTINCT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                  FROM invoices i 
                  JOIN patients p ON i.patient_id = p.id
                  JOIN claims c ON i.id = c.invoice_id
                  WHERE c.insurance_company_id = ${insurerCompanyId} AND i.status = ${status}
                  ORDER BY i.created_at DESC LIMIT ${limit} OFFSET ${offset}
                `;
              }
            } else {
              countRows = await sql`
                SELECT COUNT(DISTINCT i.id) as total 
                FROM invoices i 
                JOIN claims c ON i.id = c.invoice_id
                WHERE c.insurance_company_id = ${insurerCompanyId}
              `;
              dataRows = await sql`
                SELECT DISTINCT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM invoices i 
                JOIN patients p ON i.patient_id = p.id
                JOIN claims c ON i.id = c.invoice_id
                WHERE c.insurance_company_id = ${insurerCompanyId}
                ORDER BY i.created_at DESC LIMIT ${limit} OFFSET ${offset}
              `;
            }

            const total = parseInt(countRows[0].total);
            const totalPages = Math.ceil(total / limit);

            return res.status(200).json({
              success: true,
              invoices: dataRows,
              pagination: { total, page, limit, totalPages },
            });
          }

          await syncRoomInvoices(sql, targetHospitalId);
          const allocationId = req.query.allocation_id;
          if (allocationId) {
            const rows = await sql`
              SELECT * FROM invoices 
              WHERE allocation_id = ${parseInt(allocationId)}
            `;
            return res.status(200).json({ success: true, invoices: rows });
          }
          const search = req.query.search || "";

          const status = req.query.status || "";
          const page = parseInt(req.query.page) || 1;
          const limit = parseInt(req.query.limit) || 15;
          const offset = (page - 1) * limit;

          let countRows, dataRows;

          if (search || status) {
            const searchPattern = `%${search}%`;

            if (search && status) {
              if (targetHospitalId !== null) {
                countRows = await sql`
                  SELECT COUNT(*) as total FROM invoices i JOIN patients p ON i.patient_id = p.id
                  WHERE i.status = ${status} AND (p.full_name ILIKE ${searchPattern} OR i.invoice_no ILIKE ${searchPattern}) AND i.hospital_id = ${targetHospitalId}
                `;
                dataRows = await sql`
                  SELECT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                  FROM invoices i JOIN patients p ON i.patient_id = p.id
                  WHERE i.status = ${status} AND (p.full_name ILIKE ${searchPattern} OR i.invoice_no ILIKE ${searchPattern}) AND i.hospital_id = ${targetHospitalId}
                  ORDER BY i.created_at DESC LIMIT ${limit} OFFSET ${offset}
                `;
              } else {
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
              }
            } else if (search) {
              if (targetHospitalId !== null) {
                countRows = await sql`
                  SELECT COUNT(*) as total FROM invoices i JOIN patients p ON i.patient_id = p.id
                  WHERE (p.full_name ILIKE ${searchPattern} OR i.invoice_no ILIKE ${searchPattern}) AND i.hospital_id = ${targetHospitalId}
                `;
                dataRows = await sql`
                  SELECT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                  FROM invoices i JOIN patients p ON i.patient_id = p.id
                  WHERE (p.full_name ILIKE ${searchPattern} OR i.invoice_no ILIKE ${searchPattern}) AND i.hospital_id = ${targetHospitalId}
                  ORDER BY i.created_at DESC LIMIT ${limit} OFFSET ${offset}
                `;
              } else {
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
              }
            } else {
              if (targetHospitalId !== null) {
                countRows = await sql`
                  SELECT COUNT(*) as total FROM invoices WHERE status = ${status} AND hospital_id = ${targetHospitalId}
                `;
                dataRows = await sql`
                  SELECT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                  FROM invoices i JOIN patients p ON i.patient_id = p.id
                  WHERE i.status = ${status} AND i.hospital_id = ${targetHospitalId}
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
            }
          } else {
            if (targetHospitalId !== null) {
              countRows =
                await sql`SELECT COUNT(*) as total FROM invoices WHERE hospital_id = ${targetHospitalId}`;
              dataRows = await sql`
                SELECT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM invoices i JOIN patients p ON i.patient_id = p.id
                WHERE i.hospital_id = ${targetHospitalId}
                ORDER BY i.created_at DESC LIMIT ${limit} OFFSET ${offset}
              `;
            } else {
              countRows = await sql`SELECT COUNT(*) as total FROM invoices`;
              dataRows = await sql`
                SELECT i.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM invoices i JOIN patients p ON i.patient_id = p.id
                ORDER BY i.created_at DESC LIMIT ${limit} OFFSET ${offset}
              `;
            }
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

      return res.status(405).json({ error: "Method not allowed" });
    }
  }
};
