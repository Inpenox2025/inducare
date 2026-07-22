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

## 🛠️ How to Export & Generate Android APK

Because building an Android `.apk` file requires a cloud compiler server (unless Android Studio Java SDK is installed locally), Expo provides a **100% free Cloud APK builder**:

### Step 1: Create a free Expo account (if you don't have one)
Sign up for free in 30 seconds at [https://expo.dev/signup](https://expo.dev/signup).

### Step 2: Run the APK build command
```bash
cd mobile
npm run build:apk
```

### Step 3: Enter your username/password when prompted
When the terminal asks `? Email or username »`, enter your Expo username/email and password.

### Step 4: Download your `.apk` file!
EAS will build your application in ~2-3 minutes and print a direct link in the terminal:
> `https://expo.dev/artifacts/eas/inducare-app.apk`

Click that link to download the `.apk` file directly to your computer! You can then copy it to any mobile phone, share it via WhatsApp/Drive, or install it on any Android device.

---

## 📦 App Package Metadata
- **App Name**: Inducare Mobile
- **Android Package Identifier**: `com.inducare.app`
- **Target Backend API**: `https://icare.inspenox.in/api`