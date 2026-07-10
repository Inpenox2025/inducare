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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = getSQL();

    // 1. Total Invoice Amount, Paid Amount, and Dues
    const aggregates = await sql`
      SELECT 
        COALESCE(SUM(amount), 0) as total_invoiced,
        COALESCE(SUM(paid_amount), 0) as total_collected,
        COALESCE(SUM(due_amount), 0) as total_due
      FROM invoices
    `;

    // 2. Cash vs Online breakdown
    const cashCollected = await sql`
      SELECT COALESCE(SUM(paid_amount), 0) as total 
      FROM invoices 
      WHERE payment_mode = 'cash'
    `;

    const onlineCollected = await sql`
      SELECT COALESCE(SUM(paid_amount), 0) as total 
      FROM invoices 
      WHERE payment_mode = 'online'
    `;

    // 3. Invoice status counts
    const statusCounts = await sql`
      SELECT status, COUNT(*) as count 
      FROM invoices 
      GROUP BY status
    `;

    // 4. Quick Hospital counts
    const patientCount = await sql`SELECT COUNT(*) as total FROM patients`;
    const appointmentCount = await sql`SELECT COUNT(*) as total FROM appointments`;
    const todayAppointments = await sql`
      SELECT COUNT(*) as total 
      FROM appointments 
      WHERE appointment_date = CURRENT_DATE
    `;

    // 5. Doctor productivity breakdown
    const doctorStats = await sql`
      SELECT doctor_name, COUNT(*) as visit_count, COALESCE(SUM(fee), 0) as total_revenue
      FROM appointments 
      GROUP BY doctor_name
      ORDER BY total_revenue DESC
    `;

    // 6. Recent invoices
    const recentInvoices = await sql`
      SELECT i.*, p.full_name as patient_name 
      FROM invoices i
      JOIN patients p ON i.patient_id = p.id
      ORDER BY i.updated_at DESC
      LIMIT 5
    `;

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

    return res.status(200).json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Reconciliation summary error:', error);
    return res.status(500).json({ error: 'Failed to fetch reconciliation metrics', details: error.message });
  }
};
