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
  if (!user && req.method !== 'POST') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const id = req.query.id;
  const sql = getSQL();

  // Run soft migration to ensure the case_sheet_data column exists
  try {
    await sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS case_sheet_data TEXT`;
  } catch (e) {
    console.error("Migration error (can be ignored):", e);
  }

  // ══════ SINGLE PATIENT OPERATIONS (if id is present) ══════
  if (id) {
    // GET: View single patient
    if (req.method === 'GET') {
      try {
        const rows = await sql`SELECT * FROM patients WHERE id = ${parseInt(id)}`;
        if (rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
        return res.status(200).json({ success: true, patient: rows[0] });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch patient', details: error.message });
      }
    }

    // PUT: Edit patient details (Both Nurse & Admin)
    if (req.method === 'PUT') {
      try {
        const { full_name, date_of_birth, gender, mobile_no, email, address, medical_history, case_sheet_data } = req.body;
        if (!full_name) {
          return res.status(400).json({ error: 'Full name is required' });
        }

        const rows = await sql`
          UPDATE patients SET
            full_name = ${full_name},
            date_of_birth = ${date_of_birth || null},
            gender = ${gender || null},
            mobile_no = ${mobile_no || null},
            email = ${email || null},
            address = ${address || null},
            medical_history = ${medical_history || null},
            case_sheet_data = ${case_sheet_data || null},
            updated_at = NOW()
          WHERE id = ${parseInt(id)}
          RETURNING *
        `;

        if (rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
        return res.status(200).json({ success: true, patient: rows[0] });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to update patient', details: error.message });
      }
    }

    // DELETE: Delete patient (Admin Only)
    if (req.method === 'DELETE') {
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Only administrators can delete patient files.' });
      }

      try {
        const rows = await sql`DELETE FROM patients WHERE id = ${parseInt(id)} RETURNING id`;
        if (rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
        return res.status(200).json({ success: true, message: 'Patient profile deleted successfully' });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to delete patient', details: error.message });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ══════ GENERAL COLLECTION OPERATIONS (if no id is present) ══════
  else {
    // POST: Add new patient (Nurse & Admin)
    if (req.method === 'POST') {
      try {
        const { full_name, date_of_birth, gender, mobile_no, email, address, medical_history, case_sheet_data } = req.body;
        if (!full_name) {
          return res.status(400).json({ error: 'Full name is required' });
        }

        const rows = await sql`
          INSERT INTO patients (
            full_name, date_of_birth, gender, mobile_no, email, address, medical_history, case_sheet_data, created_by
          ) VALUES (
            ${full_name}, ${date_of_birth || null}, ${gender || null}, ${mobile_no || null}, 
            ${email || null}, ${address || null}, ${medical_history || null}, ${case_sheet_data || null}, ${user ? user.id : null}
          ) RETURNING *
        `;

        return res.status(201).json({ success: true, patient: rows[0] });
      } catch (error) {
        console.error('Create patient error:', error);
        return res.status(500).json({ error: 'Failed to add patient', details: error.message });
      }
    }

    // GET: List/search patients with pagination (Nurse & Admin)
    if (req.method === 'GET') {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        let countRows, dataRows;

        if (search) {
          const searchPattern = `%${search}%`;
          countRows = await sql`
            SELECT COUNT(*) as total FROM patients 
            WHERE full_name ILIKE ${searchPattern} 
               OR mobile_no ILIKE ${searchPattern} 
               OR medical_history ILIKE ${searchPattern}
          `;
          dataRows = await sql`
            SELECT * FROM patients 
            WHERE full_name ILIKE ${searchPattern} 
               OR mobile_no ILIKE ${searchPattern} 
               OR medical_history ILIKE ${searchPattern}
            ORDER BY created_at DESC 
            LIMIT ${limit} OFFSET ${offset}
          `;
        } else {
          countRows = await sql`SELECT COUNT(*) as total FROM patients`;
          dataRows = await sql`
            SELECT * FROM patients 
            ORDER BY created_at DESC 
            LIMIT ${limit} OFFSET ${offset}
          `;
        }

        const total = parseInt(countRows[0].total);
        const totalPages = Math.ceil(total / limit);

        return res.status(200).json({
          success: true,
          patients: dataRows,
          pagination: { page, limit, total, totalPages }
        });
      } catch (error) {
        console.error('List patients error:', error);
        return res.status(500).json({ error: 'Failed to fetch patients', details: error.message });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }
};
