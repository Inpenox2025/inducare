// ═══════════════════════════════════════
// STAFF PORTAL DASHBOARD — dashboard.js
// ═══════════════════════════════════════

const API_BASE = "/api";
let activeTab = "overview";

// Pagination States
let patientPage = 1;
let appointmentPage = 1;
let invoicePage = 1;

// Search/Filter States
let patientSearch = "";
let appointmentSearch = "";
let appointmentDate = "";
let invoiceSearch = "";
let invoiceStatus = "";

// Auth Tokens
function getToken() {
  return localStorage.getItem("hospital_token");
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("hospital_user"));
  } catch {
    return null;
  }
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

function logout() {
  localStorage.removeItem("hospital_token");
  localStorage.removeItem("hospital_user");
  window.location.href = "/admin/";
}

// ─────── Initialization ───────
document.addEventListener("DOMContentLoaded", async () => {
  const token = getToken();
  if (!token) {
    window.location.href = "/admin/";
    return;
  }

  // Verify login credentials
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      logout();
      return;
    }
  } catch (err) {
    logout();
    return;
  }

  // Set up active user identity
  const user = getUser();
  if (user) {
    document.getElementById("userName").textContent = user.username;
    document.getElementById("userRole").textContent = user.role;
    document.getElementById("headerAvatar").textContent = user.username
      .charAt(0)
      .toUpperCase();

    // Nurse Role Access Control
    if (user.role === "nurse") {
      // Hide staff management in navigation menu
      const navStaff = document.getElementById("navStaff");
      if (navStaff) navStaff.style.display = "none";

      // Hide add staff buttons or admin only actions
      document.body.classList.add("nurse-restricted");
    }
  }

  initDateTime();
  initTabNavigation();
  initEventListeners();

  // Load initial tab
  switchTab("overview");
});

// Update the Current Date label
function initDateTime() {
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  document.getElementById("currentDateDisplay").textContent =
    new Date().toLocaleDateString("en-US", options);
}

