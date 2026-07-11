// ═══════════════════════════════════════
// STAFF PORTAL DASHBOARD — dashboard.js
// ═══════════════════════════════════════

const API_BASE = "/api";
let activeTab = "overview";

const DEFAULT_CASE_SHEET_CONFIG = {
  protocols: [
    { name: "Ozone Therapy", description: "Ozone is a powerful healer it improves oxygen delivery, boosts immunity, reduces inflammation & fights infections." },
    { name: "Acupuncture", description: "Ancient healing for modern life. Relieves pain, reduces stress and restores natural balance." },
    { name: "Naturopathy & Detox", description: "Natural therapies to detoxify, rejuvenate and strengthen the body naturally." },
    { name: "Diabetic Wound Care", description: "Advanced wound healing solutions for diabetic foot and chronic wounds." },
    { name: "Pain Management", description: "Non-surgical, drug-free approach to manage acute and chronic pain effectively." },
    { name: "Cupping Therapy", description: "Cupping Therapy improves blood circulation, relieves muscle tension, and supports natural detoxification." },
    { name: "Kansya Therapy", description: "Kansya Therapy is a traditional Indian therapeutic massage performed using a specially crafted Kansa metal tool to promote relaxation, circulation, detoxification, and holistic rejuvenation naturally." },
    { name: "Energy Medicine", description: "Energy Medicine focuses on restoring the body's natural energy balance to support physical, emotional, and holistic well-being." },
    { name: "Therapeutic Wellness Baths", description: "Traditional naturopathy therapies designed to support detoxification, relaxation, circulation, and holistic wellness naturally." },
    { name: "Therapeutic Massages", description: "Therapeutic massages designed to promote relaxation, improve circulation, relieve muscle tension, and support overall physical and mental wellness naturally." }
  ],
  past_medical_history: [
    "Diabetes Mellitus",
    "Hypertension",
    "Thyroid Disorder",
    "Cardiac Disease",
    "Asthma / Respiratory",
    "Arthritis / Joint Disorders",
    "Neurological Disorder",
    "Kidney Disease",
    "Liver Disease",
    "Skin Disorders",
    "Autoimmune Disorders",
    "Cancer History",
    "Psychological Disorders"
  ],
  family_history: [
    "Diabetes",
    "Hypertension",
    "Cardiac Disease",
    "Cancer",
    "Thyroid Disorders",
    "Neurological Disorders",
    "Genetic Disorders"
  ],
  recommended_therapies: [
    "Ozone Therapy",
    "IV Nutritional Therapy",
    "Physiotherapy",
    "Massage Therapy",
    "Cupping Therapy",
    "Detoxification Therapy",
    "Pain Management Therapy",
    "Rehabilitation Therapy",
    "Lifestyle Modification Program"
  ],
  previous_treatments: [
    "Allopathy",
    "Ayurveda",
    "Homeopathy",
    "Physiotherapy",
    "Alternative Therapy",
    "None"
  ]
};

window.hospitalCaseSheetConfig = null;

function sanitizeKey(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').trim();
}

async function fetchCaseSheetConfig(force = false) {
  if (window.hospitalCaseSheetConfig && !force) {
    return window.hospitalCaseSheetConfig;
  }
  try {
    const res = await fetch(`${API_BASE}/super?action=case-sheet-config`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success && data.config) {
      window.hospitalCaseSheetConfig = data.config;
      return data.config;
    }
  } catch (err) {
    console.error("Failed to fetch case sheet config:", err);
  }
  window.hospitalCaseSheetConfig = DEFAULT_CASE_SHEET_CONFIG;
  return DEFAULT_CASE_SHEET_CONFIG;
}

function renderDynamicCaseSheetFields(config) {
  // 1. Protocols Select Dropdown
  const protocolSelect = document.getElementById("cs_protocol_service");
  if (protocolSelect && config.protocols) {
    const currentVal = protocolSelect.value;
    protocolSelect.innerHTML = '<option value="">-- Select Service --</option>' + 
      config.protocols.map(p => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join("");
    protocolSelect.value = currentVal;
  }

  // Helper to render a checkbox grid
  function renderGrid(containerId, options, prefix) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const currentStates = {};
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      currentStates[cb.name] = cb.checked;
    });
    const textInput = container.querySelector(`[name="cs_${prefix}other_text"]`);
    const currentText = textInput ? textInput.value : "";

    let html = "";
    options.forEach(opt => {
      const sanitized = sanitizeKey(opt);
      const inputName = `cs_${prefix}${sanitized}`;
      const checked = currentStates[inputName] ? "checked" : "";
      html += `
        <label class="checkbox-label">
          <input type="checkbox" name="${inputName}" value="true" ${checked} data-option-name="${esc(opt)}"> 
          ${esc(opt)}
        </label>
      `;
    });

    const hasOther = options.some(opt => opt.toLowerCase() === "other");
    if (!hasOther) {
      const inputName = `cs_${prefix}other`;
      const checked = currentStates[inputName] ? "checked" : "";
      html += `
        <label class="checkbox-label">
          <input type="checkbox" name="${inputName}" value="true" ${checked} data-option-name="Other"> 
          Other
        </label>
      `;
    }

    const otherInputName = `cs_${prefix}other_text`;
    const otherChecked = currentStates[`cs_${prefix}other`] || currentStates[`cs_${prefix}other_text`] || false;
    const displayStyle = otherChecked ? "block" : "none";
    html += `
      <div class="other-input-wrapper" id="${prefix}other_wrapper" style="grid-column: 1 / -1; display: ${displayStyle}; margin-top: 6px;">
        <input type="text" class="form-control" name="${otherInputName}" value="${esc(currentText)}" placeholder="Please specify details...">
      </div>
    `;

    container.innerHTML = html;

    // Attach click/change listeners to checkbox to toggle "other" text box
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener("change", (e) => {
        const isOther = e.target.getAttribute("data-option-name").toLowerCase() === "other" || e.target.name.endsWith("_other");
        if (isOther) {
          const wrapper = container.querySelector(".other-input-wrapper");
          if (wrapper) {
            wrapper.style.display = e.target.checked ? "block" : "none";
            if (!e.target.checked) {
              const textInp = wrapper.querySelector("input");
              if (textInp) textInp.value = "";
            }
          }
        }
      });
    });
  }

  renderGrid("cs_past_conditions_grid", config.past_medical_history || [], "past_");
  renderGrid("cs_family_history_grid", config.family_history || [], "fam_");
  renderGrid("cs_rec_therapies_grid", config.recommended_therapies || [], "rec_");
  renderGrid("cs_prev_treatments_grid", config.previous_treatments || [], "prev_");
}

// Pagination States
let patientPage = 1;
let appointmentPage = 1;
let invoicePage = 1;
let dischargedPage = 1;

