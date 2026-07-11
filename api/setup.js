const { getSQL } = require("../shared/db");
const bcrypt = require("bcryptjs");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const sql = getSQL();
    // 0a. Create Hospitals Table
    await sql`
      CREATE TABLE IF NOT EXISTS hospitals (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        logo_data TEXT, -- base64 data URL
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // 0b. Create Custom Roles Table
    await sql`
      CREATE TABLE IF NOT EXISTS custom_roles (
        id SERIAL PRIMARY KEY,
        role_name VARCHAR(50) NOT NULL,
        description TEXT,
        hospital_id INT REFERENCES hospitals(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT custom_roles_role_hosp_uniq UNIQUE (role_name, hospital_id)
      )
    `;

    // 0c. Create Role Menus Table
    await sql`
      CREATE TABLE IF NOT EXISTS role_menus (
        id SERIAL PRIMARY KEY,
        role_name VARCHAR(50) NOT NULL,
        menu_key VARCHAR(50) NOT NULL,
        menu_label VARCHAR(100) NOT NULL,
        menu_icon VARCHAR(10) NOT NULL,
        hospital_id INT REFERENCES hospitals(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Migration updates for existing database tables
    await sql`ALTER TABLE custom_roles DROP CONSTRAINT IF EXISTS custom_roles_role_name_key`;
    await sql`ALTER TABLE custom_roles ADD COLUMN IF NOT EXISTS hospital_id INT REFERENCES hospitals(id) ON DELETE CASCADE`;
    await sql`ALTER TABLE custom_roles DROP CONSTRAINT IF EXISTS custom_roles_role_hosp_uniq`;
    await sql`ALTER TABLE custom_roles ADD CONSTRAINT custom_roles_role_hosp_uniq UNIQUE (role_name, hospital_id)`;
    await sql`ALTER TABLE role_menus ADD COLUMN IF NOT EXISTS hospital_id INT REFERENCES hospitals(id) ON DELETE CASCADE`;
    await sql`ALTER TABLE role_menus DROP CONSTRAINT IF EXISTS role_menus_uniq`;
    await sql`ALTER TABLE role_menus ADD CONSTRAINT role_menus_uniq UNIQUE (role_name, menu_key, hospital_id)`;

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
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS hospital_id INT REFERENCES hospitals(id) ON DELETE SET NULL`;

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

    // Migration: Add hospital_id to patients
    await sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS hospital_id INT REFERENCES hospitals(id) ON DELETE SET NULL`;

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

    // Migration: Add hospital_id to appointments
    await sql`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS hospital_id INT REFERENCES hospitals(id) ON DELETE SET NULL`;

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

    // Migration: Add hospital_id to invoices
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS hospital_id INT REFERENCES hospitals(id) ON DELETE SET NULL`;

    // Migration: Add GST configuration columns to hospitals
    await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS gst_no VARCHAR(50)`;
    await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(5,2) DEFAULT 0.00`;
    await sql`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS tax_name VARCHAR(50) DEFAULT 'GST'`;

    // Migration: Add GST breakup columns to invoices
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC(15,2)`;
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(15,2)`;
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2)`;
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_name VARCHAR(50) DEFAULT 'GST'`;

    // Migration: Add allocation_id to invoices
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS allocation_id INT REFERENCES room_allocations(id) ON DELETE SET NULL`;

    // Migration: Create receipts table for partial payments
    await sql`
      CREATE TABLE IF NOT EXISTS receipts (
        id SERIAL PRIMARY KEY,
        receipt_no VARCHAR(100) UNIQUE NOT NULL,
        invoice_id INT REFERENCES invoices(id) ON DELETE CASCADE,
        amount_paid NUMERIC(15,2) NOT NULL,
        payment_mode VARCHAR(50) NOT NULL,
        payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // 4b. Create Doctors Table
    await sql`
      CREATE TABLE IF NOT EXISTS doctors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        specialization VARCHAR(100),
        phone VARCHAR(20),
        email VARCHAR(100),
        fee NUMERIC(15,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // 4c. Create Rooms Table
    await sql`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        room_no VARCHAR(50) UNIQUE NOT NULL,
        room_type VARCHAR(50), -- 'ward', 'semi-private', 'private', 'icu'
        status VARCHAR(20) DEFAULT 'available', -- 'available', 'occupied', 'maintenance'
        price_per_day NUMERIC(15,2) DEFAULT 0.00,
        capacity INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // 4cc. Create Room Allocation Services Table
    await sql`
      CREATE TABLE IF NOT EXISTS allocation_services (
        id SERIAL PRIMARY KEY,
        allocation_id INT REFERENCES room_allocations(id) ON DELETE CASCADE,
        service_name VARCHAR(255) NOT NULL,
        price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        quantity INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        hospital_id INT REFERENCES hospitals(id) ON DELETE CASCADE
      )
    `;

    // 4d. Create Room Allocations Table
    await sql`
      CREATE TABLE IF NOT EXISTS room_allocations (
        id SERIAL PRIMARY KEY,
        room_id INT REFERENCES rooms(id) ON DELETE CASCADE,
        patient_id INT REFERENCES patients(id) ON DELETE CASCADE,
        admitted_at TIMESTAMP DEFAULT NOW(),
        discharged_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'active', -- 'active', 'discharged'
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // 4e. Create Doctor Visits Table
    await sql`
      CREATE TABLE IF NOT EXISTS doctor_visits (
        id SERIAL PRIMARY KEY,
        allocation_id INT REFERENCES room_allocations(id) ON DELETE CASCADE,
        doctor_id INT REFERENCES doctors(id) ON DELETE CASCADE,
        visit_date TIMESTAMP DEFAULT NOW(),
        clinical_notes TEXT,
        temperature VARCHAR(20),
        blood_pressure VARCHAR(20),
        heart_rate VARCHAR(20),
        status VARCHAR(20) DEFAULT 'completed', -- 'completed', 'cancelled'
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Migration: Add hospital_id to doctors, rooms, room_allocations, doctor_visits
    await sql`ALTER TABLE doctors ADD COLUMN IF NOT EXISTS hospital_id INT REFERENCES hospitals(id) ON DELETE SET NULL`;
    await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS hospital_id INT REFERENCES hospitals(id) ON DELETE SET NULL`;
    await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS capacity INT DEFAULT 1`;
    await sql`ALTER TABLE room_allocations ADD COLUMN IF NOT EXISTS hospital_id INT REFERENCES hospitals(id) ON DELETE SET NULL`;
    await sql`ALTER TABLE doctor_visits ADD COLUMN IF NOT EXISTS hospital_id INT REFERENCES hospitals(id) ON DELETE SET NULL`;

    // Seed default hospitals if empty
    const checkHospitals = await sql`SELECT id FROM hospitals LIMIT 1`;
    let hospital1Id;
    if (checkHospitals.length === 0) {
      const h1 = await sql`
        INSERT INTO hospitals (name, logo_data)
        VALUES ('icare General Hospital', '')
        RETURNING id
      `;
      await sql`
        INSERT INTO hospitals (name, logo_data)
        VALUES ('City Care Clinic', '')
      `;
      hospital1Id = h1[0].id;
    } else {
      const hps = await sql`SELECT id FROM hospitals ORDER BY id ASC`;
      hospital1Id = hps[0].id;
    }

    // Seed default custom roles and menus for EACH hospital
    const hospitals = await sql`SELECT id FROM hospitals`;
    for (const h of hospitals) {
      const rolesToSeed = [
        { role_name: "admin", description: "Hospital Administrator" },
        { role_name: "nurse", description: "Staff Nurse" },
        { role_name: "doctor", description: "Medical Doctor" },
        { role_name: "pharmacist", description: "Pharmacy Manager" },
      ];
      for (const r of rolesToSeed) {
        const checkRole = await sql`
          SELECT id FROM custom_roles 
          WHERE role_name = ${r.role_name} AND hospital_id = ${h.id}
        `;
        if (checkRole.length === 0) {
          await sql`
            INSERT INTO custom_roles (role_name, description, hospital_id) 
            VALUES (${r.role_name}, ${r.description}, ${h.id})
          `;
        }
      }

      const checkMenus =
        await sql`SELECT id FROM role_menus WHERE hospital_id = ${h.id} LIMIT 1`;
      if (checkMenus.length === 0) {
        const defaultMenus = [
          // Admin menus
          {
            role_name: "admin",
            menu_key: "overview",
            menu_label: "Overview Panel",
            menu_icon: "📊",
          },
          {
            role_name: "admin",
            menu_key: "patients",
            menu_label: "Patients Registry",
            menu_icon: "👥",
          },
          {
            role_name: "admin",
            menu_key: "appointments",
            menu_label: "Appointments",
            menu_icon: "📅",
          },
          {
            role_name: "admin",
            menu_key: "invoices",
            menu_label: "Billing & Invoices",
            menu_icon: "💳",
          },
          {
            role_name: "admin",
            menu_key: "receipts-panel",
            menu_label: "Payment Receipts",
            menu_icon: "🧾",
          },
          {
            role_name: "admin",
            menu_key: "doctors",
            menu_label: "Doctors Registry",
            menu_icon: "👨‍⚕️",
          },
          {
            role_name: "admin",
            menu_key: "rooms",
            menu_label: "Rooms & Allocations",
            menu_icon: "🏨",
          },
          {
            role_name: "admin",
            menu_key: "discharged-patients",
            menu_label: "Discharged Patients",
            menu_icon: "👥",
          },
          {
            role_name: "admin",
            menu_key: "hospital-setup",
            menu_label: "Hospital Setup",
            menu_icon: "⚙️",
          },

          // Nurse menus
          {
            role_name: "nurse",
            menu_key: "overview",
            menu_label: "Overview Panel",
            menu_icon: "📊",
          },
          {
            role_name: "nurse",
            menu_key: "patients",
            menu_label: "Patients Registry",
            menu_icon: "👥",
          },
          {
            role_name: "nurse",
            menu_key: "appointments",
            menu_label: "Appointments",
            menu_icon: "📅",
          },
          {
            role_name: "nurse",
            menu_key: "receipts-panel",
            menu_label: "Payment Receipts",
            menu_icon: "🧾",
          },
          {
            role_name: "nurse",
            menu_key: "discharged-patients",
            menu_label: "Discharged Patients",
            menu_icon: "👥",
          },
          {
            role_name: "nurse",
            menu_key: "rooms",
            menu_label: "Rooms & Allocations",
            menu_icon: "🏨",
          },

          // Doctor menus
          {
            role_name: "doctor",
            menu_key: "overview",
            menu_label: "Overview Panel",
            menu_icon: "📊",
          },
          {
            role_name: "doctor",
            menu_key: "patients",
            menu_label: "Patients Registry",
            menu_icon: "👥",
          },
          {
            role_name: "doctor",
            menu_key: "rooms",
            menu_label: "Rooms & Allocations",
            menu_icon: "🏨",
          },
        ];
        for (const m of defaultMenus) {
          await sql`
            INSERT INTO role_menus (role_name, menu_key, menu_label, menu_icon, hospital_id)
            VALUES (${m.role_name}, ${m.menu_key}, ${m.menu_label}, ${m.menu_icon}, ${h.id})
            ON CONFLICT DO NOTHING
          `;
        }
        // Migration: Ensure receipts-panel menu is always configured for admin and nurse in existing setups
        await sql`
          INSERT INTO role_menus (role_name, menu_key, menu_label, menu_icon, hospital_id)
          VALUES ('admin', 'receipts-panel', 'Payment Receipts', '🧾', ${h.id})
          ON CONFLICT DO NOTHING
        `;
        await sql`
          INSERT INTO role_menus (role_name, menu_key, menu_label, menu_icon, hospital_id)
          VALUES ('nurse', 'receipts-panel', 'Payment Receipts', '🧾', ${h.id})
          ON CONFLICT DO NOTHING
        `;
        await sql`
          INSERT INTO role_menus (role_name, menu_key, menu_label, menu_icon, hospital_id)
          VALUES ('admin', 'discharged-patients', 'Discharged Patients', '👥', ${h.id})
          ON CONFLICT DO NOTHING
        `;
        await sql`
          INSERT INTO role_menus (role_name, menu_key, menu_label, menu_icon, hospital_id)
          VALUES ('nurse', 'discharged-patients', 'Discharged Patients', '👥', ${h.id})
          ON CONFLICT DO NOTHING
        `;
      }
    }

    // Seed default superadmin if not exists
    const superRows =
      await sql`SELECT id FROM users WHERE username = 'superadmin'`;
    if (superRows.length === 0) {
      const hash = await bcrypt.hash("superpassword123", 10);
      await sql`
        INSERT INTO users (username, password_hash, role, hospital_id) 
        VALUES ('superadmin', ${hash}, 'super_admin', NULL)
      `;
    }

    // 5. Seed default admin user if not exists
    const adminRows = await sql`SELECT id FROM users WHERE username = 'admin'`;
    let adminId;
    if (adminRows.length === 0) {
      const hash = await bcrypt.hash("admin123", 10);
      const inserted = await sql`
        INSERT INTO users (username, password_hash, role, hospital_id) 
        VALUES ('admin', ${hash}, 'admin', ${hospital1Id}) 
        RETURNING id
      `;
      adminId = inserted[0].id;
    } else {
      adminId = adminRows[0].id;
      await sql`UPDATE users SET hospital_id = ${hospital1Id} WHERE id = ${adminId}`;
    }

    // 6. Seed default nurse user if not exists
    const nurseRows = await sql`SELECT id FROM users WHERE username = 'nurse'`;
    if (nurseRows.length === 0) {
      const hash = await bcrypt.hash("nurse123", 10);
      await sql`
        INSERT INTO users (username, password_hash, role, hospital_id) 
        VALUES ('nurse', ${hash}, 'nurse', ${hospital1Id})
      `;
    } else {
      await sql`UPDATE users SET hospital_id = ${hospital1Id} WHERE username = 'nurse'`;
    }

    // 6b. Seed default doctor user if not exists
    const doctorRows =
      await sql`SELECT id FROM users WHERE username = 'doctor'`;
    if (doctorRows.length === 0) {
      const hash = await bcrypt.hash("doctor123", 10);
      await sql`
        INSERT INTO users (username, password_hash, role, hospital_id) 
        VALUES ('doctor', ${hash}, 'doctor', ${hospital1Id})
      `;
    } else {
      await sql`UPDATE users SET hospital_id = ${hospital1Id} WHERE username = 'doctor'`;
    }

    // 6c. Seed sample doctors if empty
    const checkDoctors = await sql`SELECT id FROM doctors LIMIT 1`;
    if (checkDoctors.length === 0) {
      await sql`
        INSERT INTO doctors (name, specialization, phone, email, fee, hospital_id)
        VALUES 
        ('Dr. Stephen Strange', 'Cardiology', '9876543220', 'strange@icare.com', 500.00, ${hospital1Id}),
        ('Dr. Gregory House', 'Diagnostics', '9876543221', 'house@icare.com', 1200.00, ${hospital1Id}),
        ('Dr. Meredith Grey', 'General Surgery', '9876543222', 'grey@icare.com', 800.00, ${hospital1Id})
      `;
    } else {
      await sql`UPDATE doctors SET hospital_id = ${hospital1Id} WHERE hospital_id IS NULL`;
    }

    // 6d. Seed sample rooms if empty
    const checkRooms = await sql`SELECT id FROM rooms LIMIT 1`;
    if (checkRooms.length === 0) {
      await sql`
        INSERT INTO rooms (room_no, room_type, status, price_per_day, hospital_id, capacity)
        VALUES 
        ('Room 101', 'Private', 'available', 1500.00, ${hospital1Id}, 1),
        ('Room 102', 'Semi-Private', 'available', 800.00, ${hospital1Id}, 2),
        ('Room 103', 'ICU', 'available', 5000.00, ${hospital1Id}, 4),
        ('Room 104', 'General Ward', 'available', 400.00, ${hospital1Id}, 10)
      `;
    } else {
      await sql`UPDATE rooms SET hospital_id = ${hospital1Id} WHERE hospital_id IS NULL`;
    }

    // 7. Seed sample patients if empty
    const checkPatients = await sql`SELECT id FROM patients LIMIT 1`;
    if (checkPatients.length === 0) {
      const p1 = await sql`
        INSERT INTO patients (full_name, date_of_birth, gender, mobile_no, email, address, medical_history, created_by, hospital_id)
        VALUES ('John Doe', '1990-05-15', 'Male', '9876543210', 'john.doe@email.com', '123 Main St, New York', 'Hypertension, dust allergies', ${adminId}, ${hospital1Id})
        RETURNING id
      `;
      const p2 = await sql`
        INSERT INTO patients (full_name, date_of_birth, gender, mobile_no, email, address, medical_history, created_by, hospital_id)
        VALUES ('Sarah Smith', '1985-08-22', 'Female', '9876543211', 'sarah.smith@email.com', '456 Elm St, Boston', 'Type 2 Diabetes', ${adminId}, ${hospital1Id})
        RETURNING id
      `;
      const p3 = await sql`
        INSERT INTO patients (full_name, date_of_birth, gender, mobile_no, email, address, medical_history, created_by, hospital_id)
        VALUES ('Robert Johnson', '1972-12-01', 'Male', '9876543212', 'robert.j@email.com', '789 Pine St, Seattle', 'No major medical history', ${adminId}, ${hospital1Id})
        RETURNING id
      `;

      // Seed sample appointments and invoices
      const patient1Id = p1[0].id;
      const patient2Id = p2[0].id;
      const patient3Id = p3[0].id;

      // Appointment 1
      const app1 = await sql`
        INSERT INTO appointments (patient_id, doctor_name, appointment_date, appointment_time, status, purpose, fee, created_by, hospital_id)
        VALUES (${patient1Id}, 'Dr. Stephen Strange', CURRENT_DATE, '10:00:00', 'completed', 'Routine General Checkup', 500.00, ${adminId}, ${hospital1Id})
        RETURNING id
      `;
      // Invoice 1 (Paid in Cash)
      await sql`
        INSERT INTO invoices (invoice_no, patient_id, appointment_id, description, amount, paid_amount, due_amount, status, payment_mode, payment_date, created_by, hospital_id)
        VALUES ('INV-2026-001', ${patient1Id}, ${app1[0].id}, 'Consultation Fee - Dr. Stephen Strange', 500.00, 500.00, 0.00, 'paid', 'cash', CURRENT_DATE, ${adminId}, ${hospital1Id})
      `;

      // Appointment 2
      const app2 = await sql`
        INSERT INTO appointments (patient_id, doctor_name, appointment_date, appointment_time, status, purpose, fee, created_by, hospital_id)
        VALUES (${patient2Id}, 'Dr. Gregory House', CURRENT_DATE, '14:30:00', 'completed', 'Chronic Diabetes Consultation', 1200.00, ${adminId}, ${hospital1Id})
        RETURNING id
      `;
      // Invoice 2 (Paid Online)
      await sql`
        INSERT INTO invoices (invoice_no, patient_id, appointment_id, description, amount, paid_amount, due_amount, status, payment_mode, payment_date, created_by, hospital_id)
        VALUES ('INV-2026-002', ${patient2Id}, ${app2[0].id}, 'Consultation & Blood Panel Report Review', 1200.00, 1200.00, 0.00, 'paid', 'online', CURRENT_DATE, ${adminId}, ${hospital1Id})
      `;

      // Appointment 3
      const app3 = await sql`
        INSERT INTO appointments (patient_id, doctor_name, appointment_date, appointment_time, status, purpose, fee, created_by, hospital_id)
        VALUES (${patient3Id}, 'Dr. Meredith Grey', CURRENT_DATE + 1, '11:00:00', 'scheduled', 'Cardiac Consultation', 800.00, ${adminId}, ${hospital1Id})
        RETURNING id
      `;
      // Invoice 3 (Unpaid / Pending)
      await sql`
        INSERT INTO invoices (invoice_no, patient_id, appointment_id, description, amount, paid_amount, due_amount, status, created_by, hospital_id)
        VALUES ('INV-2026-003', ${patient3Id}, ${app3[0].id}, 'Scheduled Consultation Fee - Dr. Meredith Grey', 800.00, 0.00, 800.00, 'unpaid', ${adminId}, ${hospital1Id})
      `;
    } else {
      await sql`UPDATE patients SET hospital_id = ${hospital1Id} WHERE hospital_id IS NULL`;
      await sql`UPDATE appointments SET hospital_id = ${hospital1Id} WHERE hospital_id IS NULL`;
      await sql`UPDATE invoices SET hospital_id = ${hospital1Id} WHERE hospital_id IS NULL`;
    }

    return res.status(200).json({
      success: true,
      message: "Database tables initialized and seeded successfully.",
      credentials: {
        admin: "admin / admin123",
        nurse: "nurse / nurse123",
      },
    });
  } catch (error) {
    console.error("Database setup error:", error);
    return res
      .status(500)
      .json({ error: "Database setup failed", details: error.message });
  }
};