// ─────── Tab Routing ───────
function initTabNavigation() {
  const navItems = document.querySelectorAll(".sidebar-nav [data-tab]");
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const tabName = item.getAttribute("data-tab");
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  const user = getUser();
  // Prevent nurse accessing staff page directly
  if (tabName === "staff" && user && user.role !== "admin") {
    showToast("Access Denied. Admins only.", "error");
    return;
  }

  activeTab = tabName;

  // Update navigation classes
  document.querySelectorAll(".sidebar-nav [data-tab]").forEach((item) => {
    item.classList.toggle("active", item.getAttribute("data-tab") === tabName);
  });

  // Update panel displays
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabName}`);
  });

  // Update Page Title
  const titles = {
    overview: 'Ozonature <span style="font-size: 12px; font-weight: 500; color: var(--text-muted || var(--text3)); margin-left: 10px; opacity: 0.85;">Powered by Inspenox</span>',
    patients: "Ozonature Patients Registry",
    appointments: "Ozonature Consultation Appointments",
    invoices: "Ozonature Billing & Invoice Receipts",
    staff: "Ozonature Staff Management",
  };
  document.getElementById("pageTitle").innerHTML =
    titles[tabName] || "Dashboard";

  // Load correct tab contents
  if (tabName === "overview") loadOverview();
  else if (tabName === "patients") loadPatients();
  else if (tabName === "appointments") loadAppointments();
  else if (tabName === "invoices") loadInvoices();
  else if (tabName === "staff") loadStaff();

  // Close mobile sidebar on navigate
  document.getElementById("sidebar").classList.remove("open");
}

// ─────── Tab 1: Overview and Reconciliation ───────
async function loadOverview() {
  try {
    const res = await fetch(`${API_BASE}/reconciliation`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast("Failed to load overview data", "error");
      return;
    }

    const s = data.summary;

    // Animate stats numbers
    animateCount("statTotalPatients", s.patientsCount);
    animateCount("statTodayVisits", s.todayAppointmentsCount);

    document.getElementById("statCashReconciliation").textContent =
      formatCurrency(s.cashCollected);
    document.getElementById("statOnlineReconciliation").textContent =
      formatCurrency(s.onlineCollected);
    document.getElementById("statOutstandingDues").textContent = formatCurrency(
      s.totalDue,
    );

    // Render Doctor Productivity Reports
    const docBody = document.getElementById("doctorStatsBody");
    if (s.doctorBreakdown && s.doctorBreakdown.length > 0) {
      docBody.innerHTML = s.doctorBreakdown
        .map(
          (doc) => `
        <tr>
          <td><strong>${esc(doc.doctorName)}</strong></td>
          <td>${doc.visitCount} visits</td>
          <td><strong style="color: var(--primary);">${formatCurrency(doc.totalRevenue)}</strong></td>
        </tr>
      `,
        )
        .join("");
    } else {
      docBody.innerHTML =
        '<tr><td colspan="3" class="empty-cell">No appointment charges processed.</td></tr>';
    }

    // Render Recent Billing list
    const invoicesBody = document.getElementById("recentInvoicesBody");
    if (s.recentActivity && s.recentActivity.length > 0) {
      invoicesBody.innerHTML = s.recentActivity
        .map(
          (inv) => `
        <tr>
          <td><span style="font-family: monospace; font-weight: 600;">${esc(inv.invoice_no)}</span></td>
          <td>${esc(inv.patient_name)}</td>
          <td><strong>${formatCurrency(inv.amount)}</strong></td>
          <td><span class="badge badge-${inv.status === "paid" ? "paid" : inv.status === "partially_paid" ? "partial" : "unpaid"}">${inv.status.replace("_", " ")}</span></td>
        </tr>
      `,
        )
        .join("");
    } else {
      invoicesBody.innerHTML =
        '<tr><td colspan="4" class="empty-cell">No recent invoices logged.</td></tr>';
    }
  } catch (err) {
    showToast("Reconciliation API offline", "error");
  }
}

// ─────── Tab 2: Patients Database ───────
const PROTOCOL_DESCRIPTIONS = {
  "Ozone Therapy":
    "Ozone is a powerful healer it improves oxygen delivery, boosts immunity, reduces inflammation & fights infections.",
  Acupuncture:
    "Ancient healing for modern life. Relieves pain, reduces stress and restores natural balance.",
  "Naturopathy & Detox":
    "Natural therapies to detoxify, rejuvenate and strengthen the body naturally.",
  "Diabetic Wound Care":
    "Advanced wound healing solutions for diabetic foot and chronic wounds.",
  "Pain Management":
    "Non-surgical, drug-free approach to manage acute and chronic pain effectively.",
  "Cupping Therapy":
    "Cupping Therapy improves blood circulation, relieves muscle tension, and supports natural detoxification.",
  "Kansya Therapy":
    "Kansya Therapy is a traditional Indian therapeutic massage performed using a specially crafted Kansa metal tool to promote relaxation, circulation, detoxification, and holistic rejuvenation naturally.",
  "Energy Medicine":
    "Energy Medicine focuses on restoring the body's natural energy balance to support physical, emotional, and holistic well-being.",
  "Therapeutic Wellness Baths":
    "Traditional naturopathy therapies designed to support detoxification, relaxation, circulation, and holistic wellness naturally.",
  "Therapeutic Massages":
    "Therapeutic massages designed to promote relaxation, improve circulation, relieve muscle tension, and support overall physical and mental wellness naturally.",
};

function serializePatientForm() {
  const form = document.getElementById("patientForm");
  const data = {};
  const case_sheet_data = {};

  const inputs = form.querySelectorAll("input, select, textarea");
  inputs.forEach((input) => {
    const name = input.name;
    if (!name) return;

    let value = input.value;
    if (input.type === "checkbox") {
      value = input.checked;
    } else if (input.type === "radio") {
      if (!input.checked) return;
      value = input.value;
    }

    if (name.startsWith("cs_")) {
      const fieldKey = name.replace("cs_", "");
      case_sheet_data[fieldKey] = value;
    } else {
      data[name] = value;
    }
  });

  data.case_sheet_data = JSON.stringify(case_sheet_data);
  return data;
}

function deserializePatientForm(p) {
  const form = document.getElementById("patientForm");
  form.reset();

  document.getElementById("patient_id").value = p.id;
  document.getElementById("patient_name").value = p.full_name;
  document.getElementById("patient_dob").value = p.date_of_birth
    ? p.date_of_birth.split("T")[0]
    : "";
  document.getElementById("patient_gender").value = p.gender || "";
  document.getElementById("patient_mobile").value = p.mobile_no || "";
  document.getElementById("patient_email").value = p.email || "";
  document.getElementById("patient_address").value = p.address || "";
  document.getElementById("patient_history").value = p.medical_history || "";

  form
    .querySelectorAll('input[type="radio"]')
    .forEach((r) => (r.checked = false));

  let caseSheet = {};
  if (p.case_sheet_data) {
    try {
      caseSheet =
        typeof p.case_sheet_data === "string"
          ? JSON.parse(p.case_sheet_data)
          : p.case_sheet_data;
    } catch (e) {
      console.error("Failed to parse case sheet data:", e);
    }
  }

  for (const [key, value] of Object.entries(caseSheet)) {
    const inputName = `cs_${key}`;
    const elements = form.querySelectorAll(`[name="${inputName}"]`);
    elements.forEach((element) => {
      if (element.type === "checkbox") {
        element.checked = !!value;
      } else if (element.type === "radio") {
        if (element.value === value) {
          element.checked = true;
        }
      } else {
        element.value = value || "";
      }
    });
  }
}

function renderCaseSheetHTML(p) {
  const age = p.date_of_birth ? calculateAge(p.date_of_birth) + " yrs" : "—";
  const dob = p.date_of_birth ? formatDate(p.date_of_birth) : "—";
  const gender = p.gender || "—";

  let cs = {};
  if (p.case_sheet_data) {
    try {
      cs =
        typeof p.case_sheet_data === "string"
          ? JSON.parse(p.case_sheet_data)
          : p.case_sheet_data;
    } catch (e) {
      console.error(e);
    }
  }

  function getCheckedItems(prefix, labelsMap) {
    const list = [];
    for (const [key, label] of Object.entries(labelsMap)) {
      if (cs[prefix + key]) {
        list.push(label);
      }
    }
    return list;
  }

  const allergiesMap = {
    drug_allergy: "Drug Allergy",
    environmental_allergy: "Environmental Allergy",
    food_allergy: "Food Allergy",
    no_known_allergies: "No Known Allergies",
  };
  const checkedAllergies = [];
  for (const [k, lbl] of Object.entries(allergiesMap)) {
    if (cs[k]) checkedAllergies.push(lbl);
  }

  const famHistoryMap = {
    diabetes: "Diabetes",
    hypertension: "Hypertension",
    cardiac: "Cardiac Disease",
    cancer: "Cancer",
    thyroid: "Thyroid Disorders",
    neuro: "Neurological Disorders",
    genetic: "Genetic Disorders",
    other: "Other",
  };
  const checkedFamHistory = getCheckedItems("fam_", famHistoryMap);

  const pastConditionsMap = {
    diabetes: "Diabetes Mellitus",
    hypertension: "Hypertension",
    thyroid: "Thyroid Disorder",
    cardiac: "Cardiac Disease",
    asthma: "Asthma / Respiratory Disease",
    arthritis: "Arthritis / Joint Disorders",
    neuro: "Neurological Disorder",
    kidney: "Kidney Disease",
    liver: "Liver Disease",
    skin: "Skin Disorders",
    autoimmune: "Autoimmune Disorders",
    cancer: "Cancer History",
    psychological: "Psychological Disorders",
    other: "Other",
  };
  const checkedPastConditions = getCheckedItems("past_", pastConditionsMap);

  const recTherapiesMap = {
    ozone: "Ozone Therapy",
    iv: "IV Nutritional Therapy",
    physio: "Physiotherapy",
    massage: "Massage Therapy",
    cupping: "Cupping Therapy",
    detox: "Detoxification Therapy",
    pain: "Pain Management Therapy",
    rehab: "Rehabilitation Therapy",
    lifestyle: "Lifestyle Modification Program",
    other: "Other",
  };
  const checkedRecTherapies = getCheckedItems("rec_", recTherapiesMap);

  const prevTreatmentsMap = {
    allopathy: "Allopathy",
    ayurveda: "Ayurveda",
    homeopathy: "Homeopathy",
    physio: "Physiotherapy",
    alternative: "Alternative Therapy",
    none: "None",
  };
  const checkedPrevTreatments = getCheckedItems("prev_", prevTreatmentsMap);

  function displayVal(val) {
    return val
      ? esc(val)
      : '<span style="color:var(--text3); font-style:italic;">—</span>';
  }

  function displayList(list) {
    if (!list || list.length === 0)
      return '<span style="color:var(--text3); font-style:italic;">None listed</span>';
    return `<div class="case-sheet-list">${list.map((item) => `<span class="case-sheet-list-item">${esc(item)}</span>`).join("")}</div>`;
  }

  return `
    <div class="case-sheet-view">
      <!-- 📄 PAGE 1: CLINICAL CASE SHEET -->
      <div class="case-sheet-header">
        <img src="/assets/ozonature%20logo.jpg" alt="Ozonature Logo" style="height: 65px; display: block; margin: 0 auto 12px auto; object-fit: contain;">
        <div class="case-sheet-title">Patient Case Sheet</div>
      </div>

      <div class="case-sheet-section">
        <div class="case-sheet-section-title">Patient Basic Details</div>
        <div class="case-sheet-meta-grid">
          <div class="meta-item"><strong>Patient Name:</strong> ${displayVal(p.full_name)}</div>
          <div class="meta-item"><strong>Mobile Number:</strong> ${displayVal(p.mobile_no)}</div>
          <div class="meta-item"><strong>Age / Gender:</strong> ${age} / ${gender}</div>
          <div class="meta-item"><strong>Date of Birth:</strong> ${dob}</div>
          <div class="meta-item"><strong>Email:</strong> ${displayVal(p.email)}</div>
          <div class="meta-item"><strong>Address:</strong> ${displayVal(p.address)}</div>
        </div>
      </div>

      <div class="case-sheet-section">
        <div class="case-sheet-section-title">Clinical Complaint & History</div>
        <div class="case-sheet-grid">
          <div class="case-sheet-field case-sheet-full-width">
            <strong>Chief Complaint</strong>
            <span class="field-val">${displayVal(cs.chief_complaint)}</span>
          </div>
          <div class="case-sheet-field case-sheet-full-width">
            <strong>History of Present Illness</strong>
            <span class="field-val">${displayVal(cs.history_present_illness)}</span>
          </div>
          <div class="case-sheet-field case-sheet-full-width">
            <strong>Clinical History Notes (Basic Profile)</strong>
            <span class="field-val">${displayVal(p.medical_history)}</span>
          </div>
        </div>
      </div>

      <div class="case-sheet-section">
        <div class="case-sheet-grid">
          <div class="case-sheet-field">
            <strong>Allergies</strong>
            ${displayList(checkedAllergies)}
            <div style="margin-top: 8px;"><strong>Allergies Details:</strong> ${displayVal(cs.allergies_details)}</div>
          </div>
          <div class="case-sheet-field">
            <strong>Family History</strong>
            ${displayList(checkedFamHistory)}
          </div>
        </div>
      </div>

      <div class="case-sheet-section">
        <div class="case-sheet-section-title">Lifestyle & Wellness Assessment</div>
        <div class="case-sheet-grid">
          <div class="case-sheet-field">
            <strong>Smoking</strong>
            <span class="field-val">${displayVal(cs.lifestyle_smoking)}</span>
          </div>
          <div class="case-sheet-field">
            <strong>Alcohol Consumption</strong>
            <span class="field-val">${displayVal(cs.lifestyle_alcohol)}</span>
          </div>
          <div class="case-sheet-field">
            <strong>Sleep Quality</strong>
            <span class="field-val">${displayVal(cs.lifestyle_sleep)}</span>
          </div>
          <div class="case-sheet-field">
            <strong>Physical Activity Level</strong>
            <span class="field-val">${displayVal(cs.lifestyle_activity)}</span>
          </div>
          <div class="case-sheet-field">
            <strong>Water Intake</strong>
            <span class="field-val">${displayVal(cs.lifestyle_water)}</span>
          </div>
          <div class="case-sheet-field">
            <strong>Diet Pattern</strong>
            <span class="field-val">${displayVal(cs.lifestyle_diet)}</span>
          </div>
          <div class="case-sheet-field">
            <strong>Stress Level</strong>
            <span class="field-val">${displayVal(cs.lifestyle_stress)}</span>
          </div>
        </div>
      </div>

      <div class="case-sheet-section">
        <div class="case-sheet-section-title">Vital Signs & Physical Assessment</div>
        <div class="case-sheet-grid">
          <div class="case-sheet-field">
            <strong>Height / Weight / BMI</strong>
            <span class="field-val">${displayVal(cs.vital_height)} cm / ${displayVal(cs.vital_weight)} kg / ${displayVal(cs.vital_bmi)}</span>
          </div>
          <div class="case-sheet-field">
            <strong>Blood Pressure / Pulse</strong>
            <span class="field-val">${displayVal(cs.vital_bp)} / ${displayVal(cs.vital_pulse)} BPM</span>
          </div>
          <div class="case-sheet-field">
            <strong>Temperature / SpO2</strong>
            <span class="field-val">${displayVal(cs.vital_temp)} °F / ${displayVal(cs.vital_spo2)} %</span>
          </div>
          <div class="case-sheet-field case-sheet-full-width">
            <strong>Clinical Examination & Observations</strong>
            <span class="field-val">${displayVal(cs.clinical_examination)}</span>
          </div>
        </div>
      </div>

      <div class="case-sheet-section">
        <div class="case-sheet-section-title">Past Medical Conditions & Treatments</div>
        <div class="case-sheet-grid">
          <div class="case-sheet-field case-sheet-full-width">
            <strong>Medical Conditions</strong>
            ${displayList(checkedPastConditions)}
          </div>
          <div class="case-sheet-field case-sheet-full-width">
            <strong>Previous Surgeries / Hospitalizations</strong>
            <span class="field-val">${displayVal(cs.past_surgeries)}</span>
          </div>
          <div class="case-sheet-field case-sheet-full-width">
            <strong>Current Medications</strong>
            <span class="field-val">${displayVal(cs.past_medications)}</span>
          </div>
        </div>
      </div>

      <div class="case-sheet-section" style="margin-top: 20px;">
        <div class="case-sheet-section-title">Declaration & Signatures</div>
        <p style="font-size: 11.5px; line-height: 1.5; color: var(--text2); font-style: italic; margin-bottom: 20px;">
          I hereby declare that the medical information provided by me is true and complete to the best of my knowledge. I understand that withholding relevant medical information may affect the safety and effectiveness of my treatment. I authorize the healthcare professionals at Ozonature the Holistic Care to evaluate, examine, and provide appropriate wellness therapies and treatment procedures as clinically indicated.
        </p>
        
        <div style="font-size: 13px; margin-bottom: 24px; background-color:#f8fafc; border:1px solid var(--border); border-radius:6px; padding:12px;">
          <strong>Consent Status:</strong> ${cs.consent_agreed ? "✔️ Agreed & Confirmed" : "❌ Pending / Not Signed"}
        </div>

        <div class="case-sheet-signatures">
          <div class="sig-line">
            ${displayVal(cs.patient_signature)}<br>
            Patient Signature (Date: ${cs.signature_date ? formatDate(cs.signature_date) : "—"})
          </div>
          <div class="sig-line">
            ${displayVal(cs.consulting_doctor)}<br>
            Consulting Doctor / Therapist Signature & Seal
          </div>
        </div>

        <div style="text-align: center; font-size: 11px; color: #555555; margin-top: 24px; border-top: 1px dashed #dddddd; padding-top: 8px;">
          Developed & Maintained by <a href="https://inpenox.in" target="_blank" style="color: #00bba8; text-decoration: none; font-weight: 700;">Inpenox</a>
        </div>
      </div>

      <!-- ✂️ PAGE BREAK FOR PRINT -->
      <div class="case-sheet-page-break"></div>

      <!-- 📄 PAGE 2: CLINICAL PROTOCOL & TREATMENT PLAN -->
      <div class="case-sheet-header">
        <img src="/assets/ozonature%20logo.jpg" alt="Ozonature Logo" style="height: 65px; display: block; margin: 0 auto 12px auto; object-fit: contain;">
        <div class="case-sheet-title">Patient Protocol & Treatment Plan</div>
      </div>

      <div class="case-sheet-section">
        <div class="case-sheet-section-title">Patient Identification</div>
        <div class="case-sheet-meta-grid">
          <div class="meta-item"><strong>Patient Name:</strong> ${displayVal(p.full_name)}</div>
          <div class="meta-item"><strong>Mobile Number:</strong> ${displayVal(p.mobile_no)}</div>
          <div class="meta-item"><strong>Date:</strong> ${cs.signature_date ? formatDate(cs.signature_date) : formatDate(new Date().toISOString())}</div>
        </div>
      </div>

      <div class="case-sheet-section">
        <div class="case-sheet-section-title">Clinical Protocol Details</div>
        <div class="case-sheet-grid">
          <div class="case-sheet-field case-sheet-full-width">
            <strong>Selected Protocol / Service</strong>
            <span class="field-val" style="font-weight: 700; color: var(--primary-dark); font-size: 15px;">${displayVal(cs.protocol_service)}</span>
          </div>
          <div class="case-sheet-field case-sheet-full-width">
            <strong>Protocol Description</strong>
            <span class="field-val">${displayVal(cs.protocol_description)}</span>
          </div>
          <div class="case-sheet-field case-sheet-full-width">
            <strong>Provisional Diagnosis / Clinical Impression</strong>
            <span class="field-val" style="font-weight: 600; color: var(--text1);">${displayVal(cs.provisional_diagnosis)}</span>
          </div>
          <div class="case-sheet-field case-sheet-full-width">
            <strong>Recommended Therapies Checklist</strong>
            ${displayList(checkedRecTherapies)}
          </div>
          <div class="case-sheet-field case-sheet-full-width">
            <strong>Treatment Objectives</strong>
            <span class="field-val">${displayVal(cs.treatment_objectives)}</span>
          </div>
          <div class="case-sheet-field">
            <strong>Secondary / Other Conditions</strong>
            <span class="field-val">${displayVal(cs.other_conditions)}</span>
          </div>
          <div class="case-sheet-field">
            <strong>Current Medication / Treatment</strong>
            <span class="field-val">${displayVal(cs.current_medication_treatment)}</span>
          </div>
          <div class="case-sheet-field case-sheet-full-width">
            <strong>Previous Treatments Tried</strong>
            ${displayList(checkedPrevTreatments)}
            <div style="margin-top: 8px;"><strong>Previous Treatments Details:</strong> ${displayVal(cs.prev_treatment_details)}</div>
          </div>
          <div class="case-sheet-field">
            <strong>Preferred Consultation Type</strong>
            <span class="field-val">${displayVal(cs.pref_consultation_type)}</span>
          </div>
          <div class="case-sheet-field">
            <strong>Preferred Date/Time</strong>
            <span class="field-val">${displayVal(cs.pref_date_time)}</span>
          </div>
        </div>
      </div>

      <div class="case-sheet-section" style="margin-top: 20px;">
        <div class="case-sheet-section-title">Protocol Authorization</div>
        <p style="font-size: 11.5px; line-height: 1.5; color: var(--text2); font-style: italic; margin-bottom: 20px;">
          I acknowledge that the treatment protocol and therapies outlined above have been discussed with me. I agree to comply with the recommended treatment plan to ensure the best possible outcomes.
        </p>

        <div class="case-sheet-signatures">
          <div class="sig-line">
            ${displayVal(cs.patient_signature)}<br>
            Patient Signature
          </div>
          <div class="sig-line">
            ${displayVal(cs.consulting_doctor)}<br>
            Consulting Doctor / Therapist Signature & Seal
          </div>
        </div>

        <div style="text-align: center; font-size: 11px; color: #555555; margin-top: 24px; border-top: 1px dashed #dddddd; padding-top: 8px;">
          Developed & Maintained by <a href="https://inpenox.in" target="_blank" style="color: #00bba8; text-decoration: none; font-weight: 700;">Inpenox</a>
        </div>
      </div>
    </div>
  `;
}

window.viewCaseSheet = async function (id) {
  try {
    const res = await fetch(`${API_BASE}/patients/${id}`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const p = data.patient;
      const html = renderCaseSheetHTML(p);
      document.getElementById("caseSheetViewContent").innerHTML = html;

      // Dynamically configure PDF export filename defaults
      const printBtn = document.getElementById("printCaseSheetBtn");
      if (printBtn) {
        printBtn.onclick = () => {
          const originalTitle = document.title;
          const patientNameClean = p.full_name ? p.full_name.trim() : "Patient";
          document.title = `${patientNameClean} - Ozonature`;
          window.print();
          setTimeout(() => {
            document.title = originalTitle;
          }, 1000);
        };
      }

      openModal("caseSheetViewModal");
    } else {
      showToast("Failed to retrieve case sheet data", "error");
    }
  } catch (err) {
    showToast("Failed to fetch case sheet details", "error");
  }
};

async function loadPatients() {
  const tbody = document.getElementById("patientsTableBody");
  tbody.innerHTML =
    '<tr><td colspan="7" class="loading-cell"><span class="spinner"></span> Please wait while we load patients...</td></tr>';

  try {
    let url = `${API_BASE}/patients?page=${patientPage}&limit=10`;
    if (patientSearch) url += `&search=${encodeURIComponent(patientSearch)}`;

    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok || !data.success) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="empty-cell">Error loading patients</td></tr>';
      return;
    }

    const patients = data.patients || [];
    if (patients.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="empty-cell">No patients found. Click "+ Add Patient" to register one.</td></tr>';
      renderPagination("patientsPagination", 1, 1, 1, (p) => {
        patientPage = p;
        loadPatients();
      });
      return;
    }

    const currentUser = getUser();
    const isAdmin = currentUser && currentUser.role === "admin";

    tbody.innerHTML = patients
      .map((p) => {
        const age = p.date_of_birth
          ? calculateAge(p.date_of_birth) + " yrs"
          : "—";
        const gender = p.gender || "—";

        return `
        <tr>
          <td data-label="ID"><span style="color:var(--primary); font-weight:600;">#${p.id}</span></td>
          <td data-label="Name"><strong>${esc(p.full_name)}</strong></td>
          <td data-label="Mobile">${esc(p.mobile_no || "—")}</td>
          <td data-label="Age / Gender">${age} / ${gender}</td>
          <td data-label="Email">${esc(p.email || "—")}</td>
          <td data-label="Case Sheet"><a href="#" class="view-case-sheet-link" onclick="window.viewCaseSheet(${p.id}); event.preventDefault();">View Case Sheet</a></td>
          <td data-label="Actions">
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button class="action-btn btn-edit" onclick="editPatient(${p.id})" title="Edit Profile">Edit</button>
              ${isAdmin ? `<button class="action-btn btn-delete" onclick="deletePatient(${p.id})" title="Delete Profile">Delete</button>` : ""}
            </div>
          </td>
        </tr>
      `;
      })
      .join("");

    const pag = data.pagination || {
      page: 1,
      totalPages: 1,
      total: patients.length,
    };
    renderPagination(
      "patientsPagination",
      pag.page,
      pag.totalPages,
      pag.total,
      (p) => {
        patientPage = p;
        loadPatients();
      },
    );
  } catch (err) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="empty-cell">Failed to retrieve patient logs.</td></tr>';
  }
}

async function savePatient(e) {
  e.preventDefault();
  const btn = document.getElementById("savePatientBtn");
  const originalText = btn.innerHTML;

  btn.innerHTML = "Saving...";
  btn.disabled = true;

  const id = document.getElementById("patient_id").value;
  const data = serializePatientForm();

  try {
    const url = id ? `${API_BASE}/patients/${id}` : `${API_BASE}/patients`;
    const method = id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(data),
    });

    const result = await res.json();
    if (res.ok && result.success) {
      showToast(
        id
          ? "Patient profile updated successfully!"
          : "New patient registered!",
        "success",
      );
      closeModal("patientModal");
      loadPatients();
    } else {
      showToast(result.error || "Failed to submit profile", "error");
    }
  } catch (err) {
    showToast("Network error saving profile", "error");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

window.editPatient = async function (id) {
  try {
    const res = await fetch(`${API_BASE}/patients/${id}`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const p = data.patient;
      document.getElementById("patientModalTitle").textContent =
        "Modify Patient Profile";

      deserializePatientForm(p);

      // Show tab headers and apply modal-lg
      document.getElementById("patientModalTabs").style.display = "flex";
      document
        .getElementById("patientModalContainer")
        .classList.add("modal-lg");

      // Reset tab status to "basic" by default
      document.querySelectorAll(".modal-tab-btn").forEach((btn, idx) => {
        btn.classList.toggle("active", idx === 0);
      });
      document.querySelectorAll(".tab-content-pane").forEach((pane, idx) => {
        pane.classList.toggle("active", idx === 0);
      });

      openModal("patientModal");
    }
  } catch (err) {
    showToast("Failed to fetch patient data", "error");
  }
};

window.deletePatient = async function (id) {
  if (
    !confirm(
      "Are you sure you want to permanently delete this patient? This will delete all linked visits and bills!",
    )
  )
    return;
  try {
    const res = await fetch(`${API_BASE}/patients/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) {
      alert("Patient profile deleted successfully!");
      showToast("Patient profile deleted", "success");
      loadPatients();
    } else {
      const data = await res.json();
      showToast(data.error || "Delete failed", "error");
    }
  } catch {
    showToast("Network error during delete", "error");
  }
};