// Search/Filter States
let patientSearch = "";
let appointmentSearch = "";
let dischargedSearch = "";
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

    // Update logo/branding headers dynamically
    const logoBox = document.getElementById("logoBox");
    const brandText = document.getElementById("brandText");
    if (user.hospital_logo) {
      logoBox.innerHTML = `<img src="${user.hospital_logo}" style="width:100%; height:100%; object-fit:cover; border-radius:6px;">`;
      logoBox.style.backgroundColor = "transparent";
      logoBox.style.boxShadow = "none";
    } else {
      logoBox.innerHTML = (user.hospital_name || "I").charAt(0).toUpperCase();
      logoBox.style.backgroundColor = "#00bba8";
    }
    if (brandText) {
      brandText.innerHTML = `${esc(user.hospital_name || "icare")} <span>Staff Portal</span>`;
    }

    document.getElementById("headerAvatar").textContent = user.username
      .charAt(0)
      .toUpperCase();

    // Load dynamic menu items based on roles
    loadDynamicNavigation();
    
    // Fetch custom case sheet configs on load
    await fetchCaseSheetConfig();
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
  if (!user) return;

  // Enforce dynamic sidebar visible navigation checks
  if (user.role !== "super_admin") {
    const navLink = document.getElementById(
      `nav${tabName
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join("")}`,
    );
    if (navLink && navLink.style.display === "none") {
      showToast("Access Denied. Restricted panel view.", "error");
      return;
    }
  }

  // Update tabs active state class
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.getAttribute("data-tab") === tabName);
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabName}`);
  });

  // Update Topbar page title
  const pageTitle = document.getElementById("pageTitle");
  if (pageTitle) {
    if (tabName === "staff") {
      pageTitle.textContent = "User Accounts & Passwords";
    } else {
      pageTitle.textContent =
        tabName.charAt(0).toUpperCase() + tabName.slice(1).replace("-", " ");
    }
  }

  // Load correct tab contents
  if (tabName === "overview") loadOverview();
  else if (tabName === "patients") loadPatients();
  else if (tabName === "appointments") loadAppointments();
  else if (tabName === "invoices") loadInvoices();
  else if (tabName === "staff") loadStaff();
  else if (tabName === "doctors") loadDoctors();
  else if (tabName === "rooms") loadRooms();
  else if (tabName === "hospital-setup") loadHospitalSetup();
  else if (tabName === "super-panel") loadSuperPanel();
  else if (tabName === "receipts-panel") loadReceiptsPanel();
  else if (tabName === "discharged-patients") loadDischargedPatients();

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

  // Render dynamic grids and select options based on current configuration first
  const config = window.hospitalCaseSheetConfig || DEFAULT_CASE_SHEET_CONFIG;
  renderDynamicCaseSheetFields(config);

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

  // Compatibility mapping for old keys
  if (caseSheet.past_diabetes && !caseSheet.past_diabetes_mellitus) caseSheet.past_diabetes_mellitus = caseSheet.past_diabetes;
  if (caseSheet.past_thyroid && !caseSheet.past_thyroid_disorder) caseSheet.past_thyroid_disorder = caseSheet.past_thyroid;
  if (caseSheet.past_cardiac && !caseSheet.past_cardiac_disease) caseSheet.past_cardiac_disease = caseSheet.past_cardiac;
  if (caseSheet.past_asthma && !caseSheet.past_asthma_respiratory) caseSheet.past_asthma_respiratory = caseSheet.past_asthma;
  if (caseSheet.past_arthritis && !caseSheet.past_arthritis_joint_disorders) caseSheet.past_arthritis_joint_disorders = caseSheet.past_arthritis;
  if (caseSheet.past_neuro && !caseSheet.past_neurological_disorder) caseSheet.past_neurological_disorder = caseSheet.past_neuro;
  if (caseSheet.past_kidney && !caseSheet.past_kidney_disease) caseSheet.past_kidney_disease = caseSheet.past_kidney;
  if (caseSheet.past_liver && !caseSheet.past_liver_disease) caseSheet.past_liver_disease = caseSheet.past_liver;
  if (caseSheet.past_skin && !caseSheet.past_skin_disorders) caseSheet.past_skin_disorders = caseSheet.past_skin;
  if (caseSheet.past_autoimmune && !caseSheet.past_autoimmune_disorders) caseSheet.past_autoimmune_disorders = caseSheet.past_autoimmune;
  if (caseSheet.past_cancer && !caseSheet.past_cancer_history) caseSheet.past_cancer_history = caseSheet.past_cancer;
  if (caseSheet.past_psychological && !caseSheet.past_psychological_disorders) caseSheet.past_psychological_disorders = caseSheet.past_psychological;

  if (caseSheet.fam_cardiac && !caseSheet.fam_cardiac_disease) caseSheet.fam_cardiac_disease = caseSheet.fam_cardiac;
  if (caseSheet.fam_thyroid && !caseSheet.fam_thyroid_disorders) caseSheet.fam_thyroid_disorders = caseSheet.fam_thyroid;
  if (caseSheet.fam_neuro && !caseSheet.fam_neurological_disorders) caseSheet.fam_neurological_disorders = caseSheet.fam_neuro;
  if (caseSheet.fam_genetic && !caseSheet.fam_genetic_disorders) caseSheet.fam_genetic_disorders = caseSheet.fam_genetic;

  if (caseSheet.rec_ozone && !caseSheet.rec_ozone_therapy) caseSheet.rec_ozone_therapy = caseSheet.rec_ozone;
  if (caseSheet.rec_iv && !caseSheet.rec_iv_nutritional_therapy) caseSheet.rec_iv_nutritional_therapy = caseSheet.rec_iv;
  if (caseSheet.rec_physio && !caseSheet.rec_physiotherapy) caseSheet.rec_physiotherapy = caseSheet.rec_physio;
  if (caseSheet.rec_massage && !caseSheet.rec_massage_therapy) caseSheet.rec_massage_therapy = caseSheet.rec_massage;
  if (caseSheet.rec_cupping && !caseSheet.rec_cupping_therapy) caseSheet.rec_cupping_therapy = caseSheet.rec_cupping;
  if (caseSheet.rec_detox && !caseSheet.rec_detoxification_therapy) caseSheet.rec_detoxification_therapy = caseSheet.rec_detox;
  if (caseSheet.rec_pain && !caseSheet.rec_pain_management_therapy) caseSheet.rec_pain_management_therapy = caseSheet.rec_pain;
  if (caseSheet.rec_rehab && !caseSheet.rec_rehabilitation_therapy) caseSheet.rec_rehabilitation_therapy = caseSheet.rec_rehab;
  if (caseSheet.rec_lifestyle && !caseSheet.rec_lifestyle_modification_program) caseSheet.rec_lifestyle_modification_program = caseSheet.rec_lifestyle;

  if (caseSheet.prev_physio && !caseSheet.prev_physiotherapy) caseSheet.prev_physiotherapy = caseSheet.prev_physio;
  if (caseSheet.prev_alternative && !caseSheet.prev_alternative_therapy) caseSheet.prev_alternative_therapy = caseSheet.prev_alternative;

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

  // After setting element values, toggle visibility of other wrappers
  ["past_", "fam_", "rec_", "prev_"].forEach(prefix => {
    const otherCheckbox = form.querySelector(`[name="cs_${prefix}other"]`);
    const wrapper = document.getElementById(`${prefix}other_wrapper`);
    if (wrapper) {
      const isChecked = otherCheckbox && otherCheckbox.checked;
      wrapper.style.display = isChecked ? "block" : "none";
    }
  });
}

function renderCaseSheetHTML(p) {
  const age = p.date_of_birth ? calculateAge(p.date_of_birth) + " yrs" : "—";
  const dob = p.date_of_birth ? formatDate(p.date_of_birth) : "—";
  const gender = p.gender || "—";

  const user = getUser();
  const dynHospTitle =
    user && user.hospital_name ? user.hospital_name.toUpperCase() : "icare";
  const headerLogoHTML =
    user && user.hospital_logo
      ? `<img src="${user.hospital_logo}" style="max-height:50px; display:block; margin: 0 auto 8px auto; object-fit: contain;">`
      : `<div style="font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 800; color: #00bba8; letter-spacing: 0.5px; text-align: center; margin-bottom: 8px;">${dynHospTitle}</div>`;

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

  // Compatibility mapping for old keys
  if (cs.past_diabetes && !cs.past_diabetes_mellitus) cs.past_diabetes_mellitus = cs.past_diabetes;
  if (cs.past_thyroid && !cs.past_thyroid_disorder) cs.past_thyroid_disorder = cs.past_thyroid;
  if (cs.past_cardiac && !cs.past_cardiac_disease) cs.past_cardiac_disease = cs.past_cardiac;
  if (cs.past_asthma && !cs.past_asthma_respiratory) cs.past_asthma_respiratory = cs.past_asthma;
  if (cs.past_arthritis && !cs.past_arthritis_joint_disorders) cs.past_arthritis_joint_disorders = cs.past_arthritis;
  if (cs.past_neuro && !cs.past_neurological_disorder) cs.past_neurological_disorder = cs.past_neuro;
  if (cs.past_kidney && !cs.past_kidney_disease) cs.past_kidney_disease = cs.past_kidney;
  if (cs.past_liver && !cs.past_liver_disease) cs.past_liver_disease = cs.past_liver;
  if (cs.past_skin && !cs.past_skin_disorders) cs.past_skin_disorders = cs.past_skin;
  if (cs.past_autoimmune && !cs.past_autoimmune_disorders) cs.past_autoimmune_disorders = cs.past_autoimmune;
  if (cs.past_cancer && !cs.past_cancer_history) cs.past_cancer_history = cs.past_cancer;
  if (cs.past_psychological && !cs.past_psychological_disorders) cs.past_psychological_disorders = cs.past_psychological;

  if (cs.fam_cardiac && !cs.fam_cardiac_disease) cs.fam_cardiac_disease = cs.fam_cardiac;
  if (cs.fam_thyroid && !cs.fam_thyroid_disorders) cs.fam_thyroid_disorders = cs.fam_thyroid;
  if (cs.fam_neuro && !cs.fam_neurological_disorders) cs.fam_neurological_disorders = cs.fam_neuro;
  if (cs.fam_genetic && !cs.fam_genetic_disorders) cs.fam_genetic_disorders = cs.fam_genetic;

  if (cs.rec_ozone && !cs.rec_ozone_therapy) cs.rec_ozone_therapy = cs.rec_ozone;
  if (cs.rec_iv && !cs.rec_iv_nutritional_therapy) cs.rec_iv_nutritional_therapy = cs.rec_iv;
  if (cs.rec_physio && !cs.rec_physiotherapy) cs.rec_physiotherapy = cs.rec_physio;
  if (cs.rec_massage && !cs.rec_massage_therapy) cs.rec_massage_therapy = cs.rec_massage;
  if (cs.rec_cupping && !cs.rec_cupping_therapy) cs.rec_cupping_therapy = cs.rec_cupping;
  if (cs.rec_detox && !cs.rec_detoxification_therapy) cs.rec_detoxification_therapy = cs.rec_detox;
  if (cs.rec_pain && !cs.rec_pain_management_therapy) cs.rec_pain_management_therapy = cs.rec_pain;
  if (cs.rec_rehab && !cs.rec_rehabilitation_therapy) cs.rec_rehabilitation_therapy = cs.rec_rehab;
  if (cs.rec_lifestyle && !cs.rec_lifestyle_modification_program) cs.rec_lifestyle_modification_program = cs.rec_lifestyle;

  if (cs.prev_physio && !cs.prev_physiotherapy) cs.prev_physiotherapy = cs.prev_physio;
  if (cs.prev_alternative && !cs.prev_alternative_therapy) cs.prev_alternative_therapy = cs.prev_alternative;

  const config = window.hospitalCaseSheetConfig || DEFAULT_CASE_SHEET_CONFIG;

  function getCheckedItems(prefix, optionsList) {
    const list = [];
    (optionsList || []).forEach(opt => {
      const sanitized = sanitizeKey(opt);
      if (cs[prefix + sanitized]) {
        list.push(opt);
      }
    });
    if (cs[prefix + "other"]) {
      const otherVal = cs[prefix + "other_text"];
      list.push(otherVal ? `Other: ${otherVal}` : "Other");
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

  const checkedFamHistory = getCheckedItems("fam_", config.family_history);
  const checkedPastConditions = getCheckedItems("past_", config.past_medical_history);
  const checkedRecTherapies = getCheckedItems("rec_", config.recommended_therapies);
  const checkedPrevTreatments = getCheckedItems("prev_", config.previous_treatments);

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
        ${headerLogoHTML}
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
          I hereby declare that the medical information provided by me is true and complete to the best of my knowledge. I understand that withholding relevant medical information may affect the safety and effectiveness of my treatment. I authorize the healthcare professionals at icare Clinic ERP and associated practitioners to evaluate, examine, and provide appropriate wellness therapies and treatment procedures as clinically indicated.
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
          Developed & Maintained by <a href="https://inspenox.in" target="_blank" style="color: #00bba8; text-decoration: none; font-weight: 700;">inspenox</a>
        </div>
      </div>

      <!-- ✂️ PAGE BREAK FOR PRINT -->
      <div class="case-sheet-page-break"></div>

      <!-- 📄 PAGE 2: CLINICAL PROTOCOL & TREATMENT PLAN -->
      <div class="case-sheet-header">
        ${headerLogoHTML}
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
          Developed & Maintained by <a href="https://inspenox.in" target="_blank" style="color: #00bba8; text-decoration: none; font-weight: 700;">inspenox</a>
        </div>
      </div>

      <!-- PAGE 3: DOCTOR VISITS HISTORY (DYNAMIC IF DATA EXISTS) -->
      ${(() => {
        if (
          cs.doctor_visits &&
          Array.isArray(cs.doctor_visits) &&
          cs.doctor_visits.length > 0
        ) {
          const rowsHTML = cs.doctor_visits
            .map(
              (v) => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${formatDate(v.visit_date)}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight:600;">${esc(v.doctor_name)}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size:11px; color:#555;">Temp: ${esc(v.temp)} &deg;F | BP: ${esc(v.bp)} | HR: ${esc(v.hr)} bpm</td>
              <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${esc(v.notes)}</td>
            </tr>
          `,
            )
            .join("");

          const dynHospTitle =
            user && user.hospital_name
              ? user.hospital_name.toUpperCase()
              : "icare";

          return `
            <div class="case-sheet-page-break"></div>
            <div class="case-sheet-header" style="margin-top: 40px;">
              ${headerLogoHTML}
              <div class="case-sheet-title">Patient Progress & Doctor Visits Sheet</div>
            </div>

            <div class="case-sheet-section">
              <div class="case-sheet-section-title">Patient Identification</div>
              <div class="case-sheet-meta-grid">
                <div class="meta-item"><strong>Patient Name:</strong> ${displayVal(p.full_name)}</div>
                <div class="meta-item"><strong>Mobile Number:</strong> ${displayVal(p.mobile_no)}</div>
                <div class="meta-item"><strong>Total Visits:</strong> ${cs.doctor_visits.length}</div>
              </div>
            </div>

            <div class="case-sheet-section" style="margin-top: 20px;">
              <div class="case-sheet-section-title">In-Room Checkups & Vitals Log</div>
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; margin-top: 10px;">
                <thead>
                  <tr style="background-color: #f8fafc; font-weight: bold; border-bottom: 2px solid #e2e8f0;">
                    <th style="padding: 8px; border-bottom: 2px solid #e2e8f0;">Date</th>
                    <th style="padding: 8px; border-bottom: 2px solid #e2e8f0;">Doctor</th>
                    <th style="padding: 8px; border-bottom: 2px solid #e2e8f0;">Vitals Checked</th>
                    <th style="padding: 8px; border-bottom: 2px solid #e2e8f0;">Clinical Notes / Observations</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHTML}
                </tbody>
              </table>
              
              <div style="text-align: center; font-size: 11px; color: #555555; margin-top: 30px; border-top: 1px dashed #dddddd; padding-top: 8px;">
                Developed & Maintained by <a href="https://inspenox.in" target="_blank" style="color: #00bba8; text-decoration: none; font-weight: 700;">inspenox</a>
              </div>
            </div>
          `;
        }
        return "";
      })()}
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
          document.title = `${patientNameClean} - icare`;
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

