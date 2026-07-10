const { getSQL } = require('../shared/db');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = getSQL();

    // 1. Create Users Table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'nurse', -- 'admin', 'nurse'
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Migration: Add email and phone to users table if they don't exist
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(100)`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`;

    // 2. Create Patients Table
    await sql`
      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        date_of_birth DATE,
        gender VARCHAR(10),
        mobile_no VARCHAR(20),
        email VARCHAR(100),
        address TEXT,
        medical_history TEXT,
        case_sheet_data TEXT,
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // 3. Create Appointments Table
    await sql`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        patient_id INT REFERENCES patients(id) ON DELETE CASCADE,
        doctor_name VARCHAR(255) NOT NULL,
        appointment_date DATE NOT NULL,
        appointment_time TIME NOT NULL,
        status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled', 'no-show'
        purpose VARCHAR(255),
        fee NUMERIC(15,2) DEFAULT 0.00,
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // 4. Create Invoices Table
    await sql`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        invoice_no VARCHAR(50) UNIQUE NOT NULL,
        patient_id INT REFERENCES patients(id) ON DELETE CASCADE,
        appointment_id INT REFERENCES appointments(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        amount NUMERIC(15,2) NOT NULL,
        paid_amount NUMERIC(15,2) DEFAULT 0.00,
        due_amount NUMERIC(15,2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'unpaid', -- 'paid', 'unpaid', 'partially_paid'
        payment_mode VARCHAR(20), -- 'cash', 'online'
        payment_date DATE,
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // 5. Seed default admin user if not exists
    const adminRows = await sql`SELECT id FROM users WHERE username = 'admin'`;
    let adminId;
    if (adminRows.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      const inserted = await sql`
        INSERT INTO users (username, password_hash, role) 
        VALUES ('admin', ${hash}, 'admin') 
        RETURNING id
      `;
      adminId = inserted[0].id;
    } else {
      adminId = adminRows[0].id;
    }

    // 6. Seed default nurse user if not exists
    const nurseRows = await sql`SELECT id FROM users WHERE username = 'nurse'`;
    if (nurseRows.length === 0) {
      const hash = await bcrypt.hash('nurse123', 10);
      await sql`
        INSERT INTO users (username, password_hash, role) 
        VALUES ('nurse', ${hash}, 'nurse')
      `;
    }

    // 7. Seed sample patients if empty
    const checkPatients = await sql`SELECT id FROM patients LIMIT 1`;
    if (checkPatients.length === 0) {
      const p1 = await sql`
        INSERT INTO patients (full_name, date_of_birth, gender, mobile_no, email, address, medical_history, created_by)
        VALUES ('John Doe', '1990-05-15', 'Male', '9876543210', 'john.doe@email.com', '123 Main St, New York', 'Hypertension, dust allergies', ${adminId})
        RETURNING id
      `;
      const p2 = await sql`
        INSERT INTO patients (full_name, date_of_birth, gender, mobile_no, email, address, medical_history, created_by)
        VALUES ('Sarah Smith', '1985-08-22', 'Female', '9876543211', 'sarah.smith@email.com', '456 Elm St, Boston', 'Type 2 Diabetes', ${adminId})
        RETURNING id
      `;
      const p3 = await sql`
        INSERT INTO patients (full_name, date_of_birth, gender, mobile_no, email, address, medical_history, created_by)
        VALUES ('Robert Johnson', '1972-12-01', 'Male', '9876543212', 'robert.j@email.com', '789 Pine St, Seattle', 'No major medical history', ${adminId})
        RETURNING id
      `;

      // Seed sample appointments and invoices
      const patient1Id = p1[0].id;
      const patient2Id = p2[0].id;
      const patient3Id = p3[0].id;

      // Appointment 1
      const app1 = await sql`
        INSERT INTO appointments (patient_id, doctor_name, appointment_date, appointment_time, status, purpose, fee, created_by)
        VALUES (${patient1Id}, 'Dr. Stephen Strange', CURRENT_DATE, '10:00:00', 'completed', 'Routine General Checkup', 500.00, ${adminId})
        RETURNING id
      `;
      // Invoice 1 (Paid in Cash)
      await sql`
        INSERT INTO invoices (invoice_no, patient_id, appointment_id, description, amount, paid_amount, due_amount, status, payment_mode, payment_date, created_by)
        VALUES ('INV-2026-001', ${patient1Id}, ${app1[0].id}, 'Consultation Fee - Dr. Stephen Strange', 500.00, 500.00, 0.00, 'paid', 'cash', CURRENT_DATE, ${adminId})
      `;

      // Appointment 2
      const app2 = await sql`
        INSERT INTO appointments (patient_id, doctor_name, appointment_date, appointment_time, status, purpose, fee, created_by)
        VALUES (${patient2Id}, 'Dr. Gregory House', CURRENT_DATE, '14:30:00', 'completed', 'Chronic Diabetes Consultation', 1200.00, ${adminId})
        RETURNING id
      `;
      // Invoice 2 (Paid Online)
      await sql`
        INSERT INTO invoices (invoice_no, patient_id, appointment_id, description, amount, paid_amount, due_amount, status, payment_mode, payment_date, created_by)
        VALUES ('INV-2026-002', ${patient2Id}, ${app2[0].id}, 'Consultation & Blood Panel Report Review', 1200.00, 1200.00, 0.00, 'paid', 'online', CURRENT_DATE, ${adminId})
      `;

      // Appointment 3
      const app3 = await sql`
        INSERT INTO appointments (patient_id, doctor_name, appointment_date, appointment_time, status, purpose, fee, created_by)
        VALUES (${patient3Id}, 'Dr. Meredith Grey', CURRENT_DATE + 1, '11:00:00', 'scheduled', 'Cardiac Consultation', 800.00, ${adminId})
        RETURNING id
      `;
      // Invoice 3 (Unpaid / Pending)
      await sql`
        INSERT INTO invoices (invoice_no, patient_id, appointment_id, description, amount, paid_amount, due_amount, status, created_by)
        VALUES ('INV-2026-003', ${patient3Id}, ${app3[0].id}, 'Scheduled Consultation Fee - Dr. Meredith Grey', 800.00, 0.00, 800.00, 'unpaid', ${adminId})
      `;
    }

    return res.status(200).json({
      success: true,
      message: 'Database tables initialized and seeded successfully.',
      credentials: {
        admin: 'admin / admin123',
        nurse: 'nurse / nurse123'
      }
    });
  } catch (error) {
    console.error('Database setup error:', error);
    return res.status(500).json({ error: 'Database setup failed', details: error.message });
  }
};