// ─────── Tab 3: Appointments Schedule ───────
async function loadAppointments() {
  const tbody = document.getElementById("appointmentsTableBody");
  tbody.innerHTML =
    '<tr><td colspan="9" class="loading-cell"><span class="spinner"></span> Querying visit slots...</td></tr>';

  try {
    let url = `${API_BASE}/appointments?page=${appointmentPage}&limit=10`;
    if (appointmentSearch)
      url += `&search=${encodeURIComponent(appointmentSearch)}`;
    if (appointmentDate) url += `&date=${encodeURIComponent(appointmentDate)}`;

    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok || !data.success) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="empty-cell">Error loading appointments</td></tr>';
      return;
    }

    const appointments = data.appointments || [];
    if (appointments.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="empty-cell">No appointments scheduled for selected parameters.</td></tr>';
      renderPagination("appointmentsPagination", 1, 1, 0, (p) => {
        appointmentPage = p;
        loadAppointments();
      });
      return;
    }

    const currentUser = getUser();
    const isAdmin = currentUser && currentUser.role === "admin";

    tbody.innerHTML = appointments
      .map((a) => {
        const date = formatDate(a.appointment_date);
        const time = a.appointment_time.substring(0, 5); // display HH:MM
        const fee = formatCurrency(a.fee);

        let badgeClass = "noshow";
        if (a.status === "scheduled") badgeClass = "scheduled";
        else if (a.status === "completed") badgeClass = "completed";
        else if (a.status === "cancelled") badgeClass = "cancelled";

        const showActions = a.status === "scheduled";

        return `
        <tr>
          <td data-label="ID"><span style="color:var(--primary); font-weight:600;">#${a.id}</span></td>
          <td data-label="Patient Name"><strong>${esc(a.patient_name)}</strong><br><span style="font-size:11px; color:var(--text3);">${esc(a.patient_mobile)}</span></td>
          <td data-label="Doctor Consultant">${esc(a.doctor_name)}</td>
          <td data-label="Visit Date">${date}</td>
          <td data-label="Time slot"><span style="font-family:monospace; font-weight:600;">${time}</span></td>
          <td data-label="Purpose">${esc(a.purpose || "—")}</td>
          <td data-label="Fee Amount"><strong>${fee}</strong></td>
          <td data-label="Status"><span class="badge badge-${badgeClass}">${a.status}</span></td>
          <td data-label="Actions">
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${showActions ? `<button class="action-btn btn-pay" onclick="completeAppointment(${a.id})" title="Mark Visit Completed">Complete</button>` : ""}
              <button class="action-btn btn-edit" onclick="editAppointment(${a.id})" title="Edit Details">Edit</button>
              ${isAdmin ? `<button class="action-btn btn-delete" onclick="deleteAppointment(${a.id})" title="Delete Appointment">Delete</button>` : ""}
            </div>
          </td>
        </tr>
      `;
      })
      .join("");

    const pag = data.pagination || {
      page: 1,
      totalPages: 1,
      total: appointments.length,
    };
    renderPagination(
      "appointmentsPagination",
      pag.page,
      pag.totalPages,
      pag.total,
      (p) => {
        appointmentPage = p;
        loadAppointments();
      },
    );
  } catch (err) {
    tbody.innerHTML =
      '<tr><td colspan="9" class="empty-cell">Failed to retrieve scheduling.</td></tr>';
  }
}