async function populateDoctorsAndPatientsDropdowns() {
  const docSelect = document.getElementById("cs_consulting_doctor");
  const patSelect = document.getElementById("cs_patient_signature");

  if (!docSelect && !patSelect) return;

  try {
    const docRes = await fetch(`${API_BASE}/doctors`, { headers: authHeaders() });
    const docData = await docRes.json();
    if (docRes.ok && docData.success && docData.doctors) {
      const currentDocVal = docSelect ? docSelect.value : "";
      if (docSelect) {
        docSelect.innerHTML = '<option value="">-- Select Doctor --</option>' +
          docData.doctors.map(d => `<option value="${esc(d.name)}">${esc(d.name)} (${esc(d.specialization)})</option>`).join("");
        docSelect.value = currentDocVal;
      }
    }
  } catch (err) {
    console.error("Failed to populate doctors select:", err);
  }

  try {
    const patRes = await fetch(`${API_BASE}/patients?limit=1000`, { headers: authHeaders() });
    const patData = await patRes.json();
    if (patRes.ok && patData.success && patData.patients) {
      const currentPatVal = patSelect ? patSelect.value : "";
      if (patSelect) {
        patSelect.innerHTML = '<option value="">-- Select Patient --</option>' +
          patData.patients.map(p => `<option value="${esc(p.full_name)}">${esc(p.full_name)}</option>`).join("");
        patSelect.value = currentPatVal;
      }
    }
  } catch (err) {
    console.error("Failed to populate patients select:", err);
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

      await populateDoctorsAndPatientsDropdowns();

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

window.openReconciliationModal = async function (id, invNo, amount, due) {
  document.getElementById("recon_invoice_id").value = id;
  document.getElementById("recon_invoice_amount").value = amount;
  document.getElementById("reconInvoiceNo").textContent = invNo;
  document.getElementById("reconTotalBilled").textContent =
    formatCurrency(amount);
  document.getElementById("reconCurrentDue").textContent = formatCurrency(due);
  document.getElementById("recon_paid_amount").value = due;
  document.getElementById("recon_paid_amount").max = due;

  // Clear previous details
  const detailsBox = document.getElementById("reconItemsDetailsBox");
  const itemsContainer = document.getElementById("reconBillItemsContainer");
  if (detailsBox) detailsBox.style.display = "none";
  if (itemsContainer) itemsContainer.innerHTML = "";

  // Fetch detailed invoice info to populate items and GST details
  try {
    const res = await fetch(`${API_BASE}/invoices?id=${id}`, { headers: authHeaders() });
    const data = await res.json();
    if (res.ok && data.success && data.invoice) {
      const inv = data.invoice;
      
      const taxRate = parseFloat(inv.gst_rate) || 0.00;
      const taxAmt = parseFloat(inv.gst_amount) || 0.00;
      const taxable = parseFloat(inv.taxable_amount) || parseFloat(inv.amount);
      const taxName = (inv.tax_name || "GST").toUpperCase();

      const taxableEl = document.getElementById("reconTaxableAmount");
      const taxLabelEl = document.getElementById("reconTaxLabel");
      const taxAmountEl = document.getElementById("reconTaxAmount");

      if (taxableEl) taxableEl.textContent = formatCurrency(taxable);
      if (taxLabelEl) taxLabelEl.textContent = `${taxName} (${taxRate}%):`;
      if (taxAmountEl) taxAmountEl.textContent = formatCurrency(taxAmt);
      if (detailsBox) detailsBox.style.display = "block";

      if (inv.allocation_id && itemsContainer) {
        try {
          const resAll = await fetch(`${API_BASE}/rooms/allocations/${inv.allocation_id}`, { headers: authHeaders() });
          const dataAll = await resAll.json();
          if (resAll.ok && dataAll.success) {
            const alloc = dataAll.allocation;
            
            const now = alloc.status === 'discharged' && alloc.discharged_at ? new Date(alloc.discharged_at) : new Date();
            const admit = new Date(alloc.admitted_at);
            const diffMs = now - admit;
            const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
            const price = parseFloat(alloc.price_per_day) || 0;
            const roomTotal = price * days;

            let itemsHtml = `
              <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-weight:600;">
                <span>Room Stay (${days} ${days === 1 ? 'day' : 'days'})</span>
                <span>${formatCurrency(roomTotal)}</span>
              </div>
            `;

            const resSvc = await fetch(`${API_BASE}/rooms?action=services&allocation_id=${inv.allocation_id}`, { headers: authHeaders() });
            const dataSvc = await resSvc.json();
            if (resSvc.ok && dataSvc.success) {
              const services = dataSvc.services || [];
              services.forEach(s => {
                const itemTotal = parseFloat(s.price) * s.quantity;
                const qtyStr = s.quantity > 1 ? ` x${s.quantity}` : '';
                itemsHtml += `
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>${esc(s.service_name)}${qtyStr}</span>
                    <span>${formatCurrency(itemTotal)}</span>
                  </div>
                `;
              });
            }
            itemsContainer.innerHTML = itemsHtml;
          }
        } catch (err) {
          console.error("Failed to load allocation details for billing popup:", err);
        }
      } else if (itemsContainer) {
        itemsContainer.innerHTML = `
          <div style="display:flex; justify-content:space-between; font-weight:600;">
            <span>${esc(inv.description || "Medical Consultation Fee")}</span>
            <span>${formatCurrency(taxable)}</span>
          </div>
        `;
      }
    }
  } catch (err) {
    console.error("Failed to load billing breakdown details:", err);
  }

  // Load transaction receipts log dynamically
  loadInvoiceReceiptsLog(id);

  openModal("reconciliationModal");
};


async function processReconciliation(e) {
  e.preventDefault();
  const id = document.getElementById("recon_invoice_id").value;
  const payAmount = parseFloat(
    document.getElementById("recon_paid_amount").value,
  );
  const mode = document.getElementById("recon_payment_mode").value;

  if (isNaN(payAmount) || payAmount <= 0) {
    showToast("Please enter a valid positive payment amount", "error");
    return;
  }

  try {
    const updateRes = await fetch(`${API_BASE}/invoices/${id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        amount_paid: payAmount,
        payment_mode: mode,
      }),
    });

    const result = await updateRes.json();
    if (updateRes.ok && result.success) {
      showToast(
        `Recorded ₹ ${payAmount} paid in ${mode.toUpperCase()}!`,
        "success",
      );
      loadInvoiceReceiptsLog(id);
      document.getElementById("recon_paid_amount").value = "";
      const newInvoice = result.invoice;
      document.getElementById("reconCurrentDue").textContent = formatCurrency(
        newInvoice.due_amount,
      );
      document.getElementById("recon_paid_amount").value =
        newInvoice.due_amount;
      document.getElementById("recon_paid_amount").max = newInvoice.due_amount;
      loadInvoices();
    } else {
      showToast(result.error || "Payment processing failed", "error");
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
    a.download = `${patientName || "Patient"} - icare.pdf`;
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
      const user = getUser();
      if (user && user.role === "super_admin") {
        const activeHospSelect = document.getElementById(
          "super_user_hospital_select",
        );
        if (activeHospSelect) {
          loadSuperHospitalUsers(activeHospSelect.value);
        }
      } else {
        loadStaff();
      }
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
        "Modify User Credentials";
      document.getElementById("staff_id").value = u.id;
      document.getElementById("staff_username").value = u.username;
      document.getElementById("staff_email").value = u.email || "";
      document.getElementById("staff_phone").value = u.phone || "";

      // Handle target hospital selection display
      const staffHospGroup = document.getElementById("staff_hosp_group");
      const staffHospSelect = document.getElementById("staff_hospital_id");
      const user = getUser();
      if (user && user.role === "super_admin") {
        if (staffHospGroup) staffHospGroup.style.display = "block";
        if (staffHospSelect) staffHospSelect.value = u.hospital_id || "";
      } else {
        if (staffHospGroup) staffHospGroup.style.display = "none";
      }

      // Update form requirements for resets
      document.getElementById("staff_password").required = false;
      document.getElementById("staff_password").placeholder =
        "Enter password only to reset";
      document.getElementById("staffPassHint").style.display = "block";
      document.getElementById("staffPassLabel").innerHTML = "Reset Password";

      // Populate custom roles dropdown for the user's hospital
      const hospId = u.hospital_id || 1;
      await populateStaffRoleDropdown(hospId);

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
      const user = getUser();
      if (user && user.role === "super_admin") {
        const activeHospSelect = document.getElementById(
          "super_user_hospital_select",
        );
        if (activeHospSelect) {
          loadSuperHospitalUsers(activeHospSelect.value);
        }
      } else {
        loadStaff();
      }
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
  document.getElementById("doctorForm").addEventListener("submit", saveDoctor);
  document.getElementById("roomForm").addEventListener("submit", saveRoom);
  document
    .getElementById("allocationForm")
    .addEventListener("submit", saveAllocation);
  document
    .getElementById("visitForm")
    .addEventListener("submit", saveDoctorVisit);
  document
    .getElementById("hospitalSetupForm")
    .addEventListener("submit", saveHospitalSetup);
  document
    .getElementById("superHospitalForm")
    .addEventListener("submit", saveSuperHospital);
  document
    .getElementById("superRoleForm")
    .addEventListener("submit", saveSuperRole);

  // File logo upload read DataURL base64
  document.getElementById("hosp_logo_file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (evt) {
        const preview = document.getElementById("hosp_logo_preview");
        const emptyText = document.getElementById("hosp_logo_empty_text");
        if (preview) preview.src = evt.target.result;
        if (preview) preview.style.display = "block";
        if (emptyText) emptyText.style.display = "none";
        window.tempHospitalLogoBase64 = evt.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  const superHospLogoFile = document.getElementById("super_hosp_logo_file");
  if (superHospLogoFile) {
    superHospLogoFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (evt) {
          window.tempHospitalLogoBase64 = evt.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Dynamic menu mapper updates
  document
    .getElementById("menu_role_select")
    .addEventListener("change", (e) => {
      loadRoleMenusConfig(e.target.value);
    });

  document.getElementById("loadMenuConfigBtn").addEventListener("click", () => {
    const role = document.getElementById("menu_role_select").value;
    loadRoleMenusConfig(role);
  });

  document
    .getElementById("saveMenuConfigBtn")
    .addEventListener("click", saveRoleMenu);

  document.getElementById("addHospBtn").addEventListener("click", () => {
    document.getElementById("superHospitalForm").reset();
    document.getElementById("super_hosp_id").value = "";
    document.getElementById("superHospitalModalTitle").textContent =
      "Add Hospital Registry";
    document.getElementById("superHospitalSubmitBtn").textContent =
      "Create Hospital";
    window.tempHospitalLogoBase64 = "";
    openModal("superHospitalModal");
  });

  document.getElementById("createRoleBtn").addEventListener("click", () => {
    document.getElementById("superRoleForm").reset();
    document.getElementById("super_role_id").value = "";
    document.getElementById("superRoleModalTitle").textContent =
      "Create Custom Role";
    document.getElementById("superRoleSubmitBtn").textContent = "Create Role";
    const hospGroup = document.getElementById("super_role_hosp_group");
    if (hospGroup) hospGroup.style.display = "block";
    openModal("superRoleModal");
  });

  const superMenuHospitalSelect = document.getElementById(
    "super_menu_hospital_select",
  );
  if (superMenuHospitalSelect) {
    superMenuHospitalSelect.addEventListener("change", (e) => {
      loadSuperRoles(e.target.value);
    });
  }

  const menuRoleSelect = document.getElementById("menu_role_select");
  if (menuRoleSelect) {
    menuRoleSelect.addEventListener("change", (e) => {
      loadRoleMenusConfig(e.target.value);
    });
  }

  // Add triggers
  document.getElementById("addDoctorBtn").addEventListener("click", () => {
    document.getElementById("doctorForm").reset();
    document.getElementById("doctor_id").value = "";
      document.getElementById("doctorModalTitle").textContent =
        "Register New Doctor";
      openModal("doctorModal");
    });
  }

  const addRoomBtn = document.getElementById("addRoomBtn");
  if (addRoomBtn) {
    addRoomBtn.addEventListener("click", () => {
      document.getElementById("roomForm").reset();
      document.getElementById("room_id").value = "";
      document.getElementById("room_capacity").value = "1";
      document.getElementById("roomModalTitle").textContent = "Add Clinical Room";

      const roomHospGroup = document.getElementById("room_hosp_group");
      if (roomHospGroup) roomHospGroup.style.display = "none";

      openModal("roomModal");
    });
  }

  const superAddRoomBtn = document.getElementById("superAddRoomBtn");
  if (superAddRoomBtn) {
    superAddRoomBtn.addEventListener("click", () => {
      document.getElementById("roomForm").reset();
      document.getElementById("room_id").value = "";
      document.getElementById("room_capacity").value = "1";
      document.getElementById("roomModalTitle").textContent =
        "Add Clinical Room to Hospital";

      const roomHospGroup = document.getElementById("room_hosp_group");
      if (roomHospGroup) roomHospGroup.style.display = "block";

      const superRoomHospSelect = document.getElementById(
        "super_room_hospital_select",
      );
      const roomHospSelect = document.getElementById("room_hospital_id");
      if (superRoomHospSelect && roomHospSelect) {
        roomHospSelect.value = superRoomHospSelect.value;
      }

      openModal("roomModal");
    });
  }

  const superFetchRoomsBtn = document.getElementById("superFetchRoomsBtn");
  if (superFetchRoomsBtn) {
    superFetchRoomsBtn.addEventListener("click", () => {
      const hospId = document.getElementById(
        "super_room_hospital_select",
      ).value;
      loadSuperHospitalRooms(hospId);
    });
  }

  const superRoomHospitalSelect = document.getElementById(
    "super_room_hospital_select",
  );
  if (superRoomHospitalSelect) {
    superRoomHospitalSelect.addEventListener("change", (e) => {
      loadSuperHospitalRooms(e.target.value);
    });
  }

  document
    .getElementById("allocateRoomBtn")
    .addEventListener("click", async () => {
      document.getElementById("allocationForm").reset();
      await populateAllocationModalDropdowns();
      openModal("allocationModal");
    });

  document.getElementById("logVisitBtn").addEventListener("click", async () => {
    document.getElementById("visitForm").reset();
    await populateVisitModalDropdowns();
    openModal("visitModal");
  });

  let doctorSearchTimeout;
  document
    .getElementById("searchDoctorInput")
    .addEventListener("input", (e) => {
      clearTimeout(doctorSearchTimeout);
      doctorSearchTimeout = setTimeout(() => {
        loadDoctors(e.target.value.trim());
      }, 400);
    });

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

  document.getElementById("addStaffBtn").addEventListener("click", async () => {
    document.getElementById("staffForm").reset();
    document.getElementById("staff_id").value = "";
    document.getElementById("staffModalTitle").textContent =
      "Create Staff Account";

    // Hide target hospital selector for regular admins
    const staffHospGroup = document.getElementById("staff_hosp_group");
    if (staffHospGroup) staffHospGroup.style.display = "none";

    const u = getUser();
    await populateStaffRoleDropdown(u ? u.hospital_id : 1);

    document.getElementById("staff_password").required = true;
    document.getElementById("staff_password").placeholder =
      "Enter secure password";
    document.getElementById("staffPassHint").style.display = "none";
    document.getElementById("staffPassLabel").innerHTML =
      'Password <span class="req">*</span>';

    document.getElementById("saveStaffBtn").textContent = "Create Account";
    openModal("staffModal");
  });

  const superAddUserBtn = document.getElementById("superAddUserBtn");
  if (superAddUserBtn) {
    superAddUserBtn.addEventListener("click", async () => {
      document.getElementById("staffForm").reset();
      document.getElementById("staff_id").value = "";
      document.getElementById("staffModalTitle").textContent =
        "Create Hospital User Login";

      // Show target hospital selector for Super Admins
      const staffHospGroup = document.getElementById("staff_hosp_group");
      if (staffHospGroup) staffHospGroup.style.display = "block";

      // Match selected hospital dropdown option
      const superUserHospSelect = document.getElementById(
        "super_user_hospital_select",
      );
      const staffHospSelect = document.getElementById("staff_hospital_id");
      const targetHospId = superUserHospSelect ? superUserHospSelect.value : 1;
      await populateStaffRoleDropdown(targetHospId);

      if (superUserHospSelect && staffHospSelect) {
        staffHospSelect.value = superUserHospSelect.value;
      }

      document.getElementById("staff_password").required = true;
      document.getElementById("staff_password").placeholder =
        "Enter secure password";
      document.getElementById("staffPassHint").style.display = "none";
      document.getElementById("staffPassLabel").innerHTML =
        'Password <span class="req">*</span>';

      document.getElementById("saveStaffBtn").textContent =
        "Create User Account";
      openModal("staffModal");
    });
  }

  const superFetchUsersBtn = document.getElementById("superFetchUsersBtn");
  if (superFetchUsersBtn) {
    superFetchUsersBtn.addEventListener("click", () => {
      const hospId = document.getElementById(
        "super_user_hospital_select",
      ).value;
      loadSuperHospitalUsers(hospId);
    });
  }

  const superUserHospitalSelect = document.getElementById(
    "super_user_hospital_select",
  );
  if (superUserHospitalSelect) {
    superUserHospitalSelect.addEventListener("change", (e) => {
      loadSuperHospitalUsers(e.target.value);
    });
  }

  // Dynamic input triggers (Invoice paid state reveals payment mode selection)
  document.getElementById("inv_status").addEventListener("change", (e) => {
    const showPayMode = e.target.value === "paid";
    document.getElementById("invPaymentModeGroup").style.display = showPayMode
      ? "block"
      : "none";
  });

  // Searches & Debounces
  let dischargedSearchTimeout;
  document
    .getElementById("searchDischargedInput")
    .addEventListener("input", (e) => {
      clearTimeout(dischargedSearchTimeout);
      dischargedSearchTimeout = setTimeout(() => {
        dischargedSearch = e.target.value.trim();
        dischargedPage = 1;
        loadDischargedPatients();
      }, 400);
    });

  const roomBillingForm = document.getElementById("roomBillingForm");
  if (roomBillingForm) {
    roomBillingForm.addEventListener("submit", saveRoomBillingItem);
  }

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

  const superExportPatientsBtn = document.getElementById(
    "superExportPatientsBtn",
  );
  if (superExportPatientsBtn) {
    superExportPatientsBtn.addEventListener("click", async () => {
      try {
        const token = getToken();
        const response = await fetch(
          `${API_BASE}/super?action=export-patients`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!response.ok) throw new Error("Export failed");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Patients_Directory.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showToast("Spreadsheet downloaded successfully!", "success");
      } catch (err) {
        showToast("Failed to export patient registry spreadsheet", "error");
      }
    });
  }
  

  const superPatientSearchInput = document.getElementById(
    "super_patient_search",
  );
  if (superPatientSearchInput) {
    superPatientSearchInput.addEventListener("input", (e) => {
      const search = e.target.value.toLowerCase().trim();
      if (!search) {
        renderSuperPatientsTable(superPatientsList);
        return;
      }
      const filtered = superPatientsList.filter(
        (p) =>
          (p.full_name && p.full_name.toLowerCase().includes(search)) ||
          (p.mobile_no && p.mobile_no.toLowerCase().includes(search)) ||
          (p.email && p.email.toLowerCase().includes(search)) ||
          (p.hospital_name && p.hospital_name.toLowerCase().includes(search)) ||
          p.id.toString() === search,
      );
      renderSuperPatientsTable(filtered);
    });
  }

  let receiptsSearchTimeout;
  const searchReceiptInput = document.getElementById("searchReceiptInput");
  if (searchReceiptInput) {
    searchReceiptInput.addEventListener("input", (e) => {
      clearTimeout(receiptsSearchTimeout);
      receiptsSearchTimeout = setTimeout(() => {
        receiptSearch = e.target.value.trim();
        receiptPage = 1;
        loadReceiptsPanel(1);
      }, 400);
    });
  }

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

// ═══════════════════════════════════════
// DOCTORS CRUD OPERATIONS
// ═══════════════════════════════════════
async function loadDoctors(search = "") {
  const tbody = document.getElementById("doctorsTableBody");
  try {
    const res = await fetch(
      `${API_BASE}/doctors?search=${encodeURIComponent(search)}`,
      {
        headers: authHeaders(),
      },
    );
    const data = await res.json();
    if (!res.ok || !data.success) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="empty-cell">Failed to load doctors list.</td></tr>';
      return;
    }

    if (data.doctors.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="empty-cell">No doctors registered in clinical directory.</td></tr>';
      return;
    }

    tbody.innerHTML = data.doctors
      .map(
        (d) => `
      <tr>
        <td data-label="ID"><span style="color:var(--primary); font-weight:600;">#${d.id}</span></td>
        <td data-label="Doctor Name"><strong>${esc(d.name)}</strong></td>
        <td data-label="Specialization"><span style="font-weight:600; color:var(--text2);">${esc(d.specialization)}</span></td>
        <td data-label="Phone">${esc(d.phone || "—")}</td>
        <td data-label="Email">${esc(d.email || "—")}</td>
        <td data-label="Consultation Fee"><strong>${formatCurrency(d.fee)}</strong></td>
        <td data-label="Actions">
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="action-btn btn-edit" onclick="editDoctor(${d.id})">Edit</button>
            <button class="action-btn btn-delete" onclick="deleteDoctor(${d.id})">Delete</button>
          </div>
        </td>
      </tr>
    `,
      )
      .join("");
  } catch (err) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="empty-cell">Error loading doctor records.</td></tr>';
  }
}

async function saveDoctor(e) {
  e.preventDefault();
  const form = document.getElementById("doctorForm");
  const id = document.getElementById("doctor_id").value;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  try {
    const url = id ? `${API_BASE}/doctors/${id}` : `${API_BASE}/doctors`;
    const method = id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(data),
    });

    const result = await res.json();
    if (res.ok && result.success) {
      showToast(
        id ? "Doctor profile updated!" : "Doctor registered successfully!",
        "success",
      );
      closeModal("doctorModal");
      loadDoctors();
    } else {
      showToast(result.error || "Failed to save doctor details", "error");
    }
  } catch (err) {
    showToast("Network error saving doctor profile", "error");
  }
}

window.editDoctor = async function (id) {
  try {
    const res = await fetch(`${API_BASE}/doctors/${id}`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const d = data.doctor;
      document.getElementById("doctorModalTitle").textContent =
        "Modify Doctor Credentials";
      document.getElementById("doctor_id").value = d.id;
      document.getElementById("doctor_name_input").value = d.name;
      document.getElementById("doctor_spec").value = d.specialization || "";
      document.getElementById("doctor_phone").value = d.phone || "";
      document.getElementById("doctor_email").value = d.email || "";
      document.getElementById("doctor_fee").value = d.fee || 500;
      openModal("doctorModal");
    }
  } catch (err) {
    showToast("Failed to load doctor profile", "error");
  }
};

window.deleteDoctor = async function (id) {
  if (!confirm("Are you sure you want to delete this doctor?")) return;
  try {
    const res = await fetch(`${API_BASE}/doctors/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) {
      showToast("Doctor removed successfully", "success");
      loadDoctors();
    } else {
      const data = await res.json();
      showToast(data.error || "Delete failed", "error");
    }
  } catch {
    showToast("Network error deleting doctor", "error");
  }
};

// ═══════════════════════════════════════
// ROOMS AND ALLOCATIONS OPERATIONS
// ═══════════════════════════════════════
async function loadRooms() {
  const roomsTbody = document.getElementById("roomsTableBody");
  const allocsTbody = document.getElementById("allocationsTableBody");
  const visitsTbody = document.getElementById("visitsTableBody");

  const user = getUser();
  const addRoomBtn = document.getElementById("addRoomBtn");
  if (addRoomBtn) {
    addRoomBtn.style.display =
      user && user.role === "super_admin" ? "" : "none";
  }

  const roomActionsHeaders = document.querySelectorAll(".room-actions-col");
  roomActionsHeaders.forEach(
    (el) =>
      (el.style.display = user && user.role === "super_admin" ? "" : "none"),
  );

  // 1. Fetch & Load Rooms list
  try {
    const res = await fetch(`${API_BASE}/rooms`, { headers: authHeaders() });
    const data = await res.json();
    if (res.ok && data.success) {
      if (data.rooms.length === 0) {
        roomsTbody.innerHTML =
          '<tr><td colspan="5" class="empty-cell">No clinical rooms registered.</td></tr>';
      } else {
        roomsTbody.innerHTML = data.rooms
          .map(
            (r) => `
          <tr>
            <td data-label="Room No"><strong>${esc(r.room_no)}</strong></td>
            <td data-label="Type">${esc(r.room_type)}</td>
            <td data-label="Status"><span class="badge badge-${r.status === "available" ? "paid" : r.status === "occupied" ? "unpaid" : "partial"}">${esc(r.status)} (${r.active_count || 0}/${r.capacity || 1} occupied)</span></td>
            <td data-label="Price / Day"><strong>${formatCurrency(r.price_per_day)}</strong></td>
            ${
              user && user.role === "super_admin"
                ? `
            <td data-label="Actions">
              <div style="display: flex; gap: 6px;">
                <button class="action-btn btn-edit" onclick="editRoom(${r.id})">Edit</button>
                <button class="action-btn btn-delete" onclick="deleteRoom(${r.id})">Delete</button>
              </div>
            </td>`
                : ""
            }
          </tr>
        `,
          )
          .join("");
      }
    }
  } catch (err) {
    roomsTbody.innerHTML =
      '<tr><td colspan="5" class="empty-cell">Error loading room inventory.</td></tr>';
  }

  // 2. Fetch & Load Allocations list
  try {
    const res = await fetch(`${API_BASE}/rooms/allocations`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const activeAllocs = data.allocations.filter(
        (a) => a.status === "active",
      );
      if (activeAllocs.length === 0) {
        allocsTbody.innerHTML =
          '<tr><td colspan="4" class="empty-cell">No patients currently admitted.</td></tr>';
      } else {
        allocsTbody.innerHTML = activeAllocs
          .map(
            (a) => `
          <tr>
            <td data-label="Room"><strong>${esc(a.room_no)}</strong> <span style="font-size:10px; color:var(--text3);">(${esc(a.room_type)})</span></td>
            <td data-label="Patient"><strong>${esc(a.patient_name)}</strong></td>
            <td data-label="Admitted Date">${formatDate(a.admitted_at)}</td>
            <td data-label="Action">
              <div style="display: flex; gap: 6px;">
                <button class="action-btn btn-edit" style="background-color: var(--info); color:#fff; border-color: var(--info);" onclick="manageRoomBilling(${a.id})">Add Bill Item</button>
                <button class="action-btn btn-delete" style="background-color: var(--warning); color:#fff;" onclick="dischargeAllocation(${a.id})">Discharge</button>
              </div>
            </td>
          </tr>
        `,
          )
          .join("");
      }
    }
  } catch (err) {
    allocsTbody.innerHTML =
      '<tr><td colspan="4" class="empty-cell">Error loading active allocations.</td></tr>';
  }

  // 3. Fetch & Load Visits list
  try {
    const res = await fetch(`${API_BASE}/rooms/visits`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (data.visits.length === 0) {
        visitsTbody.innerHTML =
          '<tr><td colspan="6" class="empty-cell">No doctor visits logged in rooms yet.</td></tr>';
      } else {
        visitsTbody.innerHTML = data.visits
          .map(
            (v) => `
          <tr>
            <td data-label="Room"><strong>${esc(v.room_no)}</strong></td>
            <td data-label="Patient">${esc(v.patient_name)}</td>
            <td data-label="Visiting Doctor"><strong>${esc(v.doctor_name)}</strong> <small style="color:var(--text3); display:block;">${esc(v.doctor_specialization)}</small></td>
            <td data-label="Visit Date">${formatDate(v.visit_date)}</td>
            <td data-label="Vitals (Temp/BP/HR)">Temp: ${esc(v.temperature || "—")} &deg;F<br>BP: ${esc(v.blood_pressure || "—")}<br>HR: ${esc(v.heart_rate || "—")} bpm</td>
            <td data-label="Clinical notes" style="max-width: 250px; font-style:italic;">${esc(v.clinical_notes || "No remarks recorded.")}</td>
          </tr>
        `,
          )
          .join("");
      }
    }
  } catch (err) {
    visitsTbody.innerHTML =
      '<tr><td colspan="6" class="empty-cell">Error loading visit history.</td></tr>';
  }
}

async function saveRoom(e) {
  e.preventDefault();
  const form = document.getElementById("roomForm");
  const id = document.getElementById("room_id").value;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  try {
    const url = id ? `${API_BASE}/rooms/${id}` : `${API_BASE}/rooms`;
    const method = id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(data),
    });

    const result = await res.json();
    if (res.ok && result.success) {
      showToast(
        id ? "Room inventory updated!" : "Room registered successfully!",
        "success",
      );
      closeModal("roomModal");
      const user = getUser();
      if (user && user.role === "super_admin") {
        const activeHospSelect = document.getElementById(
          "super_room_hospital_select",
        );
        if (activeHospSelect) {
          loadSuperHospitalRooms(activeHospSelect.value);
        }
      } else {
        loadRooms();
      }
    } else {
      showToast(result.error || "Failed to save room details", "error");
    }
  } catch (err) {
    showToast("Network error saving room details", "error");
  }
}

