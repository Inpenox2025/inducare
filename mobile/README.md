# 📱 Inducare React Native Mobile Application

This repository contains the standalone React Native & Expo mobile application for **Inducare Hospital, Pharmacy & Laboratory Management**.

## 🌟 Key Features
- **Modern Bottom Navigation Bar**: Animated tab bar with quick navigation across **Overview**, **Pharmacy**, **Laboratory**, **Patients**, **Support Tickets**, and **Settings**.
- **Role-Gated Access**: Supports Hospital Admins, Doctors, Pharmacists, Lab Incharges, Super Admins, and Patients.
- **Pharmacy & Barcode Scanner**: Medicine inventory management, camera barcode lookup, dynamic medicine addition, separate Pharmacy billing & receipts linked to Patient & Doctor IDs.
- **Lab Diagnostics & Orders**: Diagnostic catalog management, lab test orders linked to Patient & Doctor IDs, result entry, and payment receipts.
- **Support Tickets & Real-Time Chat**: Raise support tickets and participate in real-time message chat threads.
- **Live API Endpoint Connectivity**: Default pre-configured endpoint `https://icare.inspenox.in/api` with in-app server URL switcher.

---

## 🛠️ How to Run & Build

### 1. Install Dependencies
```bash
cd mobile
npm install
```

### 2. Start Development Server
```bash
npm start
```
Use the Expo Go app on iOS or Android to scan the QR code and run the app live.

### 3. Generate Standalone Android APK (for direct device installation)
```bash
npm run build:apk
```

### 4. Generate Android App Bundle (AAB for Google Play Store submission)
```bash
npm run build:aab
```

---

## 📦 App Package Metadata
- **App Name**: Inducare Mobile
- **Android Package Identifier**: `com.inducare.app`
- **Target Backend API**: `https://icare.inspenox.in/api`