// Auto-fills dropdown of patients when booking a slot
async function loadPatientsDropdown(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  try {
    const res = await fetch(`${API_BASE}/patients?limit=100`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const firstOpt = select.querySelector("option");
      select.innerHTML = "";
      if (firstOpt) select.appendChild(firstOpt);

      (data.patients || []).forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.full_name} (${p.mobile_no || "No Mobile"})`;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.warn("Failed to load patients for select option dropdown:", err);
  }
}

async function saveAppointment(e) {
  e.preventDefault();
  const form = document.getElementById("appointmentForm");
  const btn = document.getElementById("saveAppointmentBtn");
  const originalText = btn.innerHTML;

  btn.innerHTML = "Scheduling...";
  btn.disabled = true;

  const id = document.getElementById("appointment_id").value;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  // Set explicit boolean for checkbox
  data.auto_invoice = document.getElementById("app_autoinvoice").checked;

  try {
    const url = id
      ? `${API_BASE}/appointments/${id}`
      : `${API_BASE}/appointments`;
    const method = id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(data),
    });

    const result = await res.json();
    if (res.ok && result.success) {
      showToast(
        id ? "Appointment modified!" : "Visit scheduled and bill logged!",
        "success",
      );
      closeModal("appointmentModal");
      loadAppointments();
    } else {
      showToast(result.error || "Failed to book slot", "error");
    }
  } catch (err) {
    showToast("Network error booking visit", "error");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

window.editAppointment = async function (id) {
  await loadPatientsDropdown("app_patient_id");
  try {
    const res = await fetch(`${API_BASE}/appointments/${id}`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const a = data.appointment;
      document.getElementById("appointmentModalTitle").textContent =
        "Modify Scheduled Slot";
      document.getElementById("appointment_id").value = a.id;
      document.getElementById("app_patient_id").value = a.patient_id;
      document.getElementById("app_doctor").value = a.doctor_name;
      document.getElementById("app_fee").value = a.fee;
      document.getElementById("app_date").value =
        a.appointment_date.split("T")[0];
      document.getElementById("app_time").value = a.appointment_time;
      document.getElementById("app_purpose").value = a.purpose || "";
      document.getElementById("app_status").value = a.status;

      // Hide auto invoice flag on edit (invoice already exists)
      document.getElementById("autoInvoiceCheckboxGroup").style.display =
        "none";
      document.getElementById("appStatusContainer").style.display = "block";

      openModal("appointmentModal");
    }
  } catch (err) {
    showToast("Failed to fetch visit profile", "error");
  }
};

window.completeAppointment = async function (id) {
  if (
    !confirm(
      "Mark this appointment as Completed? If linked to an unpaid invoice, you should reconcile billing.",
    )
  )
    return;
  try {
    const res = await fetch(`${API_BASE}/appointments/${id}`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const a = data.appointment;
      a.status = "completed";

      const updateRes = await fetch(`${API_BASE}/appointments/${id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(a),
      });
      if (updateRes.ok) {
        showToast("Visit marked Completed!", "success");
        loadAppointments();
      }
    }
  } catch {
    showToast("Error completing visit status", "error");
  }
};