window.editRoom = async function (id) {
  try {
    const res = await fetch(`${API_BASE}/rooms/${id}`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const r = data.room;
      document.getElementById("roomModalTitle").textContent =
        "Modify Room Settings";
      document.getElementById("room_id").value = r.id;
      document.getElementById("room_no_input").value = r.room_no;
      document.getElementById("room_type_select").value = r.room_type;
      document.getElementById("room_status_select").value = r.status;
      document.getElementById("room_capacity").value = r.capacity || 1;
      document.getElementById("room_price").value = r.price_per_day;

      // Handle target hospital selection display
      const roomHospGroup = document.getElementById("room_hosp_group");
      const roomHospSelect = document.getElementById("room_hospital_id");
      const user = getUser();
      if (user && user.role === "super_admin") {
        if (roomHospGroup) roomHospGroup.style.display = "block";
        if (roomHospSelect) roomHospSelect.value = r.hospital_id || "";
      } else {
        if (roomHospGroup) roomHospGroup.style.display = "none";
      }

      openModal("roomModal");
    }
  } catch (err) {
    showToast("Failed to load room settings", "error");
  }
};

window.deleteRoom = async function (id) {
  if (!confirm("Are you sure you want to remove this room from inventory?"))
    return;
  try {
    const res = await fetch(`${API_BASE}/rooms/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) {
      showToast("Room removed from inventory", "success");
      const user = getUser();
      if (user && user.role === "super_admin") {
        const activeHospSelect = document.getElementById(
          "super_room_hospital_select",
        );
        if (activeHospSelect) {
          loadSuperHospitalRooms(activeHospSelect.value);
        }
      } else {
        loadRooms();
      }
    } else {
      const data = await res.json();
      showToast(data.error || "Delete failed", "error");
    }
  } catch {
    showToast("Network error removing room", "error");
  }
};

// Allocation dropdown loaders
async function populateAllocationModalDropdowns() {
  const patientSelect = document.getElementById("alloc_patient_select");
  const roomSelect = document.getElementById("alloc_room_select");

  patientSelect.innerHTML = '<option value="">Loading patients...</option>';
  roomSelect.innerHTML = '<option value="">Loading rooms...</option>';

  try {
    // 1. Fetch Patients
    const resPat = await fetch(`${API_BASE}/patients`, {
      headers: authHeaders(),
    });
    const dataPat = await resPat.json();
    if (resPat.ok && dataPat.success) {
      patientSelect.innerHTML =
        '<option value="">-- Choose Patient to Admit --</option>' +
        dataPat.patients
          .map(
            (p) =>
              `<option value="${p.id}">${esc(p.full_name)} (ID: #${p.id})</option>`,
          )
          .join("");
    } else {
      patientSelect.innerHTML =
        '<option value="">Failed to load patients list</option>';
    }

    // 2. Fetch Rooms
    const resRoom = await fetch(`${API_BASE}/rooms`, {
      headers: authHeaders(),
    });
    const dataRoom = await resRoom.json();
    if (resRoom.ok && dataRoom.success) {
      const availableRooms = dataRoom.rooms.filter(
        (r) => r.status === "available",
      );
      if (availableRooms.length === 0) {
        roomSelect.innerHTML =
          '<option value="">No available rooms left</option>';
      } else {
        roomSelect.innerHTML =
          '<option value="">-- Choose Available Room --</option>' +
          availableRooms
            .map(
              (r) => {
                const occInfo = r.capacity > 1 ? ` (${r.active_count || 0}/${r.capacity} occupied)` : "";
                return `<option value="${r.id}">${esc(r.room_no)} - ${esc(r.room_type)} (₹ ${r.price_per_day}/day)${occInfo}</option>`;
              }
            )
            .join("");
      }
    } else {
      roomSelect.innerHTML =
        '<option value="">Failed to load rooms list</option>';
    }
  } catch (err) {
    patientSelect.innerHTML = '<option value="">Connection error</option>';
    roomSelect.innerHTML = '<option value="">Connection error</option>';
  }
}

