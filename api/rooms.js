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

  const sql = getSQL();
  const id = req.query.id;
  const action = req.query.action || '';
  const targetHospitalId = user.role === 'super_admin' ? (req.query.hospital_id ? parseInt(req.query.hospital_id) : null) : user.hospital_id;

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
          // List allocations, order by active status first, then admit date
          const rows = targetHospitalId !== null
            ? await sql`
              SELECT ra.*, p.full_name as patient_name, r.room_no, r.room_type
              FROM room_allocations ra
              JOIN patients p ON ra.patient_id = p.id
              JOIN rooms r ON ra.room_id = r.id
              WHERE ra.hospital_id = ${targetHospitalId}
              ORDER BY ra.status ASC, ra.admitted_at DESC
            `
            : await sql`
              SELECT ra.*, p.full_name as patient_name, r.room_no, r.room_type
              FROM room_allocations ra
              JOIN patients p ON ra.patient_id = p.id
              JOIN rooms r ON ra.room_id = r.id
              ORDER BY ra.status ASC, ra.admitted_at DESC
            `;
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

        // Verify room availability
        const roomCheck = await sql`SELECT status FROM rooms WHERE id = ${parseInt(room_id)} AND hospital_id = ${hostId}`;
        if (roomCheck.length === 0) return res.status(404).json({ error: 'Room not found in your hospital' });
        if (roomCheck[0].status !== 'available') {
          return res.status(400).json({ error: 'Room is occupied or under maintenance' });
        }

        // Create allocation record
        const allocation = await sql`
          INSERT INTO room_allocations (room_id, patient_id, admitted_at, status, hospital_id)
          VALUES (${parseInt(room_id)}, ${parseInt(patient_id)}, NOW(), 'active', ${hostId})
          RETURNING *
        `;

        // Update room status to occupied
        await sql`UPDATE rooms SET status = 'occupied' WHERE id = ${parseInt(room_id)} AND hospital_id = ${hostId}`;

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

        // Revert room status to available
        await sql`UPDATE rooms SET status = 'available' WHERE id = ${alloc.room_id}`;

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
  // DEFAULT: Rooms inventory CRUD
  // ══════════════════════════════════════════════════════════
  else {
    if (id) {
      if (req.method === 'GET') {
        try {
          const rows = targetHospitalId !== null
            ? await sql`SELECT * FROM rooms WHERE id = ${parseInt(id)} AND hospital_id = ${targetHospitalId}`
            : await sql`SELECT * FROM rooms WHERE id = ${parseInt(id)}`;
          if (rows.length === 0) return res.status(404).json({ error: 'Room not found' });
          return res.status(200).json({ success: true, room: rows[0] });
        } catch (error) {
          return res.status(500).json({ error: 'Failed to fetch room details', details: error.message });
        }
      }

      // Require admin permissions to modify room inventory
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
      }

      if (req.method === 'PUT') {
        try {
          const { room_no, room_type, status, price_per_day } = req.body;
          if (!room_no) return res.status(400).json({ error: 'Room number is required' });

          const rows = targetHospitalId !== null
            ? await sql`
              UPDATE rooms SET
                room_no = ${room_no.trim()},
                room_type = ${room_type ? room_type.trim() : null},
                status = ${status || 'available'},
                price_per_day = ${price_per_day || 0.00},
                updated_at = NOW()
              WHERE id = ${parseInt(id)} AND hospital_id = ${targetHospitalId}
              RETURNING *
            `
            : await sql`
              UPDATE rooms SET
                room_no = ${room_no.trim()},
                room_type = ${room_type ? room_type.trim() : null},
                status = ${status || 'available'},
                price_per_day = ${price_per_day || 0.00},
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
          const rows = targetHospitalId !== null
            ? await sql`DELETE FROM rooms WHERE id = ${parseInt(id)} AND hospital_id = ${targetHospitalId} RETURNING id`
            : await sql`DELETE FROM rooms WHERE id = ${parseInt(id)} RETURNING id`;
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
                SELECT * FROM rooms 
                WHERE (room_no ILIKE ${searchPattern} OR room_type ILIKE ${searchPattern})
                  AND hospital_id = ${targetHospitalId}
                ORDER BY room_no ASC
              `
              : await sql`
                SELECT * FROM rooms 
                WHERE room_no ILIKE ${searchPattern} OR room_type ILIKE ${searchPattern}
                ORDER BY room_no ASC
              `;
          } else {
            rows = targetHospitalId !== null
              ? await sql`SELECT * FROM rooms WHERE hospital_id = ${targetHospitalId} ORDER BY room_no ASC`
              : await sql`SELECT * FROM rooms ORDER BY room_no ASC`;
          }
          return res.status(200).json({ success: true, rooms: rows });
        } catch (error) {
          return res.status(500).json({ error: 'Failed to load rooms list', details: error.message });
        }
      }

      // Require admin permissions to modify room inventory
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
      }

      if (req.method === 'POST') {
        try {
          const { room_no, room_type, status, price_per_day } = req.body;
          if (!room_no) return res.status(400).json({ error: 'Room number is required' });

          const hostId = targetHospitalId || 1;

          // Verify room no unique inside this hospital
          const checkDup = await sql`SELECT id FROM rooms WHERE room_no = ${room_no.trim()} AND hospital_id = ${hostId}`;
          if (checkDup.length > 0) return res.status(400).json({ error: 'Room number already exists in this hospital' });

          const rows = await sql`
            INSERT INTO rooms (room_no, room_type, status, price_per_day, hospital_id)
            VALUES (${room_no.trim()}, ${room_type ? room_type.trim() : null}, ${status || 'available'}, ${price_per_day || 0.00}, ${hostId})
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