window.deleteAppointment = async function (id) {
  if (
    !confirm(
      "Permanently delete this scheduled slot? Linked invoices remain but appointment link is cleared.",
    )
  )
    return;
  try {
    const res = await fetch(`${API_BASE}/appointments/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) {
      alert("Appointment slot cleared successfully!");
      showToast("Appointment slot cleared", "success");
      loadAppointments();
    } else {
      const data = await res.json();
      showToast(data.error || "Delete failed", "error");
    }
  } catch {
    showToast("Network error clearing appointment", "error");
  }
};

// ─────── Tab 4: Invoicing and Payment Reconciliation ───────
async function loadInvoices() {
  const tbody = document.getElementById("invoicesTableBody");
  tbody.innerHTML =
    '<tr><td colspan="10" class="loading-cell"><span class="spinner"></span> Processing bills ledger...</td></tr>';

  try {
    let url = `${API_BASE}/invoices?page=${invoicePage}&limit=10`;
    if (invoiceSearch) url += `&search=${encodeURIComponent(invoiceSearch)}`;
    if (invoiceStatus) url += `&status=${encodeURIComponent(invoiceStatus)}`;

    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok || !data.success) {
      tbody.innerHTML =
        '<tr><td colspan="10" class="empty-cell">Error loading billing ledger</td></tr>';
      return;
    }

    const invoices = data.invoices || [];
    if (invoices.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="10" class="empty-cell">No billing invoice logs recorded.</td></tr>';
      renderPagination("invoicesPagination", 1, 1, 0, (p) => {
        invoicePage = p;
        loadInvoices();
      });
      return;
    }

    const currentUser = getUser();
    const isAdmin = currentUser && currentUser.role === "admin";

    tbody.innerHTML = invoices
      .map((i) => {
        const date = formatDate(i.created_at);
        const payDate = i.payment_date ? formatDate(i.payment_date) : "—";
        const amount = formatCurrency(i.amount);
        const paid = formatCurrency(i.paid_amount);
        const due = formatCurrency(i.due_amount);
        const payMode = i.payment_mode ? i.payment_mode.toUpperCase() : "—";

        let statusBadge = `<span class="badge badge-unpaid">unpaid</span>`;
        if (i.status === "paid")
          statusBadge = `<span class="badge badge-paid">paid</span>`;
        else if (i.status === "partially_paid")
          statusBadge = `<span class="badge badge-partial">partial</span>`;

        // Show reconciliation trigger only if unpaid or partial
        const isReconAvailable = i.status !== "paid";

        return `
        <tr>
          <td data-label="Invoice No"><span style="font-family: monospace; font-weight: 600;">${esc(i.invoice_no)}</span></td>
          <td data-label="Patient Name"><strong>${esc(i.patient_name)}</strong><br><span style="font-size:11px; color:var(--text3);">${esc(i.patient_mobile)}</span></td>
          <td data-label="Description" style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${esc(i.description)}">${esc(i.description)}</td>
          <td data-label="Total Fee"><strong>${amount}</strong></td>
          <td data-label="Paid Amount"><strong style="color:var(--success);">${paid}</strong></td>
          <td data-label="Outstanding Due"><strong style="color:${parseFloat(i.due_amount) > 0 ? "var(--error)" : "var(--success)"};">${due}</strong></td>
          <td data-label="Payment Status">${statusBadge}</td>
          <td data-label="Payment Mode"><strong>${payMode}</strong></td>
          <td data-label="Payment Date">${payDate}</td>
          <td data-label="Actions">
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${isReconAvailable ? `<button class="action-btn btn-pay" onclick="openReconciliationModal(${i.id}, '${esc(i.invoice_no)}', ${i.amount}, ${i.due_amount})" title="Update Payment Reconciliation (Cash/Online)">Pay Now</button>` : ""}
              <button class="action-btn btn-print" onclick="printInvoiceReceipt(${i.id})" title="Print Invoice / Fee Receipt">Print</button>
              <button class="action-btn btn-download" onclick="downloadInvoiceReceipt(${i.id}, '${esc(i.patient_name)}')" title="Download PDF Fee Receipt">Download</button>
              ${isAdmin ? `<button class="action-btn btn-delete" onclick="deleteInvoice(${i.id})" title="Delete Bill Record">Delete</button>` : ""}
            </div>
          </td>
        </tr>
      `;
      })
      .join("");

    const pag = data.pagination || {
      page: 1,
      totalPages: 1,
      total: invoices.length,
    };
    renderPagination(
      "invoicesPagination",
      pag.page,
      pag.totalPages,
      pag.total,
      (p) => {
        invoicePage = p;
        loadInvoices();
      },
    );
  } catch (err) {
    tbody.innerHTML =
      '<tr><td colspan="10" class="empty-cell">Failed to fetch invoices ledger.</td></tr>';
  }
}

async function saveInvoice(e) {
  e.preventDefault();
  const form = document.getElementById("invoiceForm");
  const btn = document.getElementById("saveInvoiceBtn");
  const originalText = btn.innerHTML;

  btn.innerHTML = "Generating...";
  btn.disabled = true;

  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(`${API_BASE}/invoices`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(data),
    });

    const result = await res.json();
    if (res.ok && result.success) {
      showToast("Custom billing invoice compiled!", "success");
      closeModal("invoiceModal");
      loadInvoices();
    } else {
      showToast(result.error || "Failed to issue invoice", "error");
    }
  } catch (err) {
    showToast("Network error creating invoice", "error");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

window.openReconciliationModal = function (id, invNo, amount, due) {
  document.getElementById("recon_invoice_id").value = id;
  document.getElementById("recon_invoice_amount").value = amount;
  document.getElementById("reconInvoiceNo").textContent = invNo;
  document.getElementById("reconTotalBilled").textContent =
    formatCurrency(amount);
  document.getElementById("reconCurrentDue").textContent = formatCurrency(due);
  document.getElementById("recon_paid_amount").value = due;
  document.getElementById("recon_paid_amount").max = due;

  openModal("reconciliationModal");
};

async function processReconciliation(e) {
  e.preventDefault();
  const id = document.getElementById("recon_invoice_id").value;
  const totalAmount = parseFloat(
    document.getElementById("recon_invoice_amount").value,
  );
  const payAmount = parseFloat(
    document.getElementById("recon_paid_amount").value,
  );
  const mode = document.getElementById("recon_payment_mode").value;

  if (isNaN(payAmount) || payAmount <= 0) {
    showToast("Please enter a valid positive payment amount", "error");
    return;
  }

  try {
    // 1. Fetch current invoice values first to add to existing paid amounts
    const fetchRes = await fetch(`${API_BASE}/invoices/${id}`, {
      headers: authHeaders(),
    });
    const fetchVal = await fetchRes.json();
    if (!fetchRes.ok || !fetchVal.success) {
      showToast("Error validating current invoice dues", "error");
      return;
    }

    const currentPaid = parseFloat(fetchVal.invoice.paid_amount) || 0;
    const finalPaid = currentPaid + payAmount;

    // 2. Perform reconciliation update
    const updateRes = await fetch(`${API_BASE}/invoices/${id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        amount: totalAmount,
        paid_amount: finalPaid,
        payment_mode: mode,
      }),
    });

    const result = await updateRes.json();
    if (updateRes.ok && result.success) {
      showToast(
        `Reconciled ₹ ${payAmount} paid in ${mode.toUpperCase()}!`,
        "success",
      );
      closeModal("reconciliationModal");
      loadInvoices();
    } else {
      showToast(result.error || "Reconciliation failed", "error");
    }
  } catch (err) {
    showToast("Reconciliation API network error", "error");
  }
}