async function saveAllocation(e) {
  e.preventDefault();
  const form = document.getElementById("allocationForm");
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(`${API_BASE}/rooms/allocations`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(data),
    });

    const result = await res.json();
    if (res.ok && result.success) {
      showToast("Patient admitted to room successfully!", "success");
      closeModal("allocationModal");
      loadRooms();
    } else {
      showToast(result.error || "Admit failed", "error");
    }
  } catch (err) {
    showToast("Network error admitting patient", "error");
  }
}

window.dischargeAllocation = async function (id) {
  // Check invoice balance before discharging
  try {
    const resInv = await fetch(`${API_BASE}/invoices?allocation_id=${id}`, { headers: authHeaders() });
    const dataInv = await resInv.json();
    if (resInv.ok && dataInv.success && dataInv.invoices && dataInv.invoices.length > 0) {
      const inv = dataInv.invoices[0];
      const due = parseFloat(inv.due_amount) || 0.00;
      if (due > 0.01) {
        alert(`❌ Cannot discharge patient! Outstanding balance of ${formatCurrency(due)} is pending. Please reconcile and clear all pending bills before discharge.`);
        openReconciliationModal(inv.id, inv.invoice_no, inv.amount, inv.due_amount);
        return;
      }
    }
  } catch (err) {
    console.error("Failed to verify outstanding bills before discharge:", err);
  }

  if (
    !confirm(
      "Are you sure you want to discharge this patient? This will release the room.",
    )
  )
    return;
  try {
    const res = await fetch(`${API_BASE}/rooms/allocations/${id}`, {
      method: "PUT",
      headers: authHeaders(),
    });
    if (res.ok) {
      showToast("Patient discharged from room", "success");
      loadRooms();
    } else {
      const data = await res.json();
      showToast(data.error || "Discharge failed", "error");
    }
  } catch {
    showToast("Network error discharging patient", "error");
  }
};


// Visit dropdown loaders
async function populateVisitModalDropdowns() {
  const allocSelect = document.getElementById("visit_alloc_select");
  const doctorSelect = document.getElementById("visit_doctor_select");

  allocSelect.innerHTML = '<option value="">Loading admissions...</option>';
  doctorSelect.innerHTML = '<option value="">Loading doctors...</option>';

  try {
    // 1. Fetch active allocations
    const resAlloc = await fetch(`${API_BASE}/rooms/allocations`, {
      headers: authHeaders(),
    });
    const dataAlloc = await resAlloc.json();
    if (resAlloc.ok && dataAlloc.success) {
      const active = dataAlloc.allocations.filter((a) => a.status === "active");
      if (active.length === 0) {
        allocSelect.innerHTML =
          '<option value="">No patients actively admitted in rooms</option>';
      } else {
        allocSelect.innerHTML =
          '<option value="">-- Select Admitted Patient --</option>' +
          active
            .map(
              (a) =>
                `<option value="${a.id}">${esc(a.patient_name)} in ${esc(a.room_no)}</option>`,
            )
            .join("");
      }
    } else {
      allocSelect.innerHTML =
        '<option value="">Failed to load admissions</option>';
    }

    // 2. Fetch doctors
    const resDoc = await fetch(`${API_BASE}/doctors`, {
      headers: authHeaders(),
    });
    const dataDoc = await resDoc.json();
    if (resDoc.ok && dataDoc.success) {
      doctorSelect.innerHTML =
        '<option value="">-- Choose Attending Doctor --</option>' +
        dataDoc.doctors
          .map(
            (d) =>
              `<option value="${d.id}">${esc(d.name)} (${esc(d.specialization)})</option>`,
          )
          .join("");
    } else {
      doctorSelect.innerHTML =
        '<option value="">Failed to load doctors list</option>';
    }
  } catch (err) {
    allocSelect.innerHTML = '<option value="">Connection error</option>';
    doctorSelect.innerHTML = '<option value="">Connection error</option>';
  }
}

async function saveDoctorVisit(e) {
  e.preventDefault();
  const form = document.getElementById("visitForm");
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(`${API_BASE}/rooms/visits`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(data),
    });

    const result = await res.json();
    if (res.ok && result.success) {
      showToast(
        "Doctor visit checkup logged & synchronized to patient case sheet!",
        "success",
      );
      closeModal("visitModal");
      loadRooms();
    } else {
      showToast(result.error || "Visit log failed", "error");
    }
  } catch (err) {
    showToast("Network error recording visit log", "error");
  }
}

// ══════════════════════════════════════════════════════════
// DYNAMIC NAVIGATION AND SaaS CUSTOM ROLES
// ══════════════════════════════════════════════════════════
async function loadDynamicNavigation() {
  const user = getUser();
  if (!user) return;

  try {
    const res = await fetch(`${API_BASE}/super?action=menus`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success && data.menus) {
      const allNavLinks = [
        { key: "overview", id: "navOverview" },
        { key: "patients", id: "navPatients" },
        { key: "discharged-patients", id: "navDischargedPatients" },
        { key: "appointments", id: "navAppointments" },
        { key: "invoices", id: "navInvoices" },
        { key: "receipts-panel", id: "navReceiptsPanel" },
        { key: "doctors", id: "navDoctors" },
        { key: "rooms", id: "navRooms" },
        { key: "staff", id: "navStaff" },
        { key: "hospital-setup", id: "navHospitalSetup" },
        { key: "super-overview", id: "navOverview" },
        { key: "super-roles", id: "navSuperPanel" },
        { key: "super-hospitals", id: "navSuperPanel" },
      ];

      allNavLinks.forEach((item) => {
        const el = document.getElementById(item.id);
        if (el) el.style.display = "none";
      });

      if (user.role === "super_admin") {
        const superOverview = document.getElementById("navOverview");
        if (superOverview) {
          superOverview.style.display = "";
          superOverview.innerHTML =
            '<span class="nav-icon">🏢</span> Dashboard';
          superOverview.setAttribute("data-tab", "overview");
        }
        const superPanel = document.getElementById("navSuperPanel");
        if (superPanel) {
          superPanel.style.display = "";
          superPanel.innerHTML = '<span class="nav-icon">🔑</span> Super Panel';
          superPanel.setAttribute("data-tab", "super-panel");
        }
        switchTab("super-panel");
        return;
      }

      let firstTab = "";
      data.menus.forEach((menu) => {
        const mapped = allNavLinks.find((item) => item.key === menu.menu_key);
        if (mapped) {
          const el = document.getElementById(mapped.id);
          if (el) {
            el.style.display = "";
            el.innerHTML = `<span class="nav-icon">${menu.menu_icon}</span> ${menu.menu_label}`;
            el.setAttribute("data-tab", menu.menu_key);
            if (!firstTab) firstTab = menu.menu_key;
          }
        }
      });

      if (firstTab) {
        switchTab(firstTab);
      }
    }
  } catch (err) {
    console.error("Failed to load dynamic nav menus:", err);
  }
}

// ══════════════════════════════════════════════════════════
// HOSPITAL SETUP (ADMIN BRANDING SETTINGS)
// ══════════════════════════════════════════════════════════
async function loadHospitalSetup() {
  try {
    const res = await fetch(`${API_BASE}/super?action=hospital`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success && data.hospital) {
      const h = data.hospital;
      document.getElementById("hosp_name_input").value = h.name || "";
      document.getElementById("hosp_tax_name_input").value =
        h.tax_name || "GST";
      document.getElementById("hosp_gst_no_input").value = h.gst_no || "";
      document.getElementById("hosp_gst_percent_input").value =
        h.gst_percent !== undefined ? h.gst_percent : "0.00";

      const preview = document.getElementById("hosp_logo_preview");
      const emptyText = document.getElementById("hosp_logo_empty_text");
      if (h.logo_data) {
        preview.src = h.logo_data;
        preview.style.display = "block";
        if (emptyText) emptyText.style.display = "none";
        window.tempHospitalLogoBase64 = h.logo_data;
      } else {
        preview.style.display = "none";
        if (emptyText) emptyText.style.display = "block";
        window.tempHospitalLogoBase64 = "";
      }
    }

    // Load setup statistics
    const statsRes = await fetch(`${API_BASE}/super?action=stats`, {
      headers: authHeaders(),
    });
    const statsData = await statsRes.json();
    if (statsRes.ok && statsData.success) {
      document.getElementById("setupStatsDoctors").textContent =
        statsData.stats.doctors;
      document.getElementById("setupStatsRooms").textContent =
        statsData.stats.rooms;
    }
  } catch (err) {
    showToast("Failed to load hospital settings", "error");
  }
}

async function saveHospitalSetup(e) {
  e.preventDefault();
  const name = document.getElementById("hosp_name_input").value;
  const logo = window.tempHospitalLogoBase64 || "";
  const tax_name = document.getElementById("hosp_tax_name_input").value;
  const gst_no = document.getElementById("hosp_gst_no_input").value;
  const gst_percent = document.getElementById("hosp_gst_percent_input").value;

  try {
    const res = await fetch(`${API_BASE}/super?action=hospital`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        name,
        logo_data: logo,
        tax_name,
        gst_no,
        gst_percent,
      }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(
        "Hospital profile saved! Re-logging in will sync custom logos.",
        "success",
      );

      // Dynamic updates to current local context
      const u = getUser();
      if (u) {
        u.hospital_name = name;
        u.hospital_logo = logo;
        localStorage.setItem("hospital_user", JSON.stringify(u));

        // Re-run header display update
        const logoBox = document.getElementById("logoBox");
        const brandText = document.getElementById("brandText");
        if (logo) {
          logoBox.innerHTML = `<img src="${logo}" style="width:100%; height:100%; object-fit:cover; border-radius:6px;">`;
          logoBox.style.backgroundColor = "transparent";
          logoBox.style.boxShadow = "none";
        } else {
          logoBox.innerHTML = name.charAt(0).toUpperCase();
          logoBox.style.backgroundColor = "#00bba8";
        }
        if (brandText) {
          brandText.innerHTML = `${esc(name)} <span>Staff Portal</span>`;
        }
      }
    } else {
      showToast(
        data.error ? `${data.error} (${data.details || ""})` : "Save failed",
        "error",
      );
    }
  } catch (err) {
    showToast("Connection error saving settings", "error");
  }
}

