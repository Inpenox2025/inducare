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

async function recalculateAllocationInvoice(sql, allocationId) {
  try {
    const allocRes = await sql`
      SELECT ra.*, r.price_per_day, r.room_no, r.room_type, h.gst_percent, h.tax_name
      FROM room_allocations ra
      JOIN rooms r ON ra.room_id = r.id
      LEFT JOIN hospitals h ON ra.hospital_id = h.id
      WHERE ra.id = ${parseInt(allocationId)}
    `;
    if (allocRes.length === 0) return;
    const alloc = allocRes[0];

    const now = alloc.status === 'discharged' && alloc.discharged_at ? new Date(alloc.discharged_at) : new Date();
    const admit = new Date(alloc.admitted_at);
    const diffMs = now - admit;
    const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    let servicesTotal = 0.00;
    try {
      const servicesRes = await sql`
        SELECT COALESCE(SUM(price * quantity), 0) as total
        FROM allocation_services
        WHERE allocation_id = ${parseInt(allocationId)}
      `;
      servicesTotal = parseFloat(servicesRes[0].total) || 0.00;
    } catch (e) {
      console.error("allocation_services query error:", e);
    }

    const roomPrice = parseFloat(alloc.price_per_day) || 0.00;
    const newRawFee = (roomPrice * days) + servicesTotal;

    const invRes = await sql`SELECT * FROM invoices WHERE allocation_id = ${parseInt(allocationId)}`;
    if (invRes.length === 0) return;
    const inv = invRes[0];

    let newTaxableAmt = newRawFee;
    let newGstAmt = 0.00;
    let newGstRate = parseFloat(inv.gst_rate) || parseFloat(alloc.gst_percent) || 0.00;
    let newFinalTotalAmt = newRawFee;

    if (newGstRate > 0) {
      newGstAmt = Math.round((newRawFee * newGstRate / 100) * 100) / 100;
      newFinalTotalAmt = newRawFee + newGstAmt;
    }

    const paid = parseFloat(inv.paid_amount) || 0.00;
    const newDue = Math.max(0.00, newFinalTotalAmt - paid);
    let newStatus = inv.status;
    if (newDue <= 0) {
      newStatus = 'paid';
    } else if (paid > 0) {
      newStatus = 'partially_paid';
    } else {
      newStatus = 'unpaid';
    }

    let baseDesc = alloc.status === 'discharged' ? 'Final Discharge' : 'Active';
    let newDesc = `Room Charge (${baseDesc}: ${days} ${days === 1 ? 'Day' : 'Days'}) - Room ${alloc.room_no} (${alloc.room_type})`;
    if (servicesTotal > 0) {
      newDesc += ` + Patient Services (Treatment/Consumables)`;
    }

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
  } catch (error) {
    console.error("recalculateAllocationInvoice failure:", error);
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = getSQL();
  const id = req.query.id;
  const action = req.query.action || '';
  const targetHospitalId = user.role === 'super_admin' 
    ? (req.query.hospital_id ? parseInt(req.query.hospital_id) : (req.body && req.body.hospital_id ? parseInt(req.body.hospital_id) : null)) 
    : user.hospital_id;

  // ══════════════════════════════════════════════════════════
  // Action: Allocations (Admitting / Discharging Patients)
  // ══════════════════════════════════════════════════════════
  if (action === 'allocation') {
    // GET: List Active / Discharged allocations
    if (req.method === 'GET') {
      try {
        if (id) {
          const rows = targetHospitalId !== null
            ? await sql`
              SELECT ra.*, p.full_name as patient_name, r.room_no, r.room_type
              FROM room_allocations ra
              JOIN patients p ON ra.patient_id = p.id
              JOIN rooms r ON ra.room_id = r.id
              WHERE ra.id = ${parseInt(id)} AND ra.hospital_id = ${targetHospitalId}
            `
            : await sql`
              SELECT ra.*, p.full_name as patient_name, r.room_no, r.room_type
              FROM room_allocations ra
              JOIN patients p ON ra.patient_id = p.id
              JOIN rooms r ON ra.room_id = r.id
              WHERE ra.id = ${parseInt(id)}
            `;
          if (rows.length === 0) return res.status(404).json({ error: 'Allocation not found' });
          return res.status(200).json({ success: true, allocation: rows[0] });
        } else {
          const filterStatus = req.query.status;
          let rows;
          if (targetHospitalId !== null) {
            if (filterStatus) {
              rows = await sql`
                SELECT ra.*, p.full_name as patient_name, r.room_no, r.room_type
                FROM room_allocations ra
                JOIN patients p ON ra.patient_id = p.id
                JOIN rooms r ON ra.room_id = r.id
                WHERE ra.hospital_id = ${targetHospitalId} AND ra.status = ${filterStatus}
                ORDER BY ra.admitted_at DESC
              `;
            } else {
              rows = await sql`
                SELECT ra.*, p.full_name as patient_name, r.room_no, r.room_type
                FROM room_allocations ra
                JOIN patients p ON ra.patient_id = p.id
                JOIN rooms r ON ra.room_id = r.id
                WHERE ra.hospital_id = ${targetHospitalId}
                ORDER BY ra.status ASC, ra.admitted_at DESC
              `;
            }
          } else {
            if (filterStatus) {
              rows = await sql`
                SELECT ra.*, p.full_name as patient_name, r.room_no, r.room_type
                FROM room_allocations ra
                JOIN patients p ON ra.patient_id = p.id
                JOIN rooms r ON ra.room_id = r.id
                WHERE ra.status = ${filterStatus}
                ORDER BY ra.admitted_at DESC
              `;
            } else {
              rows = await sql`
                SELECT ra.*, p.full_name as patient_name, r.room_no, r.room_type
                FROM room_allocations ra
                JOIN patients p ON ra.patient_id = p.id
                JOIN rooms r ON ra.room_id = r.id
                ORDER BY ra.status ASC, ra.admitted_at DESC
              `;
            }
          }
          return res.status(200).json({ success: true, allocations: rows });
        }
      } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch allocations', details: error.message });
      }
    }

    // POST: Allocate room (Admit Patient)
    if (req.method === 'POST') {
      try {
        const { room_id, patient_id } = req.body;
        if (!room_id || !patient_id) {
          return res.status(400).json({ error: 'Room ID and Patient ID are required' });
        }

        const hostId = targetHospitalId || 1;

        // Verify if the patient is already admitted actively
        const activePatientCheck = await sql`
          SELECT id FROM room_allocations 
          WHERE patient_id = ${parseInt(patient_id)} AND status = 'active' AND hospital_id = ${hostId}
        `;
        if (activePatientCheck.length > 0) {
          return res.status(400).json({ error: 'Patient is already admitted to another room actively' });
        }

        // Verify room availability and capacity
        const roomCheck = await sql`SELECT status, capacity, room_no, room_type, price_per_day FROM rooms WHERE id = ${parseInt(room_id)} AND hospital_id = ${hostId}`;
        if (roomCheck.length === 0) return res.status(404).json({ error: 'Room not found in your hospital' });
        if (roomCheck[0].status === 'maintenance') {
          return res.status(400).json({ error: 'Room is under maintenance' });
        }

        const capacity = parseInt(roomCheck[0].capacity) || 1;
        const activeCountRes = await sql`
          SELECT COUNT(*) as count FROM room_allocations 
          WHERE room_id = ${parseInt(room_id)} AND status = 'active'
        `;
        const activeCount = parseInt(activeCountRes[0].count);

        if (activeCount >= capacity) {
          return res.status(400).json({ error: 'Room capacity is full' });
        }

        const room = roomCheck[0];

        // Retrieve hospital details for tax settings
        const hospRes = await sql`SELECT gst_no, gst_percent, tax_name FROM hospitals WHERE id = ${hostId}`;
        const hosp = hospRes[0];

        const rawFee = parseFloat(room.price_per_day) || 0.00;
        let taxableAmt = rawFee;
        let gstAmt = 0.00;
        let gstRate = 0.00;
        let finalTotalAmt = rawFee;
        const taxNameVal = hosp && hosp.tax_name ? hosp.tax_name.trim() : 'GST';

        if (hosp && hosp.gst_no && hosp.gst_no.trim() !== "" && hosp.gst_percent && parseFloat(hosp.gst_percent) > 0) {
          gstRate = parseFloat(hosp.gst_percent);
          gstAmt = Math.round((rawFee * gstRate / 100) * 100) / 100;
          finalTotalAmt = rawFee + gstAmt;
        }

        // Generate serial for room invoice
        const countRes = await sql`SELECT count(*) as count FROM invoices WHERE hospital_id = ${hostId}`;
        const countVal = parseInt(countRes[0].count) + 1;
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
        const invNo = `INSP${hostId}${dateStr}${countVal}`;

        // Create allocation record
        const allocation = await sql`
          INSERT INTO room_allocations (room_id, patient_id, admitted_at, status, hospital_id)
          VALUES (${parseInt(room_id)}, ${parseInt(patient_id)}, NOW(), 'active', ${hostId})
          RETURNING *
        `;
        const allocId = allocation[0].id;

        // Insert initial room invoice
        const desc = `Room Charge (Active: 1 Day) - Room ${room.room_no} (${room.room_type})`;
        await sql`
          INSERT INTO invoices (
            invoice_no, patient_id, description, amount, paid_amount, due_amount, status, created_by, hospital_id, taxable_amount, gst_amount, gst_rate, tax_name, allocation_id
          ) VALUES (
            ${invNo}, ${parseInt(patient_id)}, ${desc}, ${finalTotalAmt}, 0.00, ${finalTotalAmt}, 'unpaid', ${user.id}, ${hostId}, ${taxableAmt}, ${gstAmt}, ${gstRate}, ${taxNameVal}, ${allocId}
          )
        `;

        // Update room status to occupied if capacity is reached
        if (activeCount + 1 >= capacity) {
          await sql`UPDATE rooms SET status = 'occupied' WHERE id = ${parseInt(room_id)} AND hospital_id = ${hostId}`;
        } else {
          await sql`UPDATE rooms SET status = 'available' WHERE id = ${parseInt(room_id)} AND hospital_id = ${hostId}`;
        }

        return res.status(201).json({ success: true, allocation: allocation[0] });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to allocate room', details: error.message });
      }
    }

    // PUT: Discharge Patient
    if (req.method === 'PUT') {
      try {
        if (!id) return res.status(400).json({ error: 'Allocation ID is required' });

        const hostId = targetHospitalId;

        // Retrieve the allocation
        const rows = hostId !== null
          ? await sql`SELECT * FROM room_allocations WHERE id = ${parseInt(id)} AND hospital_id = ${hostId}`
          : await sql`SELECT * FROM room_allocations WHERE id = ${parseInt(id)}`;
        
        if (rows.length === 0) return res.status(404).json({ error: 'Allocation not found' });
        const alloc = rows[0];

        if (alloc.status === 'discharged') {
          return res.status(400).json({ error: 'Patient is already discharged from this allocation' });
        }

        // Set discharged details
        const updated = await sql`
          UPDATE room_allocations SET
            discharged_at = NOW(),
            status = 'discharged'
          WHERE id = ${parseInt(id)}
          RETURNING *
        `;
        const finalAlloc = updated[0];

        // Recalculate invoice including any services added
        await recalculateAllocationInvoice(sql, finalAlloc.id);

        // Recalculate room availability based on active count and capacity
        const remainingActiveRes = await sql`
          SELECT COUNT(*) as count FROM room_allocations
          WHERE room_id = ${finalAlloc.room_id} AND status = 'active'
        `;
        const remainingActive = parseInt(remainingActiveRes[0].count);

        const roomCheck = await sql`SELECT capacity FROM rooms WHERE id = ${finalAlloc.room_id}`;
        const capacity = roomCheck.length > 0 ? (parseInt(roomCheck[0].capacity) || 1) : 1;

        if (remainingActive < capacity) {
          await sql`UPDATE rooms SET status = 'available' WHERE id = ${alloc.room_id}`;
        }

        return res.status(200).json({ success: true, allocation: updated[0] });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to discharge patient', details: error.message });
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // Action: Doctor Visits (Logging visits in room)
  // ══════════════════════════════════════════════════════════
  else if (action === 'visit') {
    // GET: List visits
    if (req.method === 'GET') {
      try {
        const queryAllocation = req.query.allocation_id;
        let rows;
        if (queryAllocation) {
          rows = targetHospitalId !== null
            ? await sql`
              SELECT dv.*, d.name as doctor_name, d.specialization as doctor_specialization
              FROM doctor_visits dv
              JOIN doctors d ON dv.doctor_id = d.id
              WHERE dv.allocation_id = ${parseInt(queryAllocation)} AND dv.hospital_id = ${targetHospitalId}
              ORDER BY dv.visit_date DESC
            `
            : await sql`
              SELECT dv.*, d.name as doctor_name, d.specialization as doctor_specialization
              FROM doctor_visits dv
              JOIN doctors d ON dv.doctor_id = d.id
              WHERE dv.allocation_id = ${parseInt(queryAllocation)}
              ORDER BY dv.visit_date DESC
            `;
        } else {
          rows = targetHospitalId !== null
            ? await sql`
              SELECT dv.*, d.name as doctor_name, d.specialization as doctor_specialization, p.full_name as patient_name, r.room_no
              FROM doctor_visits dv
              JOIN doctors d ON dv.doctor_id = d.id
              JOIN room_allocations ra ON dv.allocation_id = ra.id
              JOIN patients p ON ra.patient_id = p.id
              JOIN rooms r ON ra.room_id = r.id
              WHERE dv.hospital_id = ${targetHospitalId}
              ORDER BY dv.visit_date DESC
            `
            : await sql`
              SELECT dv.*, d.name as doctor_name, d.specialization as doctor_specialization, p.full_name as patient_name, r.room_no
              FROM doctor_visits dv
              JOIN doctors d ON dv.doctor_id = d.id
              JOIN room_allocations ra ON dv.allocation_id = ra.id
              JOIN patients p ON ra.patient_id = p.id
              JOIN rooms r ON ra.room_id = r.id
              ORDER BY dv.visit_date DESC
            `;
        }
        return res.status(200).json({ success: true, visits: rows });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch doctor visits', details: error.message });
      }
    }

    // POST: Log a Doctor Visit (Syncs to relational database + updates patient case sheet)
    if (req.method === 'POST') {
      try {
        const { allocation_id, doctor_id, clinical_notes, temperature, blood_pressure, heart_rate } = req.body;
        if (!allocation_id || !doctor_id) {
          return res.status(400).json({ error: 'Allocation ID and Doctor ID are required' });
        }

        const hostId = targetHospitalId || 1;

        // Verify allocation existence and state
        const allocRows = await sql`
          SELECT ra.*, p.case_sheet_data, p.id as patient_id
          FROM room_allocations ra
          JOIN patients p ON ra.patient_id = p.id
          WHERE ra.id = ${parseInt(allocation_id)} AND ra.hospital_id = ${hostId}
        `;
        if (allocRows.length === 0) return res.status(404).json({ error: 'Active room allocation not found in your hospital' });
        const allocation = allocRows[0];

        // Fetch doctor info
        const docRows = await sql`SELECT name, specialization FROM doctors WHERE id = ${parseInt(doctor_id)} AND hospital_id = ${hostId}`;
        if (docRows.length === 0) return res.status(404).json({ error: 'Doctor not found in your hospital' });
        const doctorName = docRows[0].name;
        const doctorSpec = docRows[0].specialization;

        // Log the visit in relation table
        const visit = await sql`
          INSERT INTO doctor_visits (allocation_id, doctor_id, visit_date, clinical_notes, temperature, blood_pressure, heart_rate, status, hospital_id)
          VALUES (${parseInt(allocation_id)}, ${parseInt(doctor_id)}, NOW(), ${clinical_notes || null}, ${temperature || null}, ${blood_pressure || null}, ${heart_rate || null}, 'completed', ${hostId})
          RETURNING *
        `;

        // UPDATE PATIENT'S CASE SHEET JSON DATA
        let caseSheet = {};
        if (allocation.case_sheet_data) {
          try {
            caseSheet = JSON.parse(allocation.case_sheet_data);
          } catch (e) {
            caseSheet = {};
          }
        }

        // Initialize doctor_visits array inside case sheet if it does not exist
        if (!caseSheet.doctor_visits || !Array.isArray(caseSheet.doctor_visits)) {
          caseSheet.doctor_visits = [];
        }

        // Push new visit log
        caseSheet.doctor_visits.push({
          visit_date: new Date().toISOString(),
          doctor_name: doctorName,
          specialization: doctorSpec,
          notes: clinical_notes || 'Routine checkup completed',
          temp: temperature || 'Normal',
          bp: blood_pressure || 'Normal',
          hr: heart_rate || 'Normal'
        });

        // Save updated case sheet to the database
        await sql`
          UPDATE patients 
          SET case_sheet_data = ${JSON.stringify(caseSheet)}, updated_at = NOW() 
          WHERE id = ${allocation.patient_id} AND hospital_id = ${hostId}
        `;

        return res.status(201).json({ success: true, visit: visit[0] });
      } catch (error) {
        console.error('Failed to log doctor visit:', error);
        return res.status(500).json({ error: 'Failed to record doctor visit', details: error.message });
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // Action: Services (Adding/Listing/Removing patient services under rooms)
  // ══════════════════════════════════════════════════════════
  else if (action === 'services') {
    if (req.method === 'GET') {
      try {
        const allocId = req.query.allocation_id;
        if (!allocId) return res.status(400).json({ error: 'Allocation ID is required' });
        const rows = await sql`
          SELECT * FROM allocation_services 
          WHERE allocation_id = ${parseInt(allocId)} 
          ORDER BY id ASC
        `;
        return res.status(200).json({ success: true, services: rows });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch services', details: error.message });
      }
    }

    if (req.method === 'POST') {
      try {
        const { allocation_id, service_name, price, quantity } = req.body;
        if (!allocation_id || !service_name || price === undefined) {
          return res.status(400).json({ error: 'Allocation ID, service name, and price are required' });
        }
        const hostId = targetHospitalId || 1;
        const rows = await sql`
          INSERT INTO allocation_services (allocation_id, service_name, price, quantity, hospital_id)
          VALUES (${parseInt(allocation_id)}, ${service_name.trim()}, ${parseFloat(price)}, ${quantity ? parseInt(quantity) : 1}, ${hostId})
          RETURNING *
        `;
        
        // Recalculate invoice total
        await recalculateAllocationInvoice(sql, allocation_id);

        return res.status(201).json({ success: true, service: rows[0] });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to add service', details: error.message });
      }
    }

    if (req.method === 'DELETE') {
      try {
        if (!id) return res.status(400).json({ error: 'Service ID is required' });
        
        // Find allocation_id before deleting
        const check = await sql`SELECT allocation_id FROM allocation_services WHERE id = ${parseInt(id)}`;
        if (check.length === 0) return res.status(404).json({ error: 'Service item not found' });
        const allocId = check[0].allocation_id;

        await sql`DELETE FROM allocation_services WHERE id = ${parseInt(id)}`;

        // Recalculate invoice total
        await recalculateAllocationInvoice(sql, allocId);

        return res.status(200).json({ success: true, message: 'Service item removed successfully' });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to delete service', details: error.message });
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // DEFAULT: Rooms inventory CRUD
  // ══════════════════════════════════════════════════════════
  else {
    if (id) {
      if (req.method === 'GET') {
        try {
          const rows = targetHospitalId !== null
            ? await sql`
              SELECT r.*, 
                     (SELECT COUNT(*) FROM room_allocations WHERE room_id = r.id AND status = 'active') as active_count
              FROM rooms r 
              WHERE r.id = ${parseInt(id)} AND r.hospital_id = ${targetHospitalId}
            `
            : await sql`
              SELECT r.*, 
                     (SELECT COUNT(*) FROM room_allocations WHERE room_id = r.id AND status = 'active') as active_count
              FROM rooms r 
              WHERE r.id = ${parseInt(id)}
            `;
          if (rows.length === 0) return res.status(404).json({ error: 'Room not found' });
          return res.status(200).json({ success: true, room: rows[0] });
        } catch (error) {
          return res.status(500).json({ error: 'Failed to fetch room details', details: error.message });
        }
      }

      // Require Super Admin permissions to modify room inventory
      if (user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied. Super Administrator privileges required.' });
      }

      if (req.method === 'PUT') {
        try {
          const { room_no, room_type, status, price_per_day, hospital_id, capacity } = req.body;
          if (!room_no) return res.status(400).json({ error: 'Room number is required' });

          const hostId = hospital_id ? parseInt(hospital_id) : (targetHospitalId || 1);

          const rows = await sql`
            UPDATE rooms SET
              room_no = ${room_no.trim()},
              room_type = ${room_type ? room_type.trim() : null},
              status = ${status || 'available'},
              price_per_day = ${price_per_day || 0.00},
              capacity = ${capacity ? parseInt(capacity) : 1},
              hospital_id = ${hostId},
              updated_at = NOW()
            WHERE id = ${parseInt(id)}
            RETURNING *
          `;
          if (rows.length === 0) return res.status(404).json({ error: 'Room not found' });
          return res.status(200).json({ success: true, room: rows[0] });
        } catch (error) {
          return res.status(500).json({ error: 'Failed to update room details', details: error.message });
        }
      }

      if (req.method === 'DELETE') {
        try {
          const rows = await sql`DELETE FROM rooms WHERE id = ${parseInt(id)} RETURNING id`;
          if (rows.length === 0) return res.status(404).json({ error: 'Room not found' });
          return res.status(200).json({ success: true, message: 'Room removed from inventory successfully' });
        } catch (error) {
          return res.status(500).json({ error: 'Failed to remove room', details: error.message });
        }
      }
    }

    // Bulk operations
    else {
      if (req.method === 'GET') {
        try {
          const query = req.query.search || '';
          let rows;
          if (query) {
            const searchPattern = `%${query.trim()}%`;
            rows = targetHospitalId !== null
              ? await sql`
                SELECT r.*, 
                       (SELECT COUNT(*) FROM room_allocations WHERE room_id = r.id AND status = 'active') as active_count
                FROM rooms r 
                WHERE (r.room_no ILIKE ${searchPattern} OR r.room_type ILIKE ${searchPattern})
                  AND r.hospital_id = ${targetHospitalId}
                ORDER BY r.room_no ASC
              `
              : await sql`
                SELECT r.*, 
                       (SELECT COUNT(*) FROM room_allocations WHERE room_id = r.id AND status = 'active') as active_count
                FROM rooms r 
                WHERE r.room_no ILIKE ${searchPattern} OR r.room_type ILIKE ${searchPattern}
                ORDER BY r.room_no ASC
              `;
          } else {
            rows = targetHospitalId !== null
              ? await sql`
                SELECT r.*, 
                       (SELECT COUNT(*) FROM room_allocations WHERE room_id = r.id AND status = 'active') as active_count
                FROM rooms r 
                WHERE r.hospital_id = ${targetHospitalId} 
                ORDER BY r.room_no ASC
              `
              : await sql`
                SELECT r.*, 
                       (SELECT COUNT(*) FROM room_allocations WHERE room_id = r.id AND status = 'active') as active_count
                FROM rooms r 
                ORDER BY r.room_no ASC
              `;
          }
          return res.status(200).json({ success: true, rooms: rows });
        } catch (error) {
          return res.status(500).json({ error: 'Failed to load rooms list', details: error.message });
        }
      }

      // Require Super Admin permissions to modify room inventory
      if (user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied. Super Administrator privileges required.' });
      }

      if (req.method === 'POST') {
        try {
          const { room_no, room_type, status, price_per_day, capacity } = req.body;
          if (!room_no) return res.status(400).json({ error: 'Room number is required' });

          const hostId = targetHospitalId || 1;

          // Verify room no unique inside this hospital
          const checkDup = await sql`SELECT id FROM rooms WHERE room_no = ${room_no.trim()} AND hospital_id = ${hostId}`;
          if (checkDup.length > 0) return res.status(400).json({ error: 'Room number already exists in this hospital' });

          const rows = await sql`
            INSERT INTO rooms (room_no, room_type, status, price_per_day, hospital_id, capacity)
            VALUES (${room_no.trim()}, ${room_type ? room_type.trim() : null}, ${status || 'available'}, ${price_per_day || 0.00}, ${hostId}, ${capacity ? parseInt(capacity) : 1})
            RETURNING *
          `;
          return res.status(201).json({ success: true, room: rows[0] });
        } catch (error) {
          return res.status(500).json({ error: 'Failed to register room in inventory', details: error.message });
        }
      }
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