window.downloadInvoiceReceipt = async function (id, patientName) {
  try {
    const res = await fetch(`${API_BASE}/invoices/export-pdf?id=${id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (!res.ok) throw new Error("PDF render failed");

    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${patientName || "Patient"} - Ozonature.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("Receipt PDF downloaded!", "success");
  } catch (err) {
    showToast("Failed to compile PDF receipt", "error");
  }
};

window.printInvoiceReceipt = async function (id) {
  try {
    const res = await fetch(`${API_BASE}/invoices/export-pdf?id=${id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (!res.ok) throw new Error("PDF render failed");

    const blob = await res.blob();
    const fileURL = URL.createObjectURL(blob);

    // Open in a new tab for direct browser viewing and printing
    const printWindow = window.open(fileURL, "_blank");
    if (!printWindow) {
      showToast(
        "Popup blocker prevented opening print window. Please allow popups.",
        "error",
      );
    } else {
      showToast("Opening print view...", "success");
    }
  } catch (err) {
    showToast("Failed to compile print receipt", "error");
  }
};

window.deleteInvoice = async function (id) {
  if (
    !confirm(
      "Permanently delete this invoice? This will wipe the billing records!",
    )
  )
    return;
  try {
    const res = await fetch(`${API_BASE}/invoices/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) {
      alert("Invoice deleted successfully!");
      showToast("Invoice billing wiped", "success");
      loadInvoices();
    } else {
      const data = await res.json();
      showToast(data.error || "Delete failed", "error");
    }
  } catch {
    showToast("Network error deleting invoice", "error");
  }
};

// ─────── Tab 5: Staff Management (Admin Only) ───────
async function loadStaff() {
  const tbody = document.getElementById("staffTableBody");
  tbody.innerHTML =
    '<tr><td colspan="6" class="loading-cell"><span class="spinner"></span> Loading staff logs...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/users`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok || !data.success) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="empty-cell">Access denied or loading failed.</td></tr>';
      return;
    }

    const users = data.users || [];
    tbody.innerHTML = users
      .map((u) => {
        const dateCreated = formatDate(u.created_at);
        const isSelf = u.username === getUser().username;

        const emailVal = u.email
          ? `<div style="font-size:12px; font-weight:500; color:var(--text2);">${esc(u.email)}</div>`
          : "";
        const phoneVal = u.phone
          ? `<div style="font-size:11px; color:var(--text3);">${esc(u.phone)}</div>`
          : "";
        const contactInfo =
          emailVal || phoneVal
            ? `${emailVal}${phoneVal}`
            : '<span style="color:var(--text3); font-style:italic;">—</span>';

        return `
        <tr>
          <td data-label="User ID"><span style="color:var(--primary); font-weight:600;">#${u.id}</span></td>
          <td data-label="Staff Username"><strong>${esc(u.username)}</strong> ${isSelf ? '<span style="font-size:10px; background-color:var(--primary-glow); padding:2px 6px; border-radius:4px; margin-left:6px; color:var(--primary-dark);">You</span>' : ""}</td>
          <td data-label="Contact Info">${contactInfo}</td>
          <td data-label="Role Account Type"><span style="text-transform:uppercase; font-size:11px; font-weight:600; color:var(--text2);">${u.role}</span></td>
          <td data-label="Created Date">${dateCreated}</td>
          <td data-label="Actions">
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button class="action-btn btn-edit" onclick="editStaff(${u.id})" title="Reset Password / Role">Edit</button>
              ${!isSelf ? `<button class="action-btn btn-delete" onclick="deleteStaff(${u.id})" title="Delete Account">Delete</button>` : ""}
            </div>
          </td>
        </tr>
      `;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="empty-cell">Failed to fetch staff registry.</td></tr>';
  }
}

async function saveStaff(e) {
  e.preventDefault();
  const form = document.getElementById("staffForm");
  const btn = document.getElementById("saveStaffBtn");
  const originalText = btn.innerHTML;

  btn.innerHTML = "Saving...";
  btn.disabled = true;

  const id = document.getElementById("staff_id").value;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  try {
    const url = id ? `${API_BASE}/users/${id}` : `${API_BASE}/users`;
    const method = id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(data),
    });

    const result = await res.json();
    if (res.ok && result.success) {
      showToast(
        id
          ? "Staff credentials updated!"
          : "Staff account created successfully!",
        "success",
      );
      closeModal("staffModal");
      loadStaff();
    } else {
      showToast(result.error || "Failed to save staff credentials", "error");
    }
  } catch (err) {
    showToast("Network error saving staff settings", "error");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

window.editStaff = async function (id) {
  try {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const u = data.user;
      document.getElementById("staffModalTitle").textContent =
        "Modify Staff Credentials";
      document.getElementById("staff_id").value = u.id;
      document.getElementById("staff_username").value = u.username;
      document.getElementById("staff_email").value = u.email || "";
      document.getElementById("staff_phone").value = u.phone || "";

      // Update form requirements for resets
      document.getElementById("staff_password").required = false;
      document.getElementById("staff_password").placeholder =
        "Enter password only to reset";
      document.getElementById("staffPassHint").style.display = "block";
      document.getElementById("staffPassLabel").innerHTML = "Reset Password";

      document.getElementById("staff_role").value = u.role;
      document.getElementById("saveStaffBtn").textContent =
        "Update Credentials";

      openModal("staffModal");
    }
  } catch (err) {
    showToast("Failed to load user profile", "error");
  }
};

window.deleteStaff = async function (id) {
  if (
    !confirm(
      "Are you sure you want to delete this staff login? They will lose all access.",
    )
  )
    return;
  try {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) {
      alert("Staff login account removed successfully!");
      showToast("Staff login removed", "success");
      loadStaff();
    } else {
      const data = await res.json();
      showToast(data.error || "Delete failed", "error");
    }
  } catch {
    showToast("Network error removing credentials", "error");
  }
};

// ─────── Event Handlers & Modal Core ───────
function initEventListeners() {
  // Save form bindings
  document
    .getElementById("patientForm")
    .addEventListener("submit", savePatient);
  document
    .getElementById("appointmentForm")
    .addEventListener("submit", saveAppointment);
  document
    .getElementById("invoiceForm")
    .addEventListener("submit", saveInvoice);
  document
    .getElementById("reconciliationForm")
    .addEventListener("submit", processReconciliation);
  document.getElementById("staffForm").addEventListener("submit", saveStaff);

  // Modal form tab clicks
  document.querySelectorAll(".modal-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-form-tab");
      document
        .querySelectorAll(".modal-tab-btn")
        .forEach((b) => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".tab-content-pane").forEach((pane) => {
        pane.classList.toggle("active", pane.id === `form-tab-${targetTab}`);
      });
    });
  });

  // Protocol Selection Change listener
  document
    .getElementById("cs_protocol_service")
    .addEventListener("change", (e) => {
      const selected = e.target.value;
      const descTextarea = document.getElementById("cs_protocol_description");
      if (selected && PROTOCOL_DESCRIPTIONS[selected]) {
        descTextarea.value = PROTOCOL_DESCRIPTIONS[selected];
      } else {
        descTextarea.value = "";
      }
    });

  // Add triggers
  document.getElementById("addPatientBtn").addEventListener("click", () => {
    document.getElementById("patientForm").reset();
    document.getElementById("patient_id").value = "";
    document.getElementById("patientModalTitle").textContent =
      "Register New Patient";

    // Hide tab headers and remove modal-lg
    document.getElementById("patientModalTabs").style.display = "none";
    document
      .getElementById("patientModalContainer")
      .classList.remove("modal-lg");

    // Activate basic pane only
    document.querySelectorAll(".tab-content-pane").forEach((pane) => {
      pane.classList.toggle("active", pane.id === "form-tab-basic");
    });

    openModal("patientModal");
  });

  document
    .getElementById("bookAppointmentBtn")
    .addEventListener("click", async () => {
      document.getElementById("appointmentForm").reset();
      document.getElementById("appointment_id").value = "";
      document.getElementById("appointmentModalTitle").textContent =
        "Schedule Visit";

      // Default slot times and auto invoice checks
      const today = new Date().toISOString().split("T")[0];
      document.getElementById("app_date").value = today;
      document.getElementById("app_time").value = "10:00";
      document.getElementById("app_autoinvoice").checked = true;
      document.getElementById("autoInvoiceCheckboxGroup").style.display =
        "flex";
      document.getElementById("appStatusContainer").style.display = "none";

      await loadPatientsDropdown("app_patient_id");
      openModal("appointmentModal");
    });

  document
    .getElementById("createInvoiceBtn")
    .addEventListener("click", async () => {
      document.getElementById("invoiceForm").reset();
      document.getElementById("invoiceModalTitle").textContent =
        "Create Custom Invoice";
      document.getElementById("invPaymentModeGroup").style.display = "none";

      await loadPatientsDropdown("inv_patient_id");
      openModal("invoiceModal");
    });

  document.getElementById("addStaffBtn").addEventListener("click", () => {
    document.getElementById("staffForm").reset();
    document.getElementById("staff_id").value = "";
    document.getElementById("staffModalTitle").textContent =
      "Create Staff Account";

    document.getElementById("staff_password").required = true;
    document.getElementById("staff_password").placeholder =
      "Enter secure password";
    document.getElementById("staffPassHint").style.display = "none";
    document.getElementById("staffPassLabel").innerHTML =
      'Password <span class="req">*</span>';

    document.getElementById("saveStaffBtn").textContent = "Create Account";
    openModal("staffModal");
  });

  // Dynamic input triggers (Invoice paid state reveals payment mode selection)
  document.getElementById("inv_status").addEventListener("change", (e) => {
    const showPayMode = e.target.value === "paid";
    document.getElementById("invPaymentModeGroup").style.display = showPayMode
      ? "block"
      : "none";
  });

  // Searches & Debounces
  let patientSearchTimeout;
  document
    .getElementById("searchPatientInput")
    .addEventListener("input", (e) => {
      clearTimeout(patientSearchTimeout);
      patientSearchTimeout = setTimeout(() => {
        patientSearch = e.target.value.trim();
        patientPage = 1;
        loadPatients();
      }, 400);
    });

  let appointmentSearchTimeout;
  document
    .getElementById("searchAppointmentInput")
    .addEventListener("input", (e) => {
      clearTimeout(appointmentSearchTimeout);
      appointmentSearchTimeout = setTimeout(() => {
        appointmentSearch = e.target.value.trim();
        appointmentPage = 1;
        loadAppointments();
      }, 400);
    });

  document
    .getElementById("filterAppointmentDate")
    .addEventListener("change", (e) => {
      appointmentDate = e.target.value;
      appointmentPage = 1;
      loadAppointments();
    });

  let invoiceSearchTimeout;
  document
    .getElementById("searchInvoiceInput")
    .addEventListener("input", (e) => {
      clearTimeout(invoiceSearchTimeout);
      invoiceSearchTimeout = setTimeout(() => {
        invoiceSearch = e.target.value.trim();
        invoicePage = 1;
        loadInvoices();
      }, 400);
    });

  document
    .getElementById("filterInvoiceStatus")
    .addEventListener("change", (e) => {
      invoiceStatus = e.target.value;
      invoicePage = 1;
      loadInvoices();
    });

  // Modal Closures
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeModal(btn.getAttribute("data-close"));
    });
  });

  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  // Logout trigger
  document.getElementById("logoutBtn").addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });

  // Sidebar Toggles
  document.getElementById("sidebarToggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.add("open");
  });

  document.getElementById("sidebarClose").addEventListener("click", () => {
    document.getElementById("sidebar").classList.remove("open");
  });

  // Keyboard closures
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay").forEach((modal) => {
        closeModal(modal.id);
      });
    }
  });
}