// ══════════════════════════════════════════════════════════
// SUPER ADMIN TELEMETRY PANELS
// ══════════════════════════════════════════════════════════
async function loadSuperPanel() {
  const superHospitalsTableBody = document.getElementById(
    "superHospitalsTableBody",
  );
  const superRolesTableBody = document.getElementById("superRolesTableBody");
  const menuRoleSelect = document.getElementById("menu_role_select");

  superHospitalsTableBody.innerHTML =
    '<tr><td colspan="4" class="loading-cell">Loading hospitals...</td></tr>';
  superRolesTableBody.innerHTML =
    '<tr><td colspan="2" class="loading-cell">Loading custom roles...</td></tr>';

  try {
    // 1. Fetch hospitals
    const resHosp = await fetch(`${API_BASE}/super?action=hospitals`, {
      headers: authHeaders(),
    });
    const dataHosp = await resHosp.json();
    if (resHosp.ok && dataHosp.success) {
      // Populate hospital selectors
      const superMenuHospitalSelect = document.getElementById(
        "super_menu_hospital_select",
      );
      const superRoleHospSelect = document.getElementById(
        "super_role_hosp_select",
      );
      const superUserHospitalSelect = document.getElementById(
        "super_user_hospital_select",
      );
      const superRoomHospitalSelect = document.getElementById(
        "super_room_hospital_select",
      );
      const staffHospitalSelect = document.getElementById("staff_hospital_id");
      const roomHospitalSelect = document.getElementById("room_hospital_id");

      const optionsHTML = dataHosp.hospitals
        .map((h) => `<option value="${h.id}">${esc(h.name)}</option>`)
        .join("");
      if (superMenuHospitalSelect)
        superMenuHospitalSelect.innerHTML = optionsHTML;
      if (superRoleHospSelect) superRoleHospSelect.innerHTML = optionsHTML;
      if (superUserHospitalSelect)
        superUserHospitalSelect.innerHTML = optionsHTML;
      if (superRoomHospitalSelect)
        superRoomHospitalSelect.innerHTML = optionsHTML;
      if (staffHospitalSelect) staffHospitalSelect.innerHTML = optionsHTML;
      if (roomHospitalSelect) roomHospitalSelect.innerHTML = optionsHTML;

      // Trigger queries for selected hospital
      if (dataHosp.hospitals.length > 0) {
        loadSuperHospitalUsers(dataHosp.hospitals[0].id);
        loadSuperHospitalRooms(dataHosp.hospitals[0].id);
      }

      if (dataHosp.hospitals.length === 0) {
        superHospitalsTableBody.innerHTML =
          '<tr><td colspan="5" class="empty-cell">No hospitals registered yet.</td></tr>';
      } else {
        superHospitalsTableBody.innerHTML = dataHosp.hospitals
          .map(
            (h) => `
          <tr>
            <td>#${h.id}</td>
            <td>
              ${h.logo_data ? `<img src="${h.logo_data}" style="height:20px; vertical-align:middle; margin-right:6px; border-radius:3px;">` : ""}
              <strong>${esc(h.name)}</strong>
            </td>
            <td>${h.doctors_count} registered</td>
            <td>${h.rooms_count} inventory</td>
            <td>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button class="action-btn btn-edit" onclick="editHospital(${h.id})" title="Modify hospital settings">Edit</button>
                <button class="action-btn btn-pay" onclick="configureHospitalCaseSheet(${h.id})" title="Configure services, protocols & case sheet checkboxes" style="background-color: var(--primary);">Configure</button>
                <button class="action-btn btn-delete" onclick="deleteHospital(${h.id})" title="Remove hospital from registry">Delete</button>
              </div>
            </td>
          </tr>
        `,
          )
          .join("");
      }
    }

    // 2. Fetch roles for the first hospital by default
    if (dataHosp.hospitals.length > 0) {
      await loadSuperRoles(dataHosp.hospitals[0].id);
    } else {
      superRolesTableBody.innerHTML =
        '<tr><td colspan="3" class="empty-cell">No roles registry available.</td></tr>';
    }

    // Load cross-tenant patients list
    await loadSuperPatients();
  } catch (err) {
    showToast("Failed to query Super parameters", "error");
  }
}

async function loadSuperRoles(hospitalId) {
  const superRolesTableBody = document.getElementById("superRolesTableBody");
  const menuRoleSelect = document.getElementById("menu_role_select");
  if (!superRolesTableBody) return;

  superRolesTableBody.innerHTML =
    '<tr><td colspan="3" class="loading-cell">Loading roles directory...</td></tr>';

  try {
    const resRoles = await fetch(
      `${API_BASE}/super?action=roles&hospital_id=${hospitalId}`,
      { headers: authHeaders() },
    );
    const dataRoles = await resRoles.json();
    if (resRoles.ok && dataRoles.success) {
      const defaultRoles = [
        { role_name: "nurse", description: "Default Staff Nurse access" },
        {
          role_name: "doctor",
          description: "Default attending clinician access",
        },
        {
          role_name: "admin",
          description: "Hospital manager full tenant control",
        },
      ];

      const allRoles = [...defaultRoles];
      dataRoles.roles.forEach((r) => {
        if (!allRoles.some((ar) => ar.role_name === r.role_name)) {
          allRoles.push(r);
        }
      });

      superRolesTableBody.innerHTML = allRoles
        .map(
          (r) => `
        <tr>
          <td><code style="background-color:var(--bg-primary); padding:2px 6px; border-radius:4px; font-weight:700;">${esc(r.role_name)}</code></td>
          <td>${esc(r.description || "N/A")}</td>
          <td>
            ${
              r.id
                ? `
              <div style="display: flex; gap: 6px;">
                <button class="action-btn btn-edit" onclick="editRole(${r.id})" title="Modify role description">Edit</button>
                <button class="action-btn btn-delete" onclick="deleteRole(${r.id})" title="Remove custom role">Delete</button>
              </div>
            `
                : `<span style="font-size:11px; color:var(--text3); font-style:italic;">System Role</span>`
            }
          </td>
        </tr>
      `,
        )
        .join("");

      // Populating dynamic menu selects
      menuRoleSelect.innerHTML = allRoles
        .map(
          (r) => `
        <option value="${r.role_name}">${esc(r.role_name.toUpperCase())}</option>
      `,
        )
        .join("");

      // Initial load mapping config
      if (allRoles.length > 0) {
        loadRoleMenusConfig(allRoles[0].role_name);
      }

      // Load cross-tenant patients list
      await loadSuperPatients();
    }
  } catch (err) {
    showToast("Failed to query Super parameters", "error");
  }
}

async function populateStaffRoleDropdown(hospitalId) {
  const staffRoleSelect = document.getElementById("staff_role");
  if (!staffRoleSelect) return;

  try {
    const res = await fetch(
      `${API_BASE}/super?action=roles&hospital_id=${hospitalId}`,
      { headers: authHeaders() },
    );
    const data = await res.json();
    if (res.ok && data.success) {
      const defaultRoles = [
        { role_name: "nurse", description: "Nurse (Staff Access)" },
        { role_name: "doctor", description: "Doctor (Clinical Access)" },
        { role_name: "patient", description: "Patient (Portal Access)" },
        { role_name: "admin", description: "Administrator (Full Control)" },
      ];

      const allRoles = [...defaultRoles];
      if (data.roles && Array.isArray(data.roles)) {
        data.roles.forEach((r) => {
          if (!allRoles.some((ar) => ar.role_name === r.role_name)) {
            allRoles.push({
              role_name: r.role_name,
              description: `${r.role_name.charAt(0).toUpperCase() + r.role_name.slice(1)} (Custom Role)`,
            });
          }
        });
      }

      staffRoleSelect.innerHTML = allRoles
        .map(
          (r) => `
        <option value="${r.role_name}">${esc(r.description)}</option>
      `,
        )
        .join("");
    }
  } catch (err) {
    console.error("Failed to populate staff roles dropdown:", err);
  }
}

let superPatientsList = [];

async function loadSuperPatients() {
  const superPatientsTableBody = document.getElementById(
    "superPatientsTableBody",
  );
  if (!superPatientsTableBody) return;
  superPatientsTableBody.innerHTML =
    '<tr><td colspan="6" class="loading-cell">Loading patients directory...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/super?action=patients`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      superPatientsList = data.patients || [];
      renderSuperPatientsTable(superPatientsList);
    } else {
      superPatientsTableBody.innerHTML = `<tr><td colspan="6" class="empty-cell" style="color:var(--error);">${esc(data.error || "Failed to load directory")}</td></tr>`;
    }
  } catch (err) {
    superPatientsTableBody.innerHTML =
      '<tr><td colspan="6" class="empty-cell" style="color:var(--error);">Connection error loading patients</td></tr>';
  }
}

function renderSuperPatientsTable(list) {
  const superPatientsTableBody = document.getElementById(
    "superPatientsTableBody",
  );
  if (!superPatientsTableBody) return;

  if (list.length === 0) {
    superPatientsTableBody.innerHTML =
      '<tr><td colspan="6" class="empty-cell">No patients found.</td></tr>';
    return;
  }

  superPatientsTableBody.innerHTML = list
    .map(
      (p) => `
    <tr>
      <td>#${p.id}</td>
      <td><strong>${esc(p.full_name)}</strong></td>
      <td>${esc(p.mobile_no || "—")}</td>
      <td>${esc(p.email || "—")}</td>
      <td><span style="background-color: var(--primary-glow); color: var(--primary); padding: 4px 8px; border-radius: 4px; font-size:11px; font-weight:700;">${esc(p.hospital_name || "Unassigned")}</span></td>
      <td>${formatDate(p.created_at)}</td>
    </tr>
  `,
    )
    .join("");
}

async function loadInvoiceReceiptsLog(invoiceId) {
  const body = document.getElementById("reconReceiptsBody");
  if (!body) return;
  body.innerHTML =
    '<tr><td colspan="5" class="loading-cell">Loading receipts...</td></tr>';

  try {
    const res = await fetch(
      `${API_BASE}/invoices?action=receipts&invoice_id=${invoiceId}`,
      {
        headers: authHeaders(),
      },
    );
    const data = await res.json();
    if (res.ok && data.success) {
      const receipts = data.receipts || [];
      if (receipts.length === 0) {
        body.innerHTML =
          '<tr><td colspan="5" class="empty-cell">No transactions logged yet.</td></tr>';
      } else {
        body.innerHTML = receipts
          .map(
            (r) => `
          <tr>
            <td><code>${esc(r.receipt_no)}</code></td>
            <td>${formatDate(r.payment_date)}</td>
            <td><strong>${formatCurrency(r.amount_paid)}</strong></td>
            <td><span class="badge badge-info" style="background-color:var(--primary-glow); color:var(--primary); padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700;">${esc(r.payment_mode.toUpperCase())}</span></td>
            <td>
              <div style="display:flex; gap:4px;">
                <button type="button" class="action-btn btn-edit" onclick="printReceiptSlips(${r.id})" style="padding:2px 6px !important; font-size:10px !important;">Print</button>
                <button type="button" class="action-btn btn-edit" onclick="downloadReceiptSlips(${r.id}, '${esc(r.receipt_no)}')" style="padding:2px 6px !important; font-size:10px !important; background-color: var(--primary) !important;">Download</button>
              </div>
            </td>
          </tr>
        `,
          )
          .join("");
      }
    } else {
      body.innerHTML = `<tr><td colspan="5" class="empty-cell" style="color:var(--error);">${esc(data.error || "Failed to load")}</td></tr>`;
    }
  } catch (err) {
    body.innerHTML =
      '<tr><td colspan="5" class="empty-cell" style="color:var(--error);">Connection error</td></tr>';
  }
}

