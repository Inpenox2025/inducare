const { getSQL } = require('../shared/db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'hospital-management-jwt-secret-key-2026';

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const id = req.query.id;
  const sql = getSQL();

  // ══════ SINGLE APPOINTMENT OPERATIONS (if id is present) ══════
  if (id) {
    // GET: View single appointment details (joined with patient info)
    if (req.method === 'GET') {
      try {
        const rows = user.role === 'super_admin'
          ? await sql`
            SELECT a.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.id = ${parseInt(id)}
          `
          : await sql`
            SELECT a.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.id = ${parseInt(id)} AND a.hospital_id = ${user.hospital_id}
          `;
        if (rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
        return res.status(200).json({ success: true, appointment: rows[0] });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch appointment', details: error.message });
      }
    }

    // PUT: Update appointment details/status
    if (req.method === 'PUT') {
      try {
        const { doctor_name, appointment_date, appointment_time, status, purpose, fee } = req.body;
        if (!doctor_name || !appointment_date || !appointment_time) {
          return res.status(400).json({ error: 'Doctor name, date and time are required' });
        }

        const rows = user.role === 'super_admin'
          ? await sql`
            UPDATE appointments SET
              doctor_name = ${doctor_name},
              appointment_date = ${appointment_date},
              appointment_time = ${appointment_time},
              status = ${status || 'scheduled'},
              purpose = ${purpose || null},
              fee = ${fee || 0.00},
              updated_at = NOW()
            WHERE id = ${parseInt(id)}
            RETURNING *
          `
          : await sql`
            UPDATE appointments SET
              doctor_name = ${doctor_name},
              appointment_date = ${appointment_date},
              appointment_time = ${appointment_time},
              status = ${status || 'scheduled'},
              purpose = ${purpose || null},
              fee = ${fee || 0.00},
              updated_at = NOW()
            WHERE id = ${parseInt(id)} AND hospital_id = ${user.hospital_id}
            RETURNING *
          `;

        if (rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });

        // Update corresponding invoice if one exists for this appointment
        await sql`
          UPDATE invoices SET
            amount = ${fee || 0.00},
            due_amount = ${fee || 0.00} - paid_amount,
            status = CASE 
              WHEN paid_amount >= ${fee || 0.00} THEN 'paid'::varchar 
              WHEN paid_amount > 0 THEN 'partially_paid'::varchar
              ELSE 'unpaid'::varchar 
            END,
            updated_at = NOW()
          WHERE appointment_id = ${parseInt(id)} AND (hospital_id = ${user.hospital_id} OR ${user.role === 'super_admin'})
        `;

        return res.status(200).json({ success: true, appointment: rows[0] });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to update appointment', details: error.message });
      }
    }

    // DELETE: Delete appointment (Admin Only)
    if (req.method === 'DELETE') {
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied. Only administrators can delete appointments.' });
      }

      try {
        const rows = user.role === 'super_admin'
          ? await sql`DELETE FROM appointments WHERE id = ${parseInt(id)} RETURNING id`
          : await sql`DELETE FROM appointments WHERE id = ${parseInt(id)} AND hospital_id = ${user.hospital_id} RETURNING id`;
        if (rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
        return res.status(200).json({ success: true, message: 'Appointment deleted successfully' });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to delete appointment', details: error.message });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ══════ GENERAL COLLECTION OPERATIONS (if no id is present) ══════
  else {
    // POST: Schedule new appointment
    if (req.method === 'POST') {
      try {
        const { patient_id, doctor_name, appointment_date, appointment_time, status, purpose, fee, auto_invoice } = req.body;
        if (!patient_id || !doctor_name || !appointment_date || !appointment_time) {
          return res.status(400).json({ error: 'Patient ID, Doctor name, Date and Time are required' });
        }

        const patientIdInt = parseInt(patient_id);
        const hostId = user.role === 'super_admin' ? (req.body.hospital_id ? parseInt(req.body.hospital_id) : 1) : user.hospital_id;

        const rows = await sql`
          INSERT INTO appointments (
            patient_id, doctor_name, appointment_date, appointment_time, status, purpose, fee, created_by, hospital_id
          ) VALUES (
            ${patientIdInt}, ${doctor_name}, ${appointment_date}, ${appointment_time}, 
            ${status || 'scheduled'}, ${purpose || null}, ${fee || 0.00}, ${user.id}, ${hostId}
          ) RETURNING *
        `;

        const appointment = rows[0];

        // Generate automatic invoice/fee receipt if auto_invoice flag is true
        if (auto_invoice) {
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          const dateStr = `${year}${month}${day}`;

          const countRes = await sql`
            SELECT COUNT(*) as total 
            FROM invoices 
            WHERE hospital_id = ${hostId} 
              AND created_at >= CURRENT_DATE
          `;
          const countVal = parseInt(countRes[0].total);
          const invNo = `INSP${hostId}${dateStr}${countVal}`;
          const desc = `Consultation Fee receipt for appointment with ${doctor_name}`;
          
          const rawFee = parseFloat(fee) || 0.00;
          const hospRes = await sql`SELECT gst_no, gst_percent FROM hospitals WHERE id = ${hostId}`;
          const hosp = hospRes[0];
          
          let taxableAmt = rawFee;
          let gstAmt = 0.00;
          let gstRate = 0.00;
          let finalTotalAmt = rawFee;

          if (hosp && hosp.gst_no && hosp.gst_no.trim() !== "" && hosp.gst_percent && parseFloat(hosp.gst_percent) > 0) {
            gstRate = parseFloat(hosp.gst_percent);
            gstAmt = Math.round((rawFee * gstRate / 100) * 100) / 100;
            finalTotalAmt = rawFee + gstAmt;
          }

          await sql`
            INSERT INTO invoices (
              invoice_no, patient_id, appointment_id, description, amount, paid_amount, due_amount, status, created_by, hospital_id, taxable_amount, gst_amount, gst_rate
            ) VALUES (
              ${invNo}, ${patientIdInt}, ${appointment.id}, ${desc}, ${finalTotalAmt}, 0.00, ${finalTotalAmt}, 'unpaid', ${user.id}, ${hostId}, ${taxableAmt}, ${gstAmt}, ${gstRate}
            )
          `;
        }

        return res.status(201).json({ success: true, appointment });
      } catch (error) {
        console.error('Create appointment error:', error);
        return res.status(500).json({ error: 'Failed to schedule appointment', details: error.message });
      }
    }

    // GET: List and query appointments (supports: date=YYYY-MM-DD or today, search=text)
    if (req.method === 'GET') {
      try {
        const dateFilter = req.query.date;
        const search = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const offset = (page - 1) * limit;

        let countRows, dataRows;
        const targetHospitalId = user.role === 'super_admin' ? (req.query.hospital_id ? parseInt(req.query.hospital_id) : null) : user.hospital_id;

        if (dateFilter === 'today') {
          if (search) {
            const searchPattern = `%${search}%`;
            if (targetHospitalId !== null) {
              countRows = await sql`
                SELECT COUNT(*) as total FROM appointments a JOIN patients p ON a.patient_id = p.id
                WHERE a.appointment_date = CURRENT_DATE AND (p.full_name ILIKE ${searchPattern} OR p.mobile_no ILIKE ${searchPattern} OR a.doctor_name ILIKE ${searchPattern}) AND a.hospital_id = ${targetHospitalId}
              `;
              dataRows = await sql`
                SELECT a.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM appointments a JOIN patients p ON a.patient_id = p.id
                WHERE a.appointment_date = CURRENT_DATE AND (p.full_name ILIKE ${searchPattern} OR p.mobile_no ILIKE ${searchPattern} OR a.doctor_name ILIKE ${searchPattern}) AND a.hospital_id = ${targetHospitalId}
                ORDER BY a.appointment_time ASC LIMIT ${limit} OFFSET ${offset}
              `;
            } else {
              countRows = await sql`
                SELECT COUNT(*) as total FROM appointments a JOIN patients p ON a.patient_id = p.id
                WHERE a.appointment_date = CURRENT_DATE AND (p.full_name ILIKE ${searchPattern} OR p.mobile_no ILIKE ${searchPattern} OR a.doctor_name ILIKE ${searchPattern})
              `;
              dataRows = await sql`
                SELECT a.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM appointments a JOIN patients p ON a.patient_id = p.id
                WHERE a.appointment_date = CURRENT_DATE AND (p.full_name ILIKE ${searchPattern} OR p.mobile_no ILIKE ${searchPattern} OR a.doctor_name ILIKE ${searchPattern})
                ORDER BY a.appointment_time ASC LIMIT ${limit} OFFSET ${offset}
              `;
            }
          } else {
            if (targetHospitalId !== null) {
              countRows = await sql`
                SELECT COUNT(*) as total FROM appointments WHERE appointment_date = CURRENT_DATE AND hospital_id = ${targetHospitalId}
              `;
              dataRows = await sql`
                SELECT a.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM appointments a JOIN patients p ON a.patient_id = p.id
                WHERE a.appointment_date = CURRENT_DATE AND a.hospital_id = ${targetHospitalId}
                ORDER BY a.appointment_time ASC LIMIT ${limit} OFFSET ${offset}
              `;
            } else {
              countRows = await sql`
                SELECT COUNT(*) as total FROM appointments WHERE appointment_date = CURRENT_DATE
              `;
              dataRows = await sql`
                SELECT a.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM appointments a JOIN patients p ON a.patient_id = p.id
                WHERE a.appointment_date = CURRENT_DATE
                ORDER BY a.appointment_time ASC LIMIT ${limit} OFFSET ${offset}
              `;
            }
          }
        } else if (dateFilter && dateFilter !== '') {
          // Specific date
          if (search) {
            const searchPattern = `%${search}%`;
            if (targetHospitalId !== null) {
              countRows = await sql`
                SELECT COUNT(*) as total FROM appointments a JOIN patients p ON a.patient_id = p.id
                WHERE a.appointment_date = ${dateFilter}::date AND (p.full_name ILIKE ${searchPattern} OR p.mobile_no ILIKE ${searchPattern} OR a.doctor_name ILIKE ${searchPattern}) AND a.hospital_id = ${targetHospitalId}
              `;
              dataRows = await sql`
                SELECT a.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM appointments a JOIN patients p ON a.patient_id = p.id
                WHERE a.appointment_date = ${dateFilter}::date AND (p.full_name ILIKE ${searchPattern} OR p.mobile_no ILIKE ${searchPattern} OR a.doctor_name ILIKE ${searchPattern}) AND a.hospital_id = ${targetHospitalId}
                ORDER BY a.appointment_time ASC LIMIT ${limit} OFFSET ${offset}
              `;
            } else {
              countRows = await sql`
                SELECT COUNT(*) as total FROM appointments a JOIN patients p ON a.patient_id = p.id
                WHERE a.appointment_date = ${dateFilter}::date AND (p.full_name ILIKE ${searchPattern} OR p.mobile_no ILIKE ${searchPattern} OR a.doctor_name ILIKE ${searchPattern})
              `;
              dataRows = await sql`
                SELECT a.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM appointments a JOIN patients p ON a.patient_id = p.id
                WHERE a.appointment_date = ${dateFilter}::date AND (p.full_name ILIKE ${searchPattern} OR p.mobile_no ILIKE ${searchPattern} OR a.doctor_name ILIKE ${searchPattern})
                ORDER BY a.appointment_time ASC LIMIT ${limit} OFFSET ${offset}
              `;
            }
          } else {
            if (targetHospitalId !== null) {
              countRows = await sql`
                SELECT COUNT(*) as total FROM appointments WHERE appointment_date = ${dateFilter}::date AND hospital_id = ${targetHospitalId}
              `;
              dataRows = await sql`
                SELECT a.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM appointments a JOIN patients p ON a.patient_id = p.id
                WHERE a.appointment_date = ${dateFilter}::date AND a.hospital_id = ${targetHospitalId}
                ORDER BY a.appointment_time ASC LIMIT ${limit} OFFSET ${offset}
              `;
            } else {
              countRows = await sql`
                SELECT COUNT(*) as total FROM appointments WHERE appointment_date = ${dateFilter}::date
              `;
              dataRows = await sql`
                SELECT a.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM appointments a JOIN patients p ON a.patient_id = p.id
                WHERE a.appointment_date = ${dateFilter}::date
                ORDER BY a.appointment_time ASC LIMIT ${limit} OFFSET ${offset}
              `;
            }
          }
        } else {
          // No date filter
          if (search) {
            const searchPattern = `%${search}%`;
            if (targetHospitalId !== null) {
              countRows = await sql`
                SELECT COUNT(*) as total FROM appointments a JOIN patients p ON a.patient_id = p.id
                WHERE (p.full_name ILIKE ${searchPattern} OR p.mobile_no ILIKE ${searchPattern} OR a.doctor_name ILIKE ${searchPattern}) AND a.hospital_id = ${targetHospitalId}
              `;
              dataRows = await sql`
                SELECT a.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM appointments a JOIN patients p ON a.patient_id = p.id
                WHERE (p.full_name ILIKE ${searchPattern} OR p.mobile_no ILIKE ${searchPattern} OR a.doctor_name ILIKE ${searchPattern}) AND a.hospital_id = ${targetHospitalId}
                ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT ${limit} OFFSET ${offset}
              `;
            } else {
              countRows = await sql`
                SELECT COUNT(*) as total FROM appointments a JOIN patients p ON a.patient_id = p.id
                WHERE p.full_name ILIKE ${searchPattern} OR p.mobile_no ILIKE ${searchPattern} OR a.doctor_name ILIKE ${searchPattern}
              `;
              dataRows = await sql`
                SELECT a.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM appointments a JOIN patients p ON a.patient_id = p.id
                WHERE p.full_name ILIKE ${searchPattern} OR p.mobile_no ILIKE ${searchPattern} OR a.doctor_name ILIKE ${searchPattern}
                ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT ${limit} OFFSET ${offset}
              `;
            }
          } else {
            if (targetHospitalId !== null) {
              countRows = await sql`SELECT COUNT(*) as total FROM appointments WHERE hospital_id = ${targetHospitalId}`;
              dataRows = await sql`
                SELECT a.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM appointments a JOIN patients p ON a.patient_id = p.id
                WHERE a.hospital_id = ${targetHospitalId}
                ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT ${limit} OFFSET ${offset}
              `;
            } else {
              countRows = await sql`SELECT COUNT(*) as total FROM appointments`;
              dataRows = await sql`
                SELECT a.*, p.full_name as patient_name, p.mobile_no as patient_mobile 
                FROM appointments a JOIN patients p ON a.patient_id = p.id
                ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT ${limit} OFFSET ${offset}
              `;
            }
          }
        }

        const total = parseInt(countRows[0].total);
        const totalPages = Math.ceil(total / limit);

        return res.status(200).json({
          success: true,
          appointments: dataRows,
          pagination: { page, limit, total, totalPages }
        });
      } catch (error) {
        console.error('List appointments error:', error);
        return res.status(500).json({ error: 'Failed to fetch appointments', details: error.message });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }
};
