const { getSQL } = require('../shared/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'hospital-management-jwt-secret-key-2026';

function verifyAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') return null;
    return decoded;
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const adminUser = verifyAdmin(req);
  if (!adminUser) {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }

  const id = req.query.id;
  const sql = getSQL();

  // ══════ GET: List Users or View Single User ══════
  if (req.method === 'GET') {
    try {
      if (id) {
        const rows = await sql`SELECT id, username, email, phone, role, hospital_id, created_at FROM users WHERE id = ${id}`;
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
        
        // Block hospital admin from viewing users of other hospitals or Super Admin (which has hospital_id NULL)
        if (adminUser.role !== 'super_admin') {
          if (rows[0].hospital_id !== adminUser.hospital_id) {
            return res.status(403).json({ error: 'Access denied.' });
          }
        }
        return res.status(200).json({ success: true, user: rows[0] });
      } else {
        const queryHosp = req.query.hospital_id;
        const rows = adminUser.role === 'super_admin'
          ? (queryHosp ? await sql`SELECT id, username, email, phone, role, hospital_id, created_at FROM users WHERE hospital_id = ${parseInt(queryHosp)} ORDER BY created_at DESC` : await sql`SELECT id, username, email, phone, role, hospital_id, created_at FROM users ORDER BY created_at DESC`)
          : await sql`SELECT id, username, email, phone, role, hospital_id, created_at FROM users WHERE hospital_id = ${adminUser.hospital_id} ORDER BY created_at DESC`;
        return res.status(200).json({ success: true, users: rows });
      }
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch user(s)', details: error.message });
    }
  }

  // ══════ POST: Create New Staff Member ══════
  if (req.method === 'POST') {
    try {
      const { username, password, role, email, phone } = req.body;
      if (!username || !password || !role) {
        return res.status(400).json({ error: 'Username, password and role are required' });
      }

      // Check if username, email or phone is already taken
      const existing = await sql`
        SELECT id FROM users 
        WHERE username = ${username.trim()}
           OR (phone IS NOT NULL AND phone != '' AND phone = ${phone ? phone.trim() : ''})
           OR (email IS NOT NULL AND email != '' AND email = ${email ? email.trim() : ''})
      `;
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Username, Phone, or Email is already taken by another user' });
      }

      const hostId = adminUser.role === 'super_admin' ? (req.body.hospital_id ? parseInt(req.body.hospital_id) : null) : adminUser.hospital_id;
      const hash = await bcrypt.hash(password, 10);
      const rows = await sql`
        INSERT INTO users (username, password_hash, role, email, phone, hospital_id)
        VALUES (${username.trim()}, ${hash}, ${role}, ${email ? email.trim() : null}, ${phone ? phone.trim() : null}, ${hostId})
        RETURNING id, username, email, phone, role, created_at
      `;
      return res.status(201).json({ success: true, user: rows[0] });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to create user', details: error.message });
    }
  }

  // ══════ PUT: Update User (Role / Password Reset / Email / Phone) ══════
  if (req.method === 'PUT') {
    try {
      if (!id) return res.status(400).json({ error: 'User ID is required' });
      const { username, password, role, email, phone } = req.body;

      if (!username || !role) {
        return res.status(400).json({ error: 'Username and role are required' });
      }

      // Verify ownership / tenancy
      const checkRows = await sql`SELECT hospital_id FROM users WHERE id = ${id}`;
      if (checkRows.length === 0) return res.status(404).json({ error: 'User not found' });
      if (adminUser.role !== 'super_admin') {
        if (checkRows[0].hospital_id !== adminUser.hospital_id) {
          return res.status(403).json({ error: 'Access denied.' });
        }
      }

      // Check if username, email or phone is taken by another user
      const existing = await sql`
        SELECT id FROM users 
        WHERE id != ${id} AND (
          username = ${username.trim()}
          OR (phone IS NOT NULL AND phone != '' AND phone = ${phone ? phone.trim() : ''})
          OR (email IS NOT NULL AND email != '' AND email = ${email ? email.trim() : ''})
        )
      `;
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Username, Phone, or Email is already taken by another user' });
      }

      let rows;
      if (password && password.trim() !== '') {
        const hash = await bcrypt.hash(password, 10);
        rows = await sql`
          UPDATE users SET
            username = ${username.trim()},
            password_hash = ${hash},
            role = ${role},
            email = ${email ? email.trim() : null},
            phone = ${phone ? phone.trim() : null}
          WHERE id = ${id}
          RETURNING id, username, email, phone, role, created_at
        `;
      } else {
        rows = await sql`
          UPDATE users SET
            username = ${username.trim()},
            role = ${role},
            email = ${email ? email.trim() : null},
            phone = ${phone ? phone.trim() : null}
          WHERE id = ${id}
          RETURNING id, username, email, phone, role, created_at
        `;
      }

      if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json({ success: true, user: rows[0] });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to update user', details: error.message });
    }
  }

  // ══════ DELETE: Delete Staff Member ══════
  if (req.method === 'DELETE') {
    try {
      if (!id) return res.status(400).json({ error: 'User ID is required' });

      // Prevent self-deletion
      if (parseInt(id) === adminUser.id) {
        return res.status(400).json({ error: 'You cannot delete your own admin account.' });
      }

      // Verify ownership / tenancy
      const checkRows = await sql`SELECT hospital_id FROM users WHERE id = ${id}`;
      if (checkRows.length === 0) return res.status(404).json({ error: 'User not found' });
      if (adminUser.role !== 'super_admin') {
        if (checkRows[0].hospital_id !== adminUser.hospital_id) {
          return res.status(403).json({ error: 'Access denied.' });
        }
      }

      const rows = await sql`DELETE FROM users WHERE id = ${id} RETURNING id`;
      if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json({ success: true, message: 'Staff member deleted successfully' });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to delete user', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