window.printReceiptSlips = async function (receiptId) {
  try {
    const res = await fetch(
      `${API_BASE}/invoices?action=export-receipt-pdf&receipt_id=${receiptId}`,
      {
        headers: { Authorization: `Bearer ${getToken()}` },
      },
    );

    if (!res.ok) throw new Error("Receipt PDF render failed");

    const blob = await res.blob();
    const fileURL = URL.createObjectURL(blob);

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

window.downloadReceiptSlips = async function (receiptId, receiptNo) {
  try {
    const res = await fetch(
      `${API_BASE}/invoices?action=export-receipt-pdf&receipt_id=${receiptId}`,
      {
        headers: { Authorization: `Bearer ${getToken()}` },
      },
    );

    if (!res.ok) throw new Error("Receipt PDF render failed");

    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${receiptNo || "Receipt"}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("Receipt PDF downloaded!", "success");
  } catch (err) {
    showToast("Failed to compile PDF receipt", "error");
  }
};

let receiptPage = 1;
let receiptSearch = "";

async function loadReceiptsPanel(page = 1) {
  receiptPage = page;
  const tbody = document.getElementById("receiptsTableBody");
  if (!tbody) return;
  tbody.innerHTML =
    '<tr><td colspan="7" class="loading-cell"><span class="spinner"></span> Loading receipts log...</td></tr>';

  try {
    const res = await fetch(
      `${API_BASE}/invoices?action=receipts&search=${encodeURIComponent(receiptSearch)}&page=${receiptPage}&limit=15`,
      {
        headers: authHeaders(),
      },
    );
    const data = await res.json();
    if (res.ok && data.success) {
      const receipts = data.receipts || [];
      if (receipts.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="7" class="empty-cell">No payment transactions found.</td></tr>';
        document.getElementById("receiptsPagination").innerHTML = "";
        return;
      }

      tbody.innerHTML = receipts
        .map(
          (r) => `
        <tr>
          <td><code>${esc(r.receipt_no)}</code></td>
          <td><code>${esc(r.invoice_no)}</code></td>
          <td><strong>${esc(r.patient_name || "—")}</strong></td>
          <td><strong>${formatCurrency(r.amount_paid)}</strong></td>
          <td>${formatDate(r.payment_date)}</td>
          <td><span class="badge badge-info" style="background-color:var(--primary-glow); color:var(--primary); padding:4px 8px; border-radius:4px; font-size:11px; font-weight:700;">${esc(r.payment_mode.toUpperCase())}</span></td>
          <td>
            <div style="display:flex; gap:6px;">
              <button type="button" class="action-btn btn-edit" onclick="printReceiptSlips(${r.id})">Print</button>
              <button type="button" class="action-btn btn-edit" onclick="downloadReceiptSlips(${r.id}, '${esc(r.receipt_no)}')" style="background-color: var(--primary) !important;">Download</button>
            </div>
          </td>
        </tr>
      `,
        )
        .join("");

      renderPagination(
        "receiptsPagination",
        data.pagination.page,
        data.pagination.totalPages,
        data.pagination.total,
        (p) => loadReceiptsPanel(p),
      );
    } else {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-cell" style="color:var(--error);">${esc(data.error || "Failed to load receipts")}</td></tr>`;
    }
  } catch (err) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="empty-cell" style="color:var(--error);">Connection error loading receipts</td></tr>';
  }
}

async function saveSuperHospital(e) {
  e.preventDefault();
  const id = document.getElementById("super_hosp_id").value;
  const name = document.getElementById("super_hosp_name").value;
  const logo = window.tempHospitalLogoBase64 || "";
  const tax_name = document.getElementById("super_hosp_tax_name").value;
  const gst_no = document.getElementById("super_hosp_gst_no").value;
  const gst_percent = document.getElementById("super_hosp_gst_percent").value;

  try {
    const url = id
      ? `${API_BASE}/super?action=hospitals&id=${id}`
      : `${API_BASE}/super?action=hospitals`;
    const method = id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify({
        name,
        logo_data: logo,
        tax_name,
        gst_no,
        gst_percent,
      }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(
        id
          ? "Hospital settings updated successfully!"
          : "Hospital registration successful!",
        "success",
      );
      closeModal("superHospitalModal");
      loadSuperPanel();
    } else {
      showToast(
        data.error
          ? `${data.error} (${data.details || ""})`
          : id
            ? "Failed to update hospital"
            : "Failed to add hospital",
        "error",
      );
    }
  } catch (err) {
    showToast("Network error saving hospital profile", "error");
  }
}

window.editHospital = async function (id) {
  try {
    const res = await fetch(
      `${API_BASE}/super?action=hospital&hospital_id=${id}`,
      { headers: authHeaders() },
    );
    const data = await res.json();
    if (res.ok && data.success && data.hospital) {
      const h = data.hospital;
      document.getElementById("superHospitalModalTitle").textContent =
        "Modify Hospital Settings";
      document.getElementById("superHospitalSubmitBtn").textContent =
        "Save Changes";
      document.getElementById("super_hosp_id").value = h.id;
      document.getElementById("super_hosp_name").value = h.name || "";
      document.getElementById("super_hosp_tax_name").value =
        h.tax_name || "GST";
      document.getElementById("super_hosp_gst_no").value = h.gst_no || "";
      document.getElementById("super_hosp_gst_percent").value =
        h.gst_percent !== undefined ? h.gst_percent : "0.00";

      const preview = document.getElementById("hosp_logo_preview");
      const emptyText = document.getElementById("hosp_logo_empty_text");
      if (h.logo_data) {
        if (preview) {
          preview.src = h.logo_data;
          preview.style.display = "block";
        }
        if (emptyText) emptyText.style.display = "none";
        window.tempHospitalLogoBase64 = h.logo_data;
      } else {
        if (preview) preview.style.display = "none";
        if (emptyText) emptyText.style.display = "block";
        window.tempHospitalLogoBase64 = "";
      }

      openModal("superHospitalModal");
    } else {
      showToast(data.error || "Failed to load hospital details", "error");
    }
  } catch (err) {
    showToast("Network error loading hospital details", "error");
  }
};

window.deleteHospital = async function (id) {
  if (
    !confirm(
      "Are you sure you want to delete this hospital? This will remove all associated rooms, doctors, staff and patients records permanently!",
    )
  )
    return;
  try {
    const res = await fetch(`${API_BASE}/super?action=hospitals&id=${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast("Hospital deleted successfully", "success");
      loadSuperPanel();
    } else {
      showToast(data.error || "Failed to delete hospital", "error");
    }
  } catch (err) {
    showToast("Network error deleting hospital", "error");
  }
};

async function saveSuperRole(e) {
  e.preventDefault();
  const id = document.getElementById("super_role_id").value;
  const roleName = document
    .getElementById("super_role_name")
    .value.trim()
    .toLowerCase();
  const desc = document.getElementById("super_role_desc").value;

  const user = getUser();
  const payload = { role_name: roleName, description: desc };

  let hostId = null;
  if (user.role === "super_admin") {
    const hospSelect = document.getElementById("super_role_hosp_select");
    if (hospSelect && hospSelect.value) {
      payload.hospital_id = parseInt(hospSelect.value);
      hostId = payload.hospital_id;
    }
  }

  try {
    const url = id
      ? `${API_BASE}/super?action=roles&id=${id}${hostId ? `&hospital_id=${hostId}` : ""}`
      : `${API_BASE}/super?action=roles`;
    const method = id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(
        id
          ? "Role updated successfully!"
          : "Custom role registered successfully!",
        "success",
      );
      closeModal("superRoleModal");

      // Reload lists based on role and panel view
      if (user.role === "super_admin") {
        loadSuperPanel();
      } else {
        loadHospitalRolesAndMenus();
      }
    } else {
      showToast(
        data.error
          ? `${data.error} (${data.details || ""})`
          : "Role save failed",
        "error",
      );
    }
  } catch (err) {
    showToast("Network error saving role profile", "error");
  }
}

window.editRole = async function (id) {
  try {
    const user = getUser();
    let hostId = "";
    if (user.role === "super_admin") {
      const superRoleHospSelect = document.getElementById(
        "super_role_hosp_select",
      );
      if (superRoleHospSelect) hostId = superRoleHospSelect.value;
    }

    // Fetch all roles for this hospital, and find the target role by id
    const res = await fetch(
      `${API_BASE}/super?action=roles${hostId ? `&hospital_id=${hostId}` : ""}`,
      { headers: authHeaders() },
    );
    const data = await res.json();
    if (res.ok && data.success) {
      const r = data.roles.find((item) => item.id === id);
      if (r) {
        document.getElementById("superRoleModalTitle").textContent =
          "Modify Custom Role";
        document.getElementById("superRoleSubmitBtn").textContent =
          "Save Changes";
        document.getElementById("super_role_id").value = r.id;
        document.getElementById("super_role_name").value = r.role_name;
        document.getElementById("super_role_desc").value = r.description || "";

        const hospGroup = document.getElementById("super_role_hosp_group");
        if (hospGroup) hospGroup.style.display = "none"; // Hide hospital selector when editing to prevent moving roles across tenants

        openModal("superRoleModal");
      } else {
        showToast("Role details not found", "error");
      }
    } else {
      showToast(data.error || "Failed to load role details", "error");
    }
  } catch (err) {
    showToast("Network error loading role details", "error");
  }
};

window.deleteRole = async function (id) {
  if (
    !confirm(
      "Are you sure you want to delete this custom role? Users assigned to this role will lose their custom menu permissions.",
    )
  )
    return;
  try {
    const user = getUser();
    let hostId = "";
    if (user.role === "super_admin") {
      const superRoleHospSelect = document.getElementById(
        "super_role_hosp_select",
      );
      if (superRoleHospSelect) hostId = superRoleHospSelect.value;
    }

    const res = await fetch(
      `${API_BASE}/super?action=roles&id=${id}${hostId ? `&hospital_id=${hostId}` : ""}`,
      {
        method: "DELETE",
        headers: authHeaders(),
      },
    );
    const data = await res.json();
    if (res.ok && data.success) {
      showToast("Custom role deleted successfully", "success");
      if (user.role === "super_admin") {
        loadSuperPanel();
      } else {
        loadHospitalRolesAndMenus();
      }
    } else {
      showToast(data.error || "Failed to delete role", "error");
    }
  } catch (err) {
    showToast("Network error deleting role", "error");
  }
};

async function loadRoleMenusConfig(role) {
  // Clear checkboxes
  document
    .querySelectorAll('input[name="menu_tab"]')
    .forEach((cb) => (cb.checked = false));

  const superHospSelect = document.getElementById("super_menu_hospital_select");
  const hospId = superHospSelect ? superHospSelect.value : "";
  const url = hospId
    ? `${API_BASE}/super?action=menus&role=${role}&hospital_id=${hospId}`
    : `${API_BASE}/super?action=menus&role=${role}`;

  try {
    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json();
    if (res.ok && data.success && data.menus) {
      data.menus.forEach((m) => {
        const checkbox = document.querySelector(
          `input[name="menu_tab"][value="${m.menu_key}"]`,
        );
        if (checkbox) checkbox.checked = true;
      });
    }
  } catch (err) {
    console.error("Failed to load mapped role menus config:", err);
  }
}

async function saveRoleMenu() {
  const role = document.getElementById("menu_role_select").value;
  const checked = document.querySelectorAll('input[name="menu_tab"]:checked');
  const menus = Array.from(checked).map((cb) => ({
    menu_key: cb.value,
    menu_label: cb.getAttribute("data-label"),
    menu_icon: cb.getAttribute("data-icon"),
  }));

  const superHospSelect = document.getElementById("super_menu_hospital_select");
  const hospId = superHospSelect ? parseInt(superHospSelect.value) : null;

  try {
    const res = await fetch(`${API_BASE}/super?action=menu-mapping`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ role_name: role, menus, hospital_id: hospId }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(
        `Privilege menu mappings updated for role: ${role.toUpperCase()}`,
        "success",
      );
    } else {
      showToast(data.error || "Save configuration failed", "error");
    }
  } catch (err) {
    showToast("Network connection mapping config failed", "error");
  }
}

// ══════════════════════════════════════════════════════════
// HOSPITAL ADMIN ROLES AND MENU CONFIGURATION
// ══════════════════════════════════════════════════════════
async function loadHospitalRolesAndMenus() {
  const hospRolesTbody = document.getElementById("hospRolesTableBody");
  const hospMenuRoleSelect = document.getElementById("hosp_menu_role_select");

  if (hospRolesTbody)
    hospRolesTbody.innerHTML =
      '<tr><td colspan="2" class="loading-cell">Loading roles...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/super?action=roles`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const defaultRoles = [
        { role_name: "nurse", description: "Default Staff Nurse access" },
        {
          role_name: "doctor",
          description: "Default attending clinician access",
        },
        {
          role_name: "admin",
          description: "Hospital manager full tenant control",
        },
      ];

      const allRoles = [...defaultRoles];
      data.roles.forEach((r) => {
        if (!allRoles.some((ar) => ar.role_name === r.role_name)) {
          allRoles.push(r);
        }
      });

      if (hospRolesTbody) {
        hospRolesTbody.innerHTML = allRoles
          .map(
            (r) => `
          <tr>
            <td><code style="background-color:var(--bg-primary); padding:2px 6px; border-radius:4px; font-weight:700;">${esc(r.role_name)}</code></td>
            <td>${esc(r.description || "N/A")}</td>
          </tr>
        `,
          )
          .join("");
      }

      if (hospMenuRoleSelect) {
        hospMenuRoleSelect.innerHTML = allRoles
          .map(
            (r) => `
          <option value="${r.role_name}">${esc(r.role_name.toUpperCase())}</option>
        `,
          )
          .join("");
      }

      if (allRoles.length > 0) {
        loadHospRoleMenusConfig(allRoles[0].role_name);
      }
    }
  } catch (err) {
    console.error("Failed to load hospital roles:", err);
  }
}

async function loadHospRoleMenusConfig(role) {
  document
    .querySelectorAll('input[name="hosp_menu_tab"]')
    .forEach((cb) => (cb.checked = false));

  try {
    const res = await fetch(`${API_BASE}/super?action=menus&role=${role}`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success && data.menus) {
      data.menus.forEach((m) => {
        const checkbox = document.querySelector(
          `input[name="hosp_menu_tab"][value="${m.menu_key}"]`,
        );
        if (checkbox) checkbox.checked = true;
      });
    }
  } catch (err) {
    console.error("Failed to load hospital role menus:", err);
  }
}

async function saveHospRoleMenu() {
  const role = document.getElementById("hosp_menu_role_select").value;
  const checked = document.querySelectorAll(
    'input[name="hosp_menu_tab"]:checked',
  );
  const menus = Array.from(checked).map((cb) => ({
    menu_key: cb.value,
    menu_label: cb.getAttribute("data-label"),
    menu_icon: cb.getAttribute("data-icon"),
  }));

  try {
    const res = await fetch(`${API_BASE}/super?action=menu-mapping`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ role_name: role, menus }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(
        `Menu privileges updated for role: ${role.toUpperCase()}`,
        "success",
      );
      const user = getUser();
      if (user && user.role === role) {
        loadDynamicNavigation();
      }
    } else {
      showToast(data.error || "Save mapping failed", "error");
    }
  } catch (err) {
    showToast("Network error saving mapping", "error");
  }
}

