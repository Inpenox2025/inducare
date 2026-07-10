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
  const action = req.query.action || '';

  // ══════════════════════════════════════════════════════════
  // Action: Retrieve Menu items mapping for a specific role (Public Staff query)
  // ══════════════════════════════════════════════════════════
  if (action === 'menus') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const role = req.query.role || user.role;
      const targetHospitalId = user.role === 'super_admin' ? (req.query.hospital_id ? parseInt(req.query.hospital_id) : 1) : user.hospital_id;
      
      // Super admin always has all options
      if (role === 'super_admin') {
        const superMenus = [
          { menu_key: 'super-overview', menu_label: 'System Dashboard', menu_icon: '🏢' },
          { menu_key: 'super-roles', menu_label: 'Custom Roles & Menus', menu_icon: '🔑' },
          { menu_key: 'super-hospitals', menu_label: 'Hospitals Setup', menu_icon: '⚙️' }
        ];
        return res.status(200).json({ success: true, menus: superMenus });
      }

      // Query database custom role menu for the user's hospital!
      const rows = await sql`
        SELECT menu_key, menu_label, menu_icon 
        FROM role_menus 
        WHERE role_name = ${role} AND hospital_id = ${targetHospitalId}
        ORDER BY id ASC
      `;
      return res.status(200).json({ success: true, menus: rows });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to query dynamic menus', details: error.message });
    }
  }

  // ══════════════════════════════════════════════════════════
  // Action: Hospital profile configuration (Both Admin & Super Admin)
  // ══════════════════════════════════════════════════════════
  if (action === 'hospital') {
    // GET: Retrieve hospital info
    if (req.method === 'GET') {
      try {
        const hostId = user.role === 'super_admin' ? (req.query.hospital_id ? parseInt(req.query.hospital_id) : null) : user.hospital_id;
        if (!hostId) return res.status(400).json({ error: 'Hospital ID not set' });

        const rows = await sql`SELECT * FROM hospitals WHERE id = ${hostId}`;
        if (rows.length === 0) return res.status(404).json({ error: 'Hospital not found' });
        return res.status(200).json({ success: true, hospital: rows[0] });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch hospital settings', details: error.message });
      }
    }

    // POST/PUT: Update hospital profile
    if (req.method === 'POST' || req.method === 'PUT') {
      try {
        const { name, logo_data, gst_no, gst_percent, tax_name } = req.body;
        const hostId = user.role === 'super_admin' ? (req.body.hospital_id ? parseInt(req.body.hospital_id) : null) : user.hospital_id;
        if (!hostId) return res.status(400).json({ error: 'Hospital ID is required' });

        const rows = await sql`
          UPDATE hospitals SET
            name = ${name.trim()},
            logo_data = ${logo_data || null},
            gst_no = ${gst_no !== undefined ? gst_no.trim() : null},
            gst_percent = ${gst_percent !== undefined ? parseFloat(gst_percent) || 0.00 : 0.00},
            tax_name = ${tax_name !== undefined ? tax_name.trim() : 'GST'}
          WHERE id = ${hostId}
          RETURNING *
        `;

        if (rows.length === 0) return res.status(404).json({ error: 'Hospital profile not found' });
        return res.status(200).json({ success: true, hospital: rows[0] });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to save hospital profile settings', details: error.message });
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // Action: Retrieve statistics (Doctors count, Rooms count, Patients count)
  // ══════════════════════════════════════════════════════════
  if (action === 'stats') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const hostId = user.role === 'super_admin' ? (req.query.hospital_id ? parseInt(req.query.hospital_id) : null) : user.hospital_id;
      
      if (hostId) {
        const doctorsCount = await sql`SELECT COUNT(*) as total FROM doctors WHERE hospital_id = ${hostId}`;
        const roomsCount = await sql`SELECT COUNT(*) as total FROM rooms WHERE hospital_id = ${hostId}`;
        const patientsCount = await sql`SELECT COUNT(*) as total FROM patients WHERE hospital_id = ${hostId}`;
        
        return res.status(200).json({
          success: true,
          stats: {
            doctors: parseInt(doctorsCount[0].total),
            rooms: parseInt(roomsCount[0].total),
            patients: parseInt(patientsCount[0].total)
          }
        });
      } else {
        // Return super admin stats: all hospitals count
        const hospitalsCount = await sql`SELECT COUNT(*) as total FROM hospitals`;
        const totalDocs = await sql`SELECT COUNT(*) as total FROM doctors`;
        const totalRooms = await sql`SELECT COUNT(*) as total FROM rooms`;
        
        return res.status(200).json({
          success: true,
          stats: {
            hospitals: parseInt(hospitalsCount[0].total),
            doctors: parseInt(totalDocs[0].total),
            rooms: parseInt(totalRooms[0].total)
          }
        });
      }
    } catch (error) {
      return res.status(500).json({ error: 'Failed to aggregate statistics', details: error.message });
    }
  }

  // ══════════════════════════════════════════════════════════
  // Rest of operations require ADMIN or SUPER_ADMIN role
  // ══════════════════════════════════════════════════════════
  if (user.role !== 'super_admin' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }

  // ══════ Super Admin: Hospitals CRUD ══════
  if (action === 'hospitals') {
    if (user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied. Super Admin privileges required.' });
    }
    
    if (req.method === 'GET') {
      try {
        const rows = await sql`
          SELECT h.*, 
                 (SELECT COUNT(*) FROM doctors WHERE hospital_id = h.id) as doctors_count,
                 (SELECT COUNT(*) FROM rooms WHERE hospital_id = h.id) as rooms_count
          FROM hospitals h
          ORDER BY h.id ASC
        `;
        return res.status(200).json({ success: true, hospitals: rows });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to list hospitals', details: error.message });
      }
    }

    if (req.method === 'POST') {
      try {
        const { name, logo_data, gst_no, gst_percent, tax_name } = req.body;
        if (!name) return res.status(400).json({ error: 'Hospital name is required' });

        const rows = await sql`
          INSERT INTO hospitals (name, logo_data, gst_no, gst_percent, tax_name)
          VALUES (${name.trim()}, ${logo_data || null}, ${gst_no || null}, ${gst_percent ? parseFloat(gst_percent) : 0.00}, ${tax_name || 'GST'})
          RETURNING *
        `;
        return res.status(201).json({ success: true, hospital: rows[0] });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to register hospital', details: error.message });
      }
    }

    if (req.method === 'PUT') {
      try {
        const id = req.query.id;
        if (!id) return res.status(400).json({ error: 'Hospital ID parameter is required' });
        const { name, logo_data, gst_no, gst_percent, tax_name } = req.body;
        if (!name) return res.status(400).json({ error: 'Hospital name is required' });

        const rows = await sql`
          UPDATE hospitals SET
            name = ${name.trim()},
            logo_data = ${logo_data || null},
            gst_no = ${gst_no !== undefined ? gst_no.trim() : null},
            gst_percent = ${gst_percent !== undefined ? parseFloat(gst_percent) || 0.00 : 0.00},
            tax_name = ${tax_name !== undefined ? tax_name.trim() : 'GST'}
          WHERE id = ${parseInt(id)}
          RETURNING *
        `;
        if (rows.length === 0) return res.status(404).json({ error: 'Hospital not found' });
        return res.status(200).json({ success: true, hospital: rows[0] });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to update hospital', details: error.message });
      }
    }

    if (req.method === 'DELETE') {
      try {
        const id = req.query.id;
        if (!id) return res.status(400).json({ error: 'Hospital ID parameter is required' });

        const rows = await sql`DELETE FROM hospitals WHERE id = ${parseInt(id)} RETURNING id`;
        if (rows.length === 0) return res.status(404).json({ error: 'Hospital not found' });
        return res.status(200).json({ success: true, message: 'Hospital deleted successfully' });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to delete hospital', details: error.message });
      }
    }
  }

  // ══════ Super Admin / Hospital Admin: Custom Roles CRUD (tenant-isolated) ══════
  if (action === 'roles') {
    const hostId = user.role === 'super_admin' ? (req.query.hospital_id ? parseInt(req.query.hospital_id) : 1) : user.hospital_id;
    if (!hostId) return res.status(400).json({ error: 'Hospital ID is required' });

    if (req.method === 'GET') {
      try {
        const rows = await sql`
          SELECT * FROM custom_roles 
          WHERE hospital_id = ${hostId} 
          ORDER BY role_name ASC
        `;
        return res.status(200).json({ success: true, roles: rows });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch roles', details: error.message });
      }
    }

    if (req.method === 'POST') {
      try {
        const { role_name, description } = req.body;
        if (!role_name) return res.status(400).json({ error: 'Role name is required' });

        // Add custom role for this specific hospital
        const rows = await sql`
          INSERT INTO custom_roles (role_name, description, hospital_id)
          VALUES (${role_name.trim().toLowerCase()}, ${description || null}, ${hostId})
          ON CONFLICT (role_name, hospital_id) DO UPDATE SET description = EXCLUDED.description
          RETURNING *
        `;
        return res.status(201).json({ success: true, role: rows[0] });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to register role', details: error.message });
      }
    }

    if (req.method === 'PUT') {
      try {
        const id = req.query.id;
        if (!id) return res.status(400).json({ error: 'Role ID parameter is required' });
        const { role_name, description } = req.body;
        if (!role_name) return res.status(400).json({ error: 'Role name is required' });

        const rows = await sql`
          UPDATE custom_roles SET
            role_name = ${role_name.trim().toLowerCase()},
            description = ${description || null}
          WHERE id = ${parseInt(id)} AND hospital_id = ${hostId}
          RETURNING *
        `;
        if (rows.length === 0) return res.status(404).json({ error: 'Role not found' });
        return res.status(200).json({ success: true, role: rows[0] });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to update role', details: error.message });
      }
    }

    if (req.method === 'DELETE') {
      try {
        const id = req.query.id;
        if (!id) return res.status(400).json({ error: 'Role ID parameter is required' });

        const rows = await sql`DELETE FROM custom_roles WHERE id = ${parseInt(id)} AND hospital_id = ${hostId} RETURNING id`;
        if (rows.length === 0) return res.status(404).json({ error: 'Role not found' });
        return res.status(200).json({ success: true, message: 'Role deleted successfully' });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to delete role', details: error.message });
      }
    }
  }

  // ══════ Super Admin / Hospital Admin: Menu Mappings configuration (tenant-isolated) ══════
  if (action === 'menu-mapping') {
    const hostId = user.role === 'super_admin' ? (req.body.hospital_id ? parseInt(req.body.hospital_id) : 1) : user.hospital_id;
    if (!hostId) return res.status(400).json({ error: 'Hospital ID is required' });

    if (req.method === 'POST') {
      try {
        const { role_name, menus } = req.body; // menus: array of {menu_key, menu_label, menu_icon}
        if (!role_name || !Array.isArray(menus)) {
          return res.status(400).json({ error: 'Role name and menu lists are required' });
        }

        // Clear existing menu mappings for this role in this hospital
        await sql`DELETE FROM role_menus WHERE role_name = ${role_name} AND hospital_id = ${hostId}`;

        // Insert new mappings
        for (const m of menus) {
          await sql`
            INSERT INTO role_menus (role_name, menu_key, menu_label, menu_icon, hospital_id)
            VALUES (${role_name}, ${m.menu_key}, ${m.menu_label}, ${m.menu_icon}, ${hostId})
          `;
        }

        return res.status(200).json({ success: true, message: 'Role menus mapped successfully!' });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to configure role menus', details: error.message });
      }
    }
  }

  return res.status(404).json({ error: 'Action not found' });
};
