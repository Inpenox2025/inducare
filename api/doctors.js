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

  // ══════ SINGLE DOCTOR OPERATIONS (if id is present) ══════
  if (id) {
    if (req.method === 'GET') {
      try {
        const rows = await sql`SELECT * FROM doctors WHERE id = ${parseInt(id)}`;
        if (rows.length === 0) return res.status(404).json({ error: 'Doctor not found' });
        return res.status(200).json({ success: true, doctor: rows[0] });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch doctor', details: error.message });
      }
    }

    // Require admin privileges for write operations
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }

    if (req.method === 'PUT') {
      try {
        const { name, specialization, phone, email, fee } = req.body;
        if (!name) return res.status(400).json({ error: 'Doctor name is required' });

        const rows = await sql`
          UPDATE doctors SET
            name = ${name.trim()},
            specialization = ${specialization ? specialization.trim() : null},
            phone = ${phone ? phone.trim() : null},
            email = ${email ? email.trim() : null},
            fee = ${fee || 0.00},
            updated_at = NOW()
          WHERE id = ${parseInt(id)}
          RETURNING *
        `;

        if (rows.length === 0) return res.status(404).json({ error: 'Doctor not found' });
        return res.status(200).json({ success: true, doctor: rows[0] });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to update doctor', details: error.message });
      }
    }

    if (req.method === 'DELETE') {
      try {
        const rows = await sql`DELETE FROM doctors WHERE id = ${parseInt(id)} RETURNING id`;
        if (rows.length === 0) return res.status(404).json({ error: 'Doctor not found' });
        return res.status(200).json({ success: true, message: 'Doctor deleted successfully' });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to delete doctor', details: error.message });
      }
    }
  }

  // ══════ BULK DOCTOR OPERATIONS (if id is not present) ══════
  else {
    if (req.method === 'GET') {
      try {
        const query = req.query.search || '';
        let rows;
        if (query) {
          const searchPattern = `%${query.trim()}%`;
          rows = await sql`
            SELECT * FROM doctors 
            WHERE name ILIKE ${searchPattern} 
               OR specialization ILIKE ${searchPattern}
            ORDER BY name ASC
          `;
        } else {
          rows = await sql`SELECT * FROM doctors ORDER BY name ASC`;
        }
        return res.status(200).json({ success: true, doctors: rows });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to list doctors', details: error.message });
      }
    }

    // Require admin privileges for write operations
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }

    if (req.method === 'POST') {
      try {
        const { name, specialization, phone, email, fee } = req.body;
        if (!name) return res.status(400).json({ error: 'Doctor name is required' });

        const rows = await sql`
          INSERT INTO doctors (name, specialization, phone, email, fee)
          VALUES (${name.trim()}, ${specialization ? specialization.trim() : null}, ${phone ? phone.trim() : null}, ${email ? email.trim() : null}, ${fee || 0.00})
          RETURNING *
        `;
        return res.status(201).json({ success: true, doctor: rows[0] });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to create doctor', details: error.message });
      }
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