async function loadSuperHospitalUsers(hospId) {
  const tbody = document.getElementById("superUsersTableBody");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="5" class="loading-cell"><span class="spinner"></span> Loading hospital user accounts...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/users?hospital_id=${hospId}`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="empty-cell">Failed to retrieve users.</td></tr>';
      return;
    }

    const users = data.users || [];
    if (users.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="empty-cell">No users registered for this hospital.</td></tr>';
      return;
    }

    tbody.innerHTML = users
      .map((u) => {
        const emailVal = u.email
          ? `<div style="font-size:12px; color:var(--text2);">${esc(u.email)}</div>`
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
          <td>#${u.id}</td>
          <td><strong>${esc(u.username)}</strong></td>
          <td>${contactInfo}</td>
          <td><span style="text-transform:uppercase; font-size:11px; font-weight:600; color:var(--text2);">${esc(u.role)}</span></td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="action-btn btn-edit" onclick="editStaff(${u.id})" title="Edit Roles / Reset Password">Edit</button>
              <button class="action-btn btn-delete" onclick="deleteStaff(${u.id})" title="Delete User account">Delete</button>
            </div>
          </td>
        </tr>
      `;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="empty-cell">Network error fetching users.</td></tr>';
  }
}

async function loadSuperHospitalRooms(hospId) {
  const tbody = document.getElementById("superRoomsTableBody");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="5" class="loading-cell"><span class="spinner"></span> Loading hospital rooms inventory...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/rooms?hospital_id=${hospId}`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="empty-cell">Failed to retrieve rooms list.</td></tr>';
      return;
    }

    const rooms = data.rooms || [];
    if (rooms.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="empty-cell">No clinical rooms registered for this hospital.</td></tr>';
      return;
    }

    tbody.innerHTML = rooms
      .map(
        (r) => `
      <tr>
        <td><strong>${esc(r.room_no)}</strong></td>
        <td>${esc(r.room_type)}</td>
        <td><strong>${formatCurrency(r.price_per_day)}</strong></td>
        <td><span class="badge badge-${r.status === "available" ? "paid" : r.status === "occupied" ? "unpaid" : "partial"}">${esc(r.status)}</span></td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="action-btn btn-edit" onclick="editRoom(${r.id})" title="Modify room configurations">Edit</button>
            <button class="action-btn btn-delete" onclick="deleteRoom(${r.id})" title="Remove room from hospital inventory">Delete</button>
          </div>
        </td>
      </tr>
    `,
      )
      .join("");
  } catch (err) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="empty-cell">Network error fetching clinical rooms.</td></tr>';
  }
}

async function loadDischargedPatients() {
  const tbody = document.getElementById("dischargedTableBody");
  tbody.innerHTML = '<tr><td colspan="7" class="loading-cell"><span class="spinner"></span> Loading discharged patients...</td></tr>';
  try {
    let url = `${API_BASE}/rooms/allocations?status=discharged`;
    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok || !data.success) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">Failed to retrieve discharged patients log.</td></tr>';
      return;
    }
    
    let allocs = data.allocations || [];
    if (dischargedSearch) {
      const q = dischargedSearch.toLowerCase();
      allocs = allocs.filter(a => 
        a.patient_name.toLowerCase().includes(q) || 
        a.room_no.toLowerCase().includes(q) || 
        a.room_type.toLowerCase().includes(q)
      );
    }
    
    if (allocs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">No discharged patient records found.</td></tr>';
      return;
    }
    
    tbody.innerHTML = allocs.map(a => `
      <tr>
        <td data-label="Patient ID"><span style="color:var(--primary); font-weight:600;">#${a.patient_id}</span></td>
        <td data-label="Patient Name"><strong>${esc(a.patient_name)}</strong></td>
        <td data-label="Room No"><strong>${esc(a.room_no)}</strong></td>
        <td data-label="Room Type">${esc(a.room_type)}</td>
        <td data-label="Admitted Date">${formatDate(a.admitted_at)}</td>
        <td data-label="Discharged Date">${formatDate(a.discharged_at)}</td>
        <td data-label="Case Sheet"><a href="#" class="view-case-sheet-link" onclick="window.viewCaseSheet(${a.patient_id}); event.preventDefault();">View Case Sheet</a></td>
      </tr>
    `).join("");
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">Error connecting to server.</td></tr>';
  }
}

window.manageRoomBilling = async function(allocationId) {
  document.getElementById("billing_allocation_id").value = allocationId;
  document.getElementById("roomBillingForm").reset();
  
  try {
    const res = await fetch(`${API_BASE}/rooms/allocations/${allocationId}`, { headers: authHeaders() });
    const data = await res.json();
    if (res.ok && data.success) {
      const a = data.allocation;
      document.getElementById("billingPatientName").textContent = a.patient_name;
      document.getElementById("billingRoomNo").textContent = a.room_no;
      document.getElementById("billingBaseFee").textContent = formatCurrency(a.price_per_day) + "/day";
      
      await loadRoomBilling(allocationId);
      openModal("roomBillingModal");
    } else {
      showToast("Failed to retrieve allocation details", "error");
    }
  } catch (err) {
    showToast("Error retrieving allocation details", "error");
  }
};

async function loadRoomBilling(allocationId) {
  const tbody = document.getElementById("roomBillingItemsBody");
  tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">Loading items...</td></tr>';
  try {
    const res = await fetch(`${API_BASE}/rooms?action=services&allocation_id=${allocationId}`, { headers: authHeaders() });
    const data = await res.json();
    if (res.ok && data.success) {
      const services = data.services || [];
      if (services.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No extra services billed yet.</td></tr>';
        return;
      }
      tbody.innerHTML = services.map(s => {
        const itemTotal = parseFloat(s.price) * s.quantity;
        return `
          <tr>
            <td data-label="Item Description"><strong>${esc(s.service_name)}</strong></td>
            <td data-label="Unit Price">${formatCurrency(s.price)}</td>
            <td data-label="Qty">${s.quantity}</td>
            <td data-label="Total"><strong>${formatCurrency(itemTotal)}</strong></td>
            <td data-label="Action">
              <button type="button" class="action-btn btn-delete" style="padding:4px 8px; font-size:11px;" onclick="deleteRoomBillingItem(${s.id}, ${allocationId})">Remove</button>
            </td>
          </tr>
        `;
      }).join("");
    } else {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Failed to retrieve items.</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Connection error.</td></tr>';
  }
}

async function saveRoomBillingItem(e) {
  e.preventDefault();
  const allocId = document.getElementById("billing_allocation_id").value;
  const name = document.getElementById("billing_service_name").value;
  const price = document.getElementById("billing_price").value;
  const quantity = document.getElementById("billing_quantity").value;

  try {
    const res = await fetch(`${API_BASE}/rooms?action=services`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        allocation_id: allocId,
        service_name: name,
        price,
        quantity
      })
    });
    const result = await res.json();
    if (res.ok && result.success) {
      showToast("Billing item added successfully!", "success");
      document.getElementById("billing_service_name").value = "";
      document.getElementById("billing_price").value = "";
      document.getElementById("billing_quantity").value = "1";
      await loadRoomBilling(allocId);
      
      if (activeTab === "invoices") loadInvoices();
      if (activeTab === "overview") loadOverview();
    } else {
      showToast(result.error || "Failed to add billing item", "error");
    }
  } catch (err) {
    showToast("Connection error adding item", "error");
  }
}

window.deleteRoomBillingItem = async function(serviceId, allocationId) {
  if (!confirm("Are you sure you want to remove this billing item?")) return;
  try {
    const res = await fetch(`${API_BASE}/rooms/${serviceId}?action=services`, {
      method: "DELETE",
      headers: authHeaders()
    });
    const result = await res.json();
    if (res.ok && result.success) {
      showToast("Billing item removed!", "success");
      await loadRoomBilling(allocationId);
      
      if (activeTab === "invoices") loadInvoices();
      if (activeTab === "overview") loadOverview();
    } else {
      showToast(result.error || "Failed to delete item", "error");
    }
  } catch (err) {
    showToast("Connection error deleting item", "error");
  }
};

// ══════════════════════════════════════════════════════════
// SUPER ADMIN: HOSPTIAL CASE SHEET CONFIGURATION MODAL
// ══════════════════════════════════════════════════════════
window.currentConfigProtocols = [];

function renderConfigProtocolsList() {
  const tbody = document.getElementById("configProtocolsTableBody");
  if (!tbody) return;
  if (!window.currentConfigProtocols || window.currentConfigProtocols.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-cell">No protocols configured yet.</td></tr>';
    return;
  }
  tbody.innerHTML = window.currentConfigProtocols.map((p, idx) => `
    <tr>
      <td><strong>${esc(p.name)}</strong></td>
      <td>${esc(p.description)}</td>
      <td style="text-align: center;">
        <button type="button" class="action-btn btn-delete" onclick="deleteConfigProtocol(${idx})" style="padding:4px 8px; font-size:11px;">Remove</button>
      </td>
    </tr>
  `).join("");
}

window.deleteConfigProtocol = function(idx) {
  window.currentConfigProtocols.splice(idx, 1);
  renderConfigProtocolsList();
};

window.configureHospitalCaseSheet = async function(hospitalId) {
  document.getElementById("config_hosp_id").value = hospitalId;
  
  // Reset fields
  document.getElementById("new_protocol_name").value = "";
  document.getElementById("new_protocol_desc").value = "";
  document.getElementById("config_past_history_options").value = "";
  document.getElementById("config_family_history_options").value = "";
  document.getElementById("config_rec_therapies_options").value = "";
  document.getElementById("config_prev_treatments_options").value = "";
  window.currentConfigProtocols = [];
  renderConfigProtocolsList();

  // Reset tab active state
  document.querySelectorAll(".config-tab-btn").forEach((btn, idx) => {
    btn.classList.toggle("active", idx === 0);
    btn.classList.toggle("btn-primary", idx === 0);
    btn.classList.toggle("btn-outline", idx !== 0);
  });
  document.querySelectorAll(".config-tab-pane").forEach((pane, idx) => {
    pane.style.display = idx === 0 ? "block" : "none";
  });

  try {
    const res = await fetch(`${API_BASE}/super?action=case-sheet-config&hospital_id=${hospitalId}`, {
      headers: authHeaders()
    });
    const data = await res.json();
    if (res.ok && data.success && data.config) {
      const config = data.config;
      window.currentConfigProtocols = config.protocols || [];
      renderConfigProtocolsList();

      document.getElementById("config_past_history_options").value = (config.past_medical_history || []).join("\n");
      document.getElementById("config_family_history_options").value = (config.family_history || []).join("\n");
      document.getElementById("config_rec_therapies_options").value = (config.recommended_therapies || []).join("\n");
      document.getElementById("config_prev_treatments_options").value = (config.previous_treatments || []).join("\n");
    }
  } catch (err) {
    showToast("Failed to retrieve hospital configuration", "error");
  }

  openModal("hospitalConfigModal");
};

// Bind configuration modal event listeners
document.addEventListener("DOMContentLoaded", () => {
  const addProtocolBtn = document.getElementById("addConfigProtocolBtn");
  if (addProtocolBtn) {
    addProtocolBtn.addEventListener("click", () => {
      const nameInput = document.getElementById("new_protocol_name");
      const descInput = document.getElementById("new_protocol_desc");
      const name = nameInput.value.trim();
      const desc = descInput.value.trim();
      if (!name) {
        showToast("Protocol Name is required", "error");
        return;
      }
      if (window.currentConfigProtocols.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        showToast("A protocol with this name already exists", "error");
        return;
      }
      window.currentConfigProtocols.push({ name, description: desc });
      nameInput.value = "";
      descInput.value = "";
      renderConfigProtocolsList();
    });
  }

  document.querySelectorAll(".config-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-config-tab");
      document.querySelectorAll(".config-tab-btn").forEach(b => {
        b.classList.toggle("active", b === btn);
        b.classList.toggle("btn-primary", b === btn);
        b.classList.toggle("btn-outline", b !== btn);
      });
      document.querySelectorAll(".config-tab-pane").forEach(pane => {
        pane.style.display = pane.id === `config-tab-${targetTab}` ? "block" : "none";
      });
    });
  });

  const configForm = document.getElementById("hospitalConfigForm");
  if (configForm) {
    configForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById("saveHospitalConfigBtn");
      const originalText = saveBtn.innerHTML;
      saveBtn.innerHTML = "Saving...";
      saveBtn.disabled = true;

      const hospId = document.getElementById("config_hosp_id").value;
      
      const parseOptions = (id) => {
        return document.getElementById(id).value
          .split("\n")
          .map(line => line.trim())
          .filter(line => line.length > 0);
      };

      const config = {
        protocols: window.currentConfigProtocols,
        past_medical_history: parseOptions("config_past_history_options"),
        family_history: parseOptions("config_family_history_options"),
        recommended_therapies: parseOptions("config_rec_therapies_options"),
        previous_treatments: parseOptions("config_prev_treatments_options")
      };

      try {
        const res = await fetch(`${API_BASE}/super?action=case-sheet-config`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ hospital_id: parseInt(hospId), config })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast("Hospital configuration saved successfully!", "success");
          closeModal("hospitalConfigModal");
          
          const user = getUser();
          if (user && user.hospital_id === parseInt(hospId)) {
            window.hospitalCaseSheetConfig = data.config;
          }
        } else {
          showToast(data.error || "Failed to save configuration", "error");
        }
      } catch (err) {
        showToast("Network error saving configuration", "error");
      } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
      }
    });
  }
});