// ─────── Overlay Helpers ───────
function openModal(id) {
  document.getElementById(id).classList.add("show");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("show");
}

// Pagination Drawing Utility
function renderPagination(
  containerId,
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML =
      totalItems > 0
        ? `<span style="font-size:12px; color:var(--text3);">Showing ${totalItems} records</span>`
        : "";
    return;
  }

  let html = `<span style="font-size:12px; color:var(--text3); margin-right:12px;">Showing ${totalItems} records</span>`;

  // Previous button
  html += `<button class="page-btn" ${currentPage === 1 ? "disabled" : ""} onclick="window.triggerPageChange('${containerId}', ${currentPage - 1})">◀</button>`;

  // Number buttons
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === currentPage ? "active" : ""}" onclick="window.triggerPageChange('${containerId}', ${i})">${i}</button>`;
  }

  // Next button
  html += `<button class="page-btn" ${currentPage === totalPages ? "disabled" : ""} onclick="window.triggerPageChange('${containerId}', ${currentPage + 1})">▶</button>`;

  container.innerHTML = html;

  // Stash target callback globally to allow inline execution in row strings
  window.pageChangeCallbacks = window.pageChangeCallbacks || {};
  window.pageChangeCallbacks[containerId] = onPageChange;
}

window.triggerPageChange = function (containerId, pageNum) {
  if (window.pageChangeCallbacks && window.pageChangeCallbacks[containerId]) {
    window.pageChangeCallbacks[containerId](pageNum);
  }
};

// ─────── Generic Helper Utilities ───────
function formatCurrency(v) {
  if (!v && v !== 0) return "₹ 0.00";
  return (
    "₹ " +
    parseFloat(v).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function calculateAge(dobString) {
  const today = new Date();
  const birthDate = new Date(dobString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;

  let current = 0;
  const duration = 400; // ms
  const steps = 15;
  const increment = Math.ceil(target / steps) || 1;
  const interval = duration / steps;

  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = current;
  }, interval);
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove("show"), 4000);
}

function esc(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
