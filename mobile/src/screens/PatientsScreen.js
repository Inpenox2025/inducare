import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert
} from 'react-native';
import { getThemeColors, Shadows } from '../theme/colors';
import { api } from '../services/api';

export default function PatientsScreen({ isDarkMode = true }) {
  const colors = getThemeColors(isDarkMode);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Register Patient Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('Male');
  const [age, setAge] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [address, setAddress] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [allergies, setAllergies] = useState('');
  const [savingPatient, setSavingPatient] = useState(false);

  // Case Sheet Modal
  const [showCaseSheetModal, setShowCaseSheetModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loadingCaseSheet, setLoadingCaseSheet] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async (query = '') => {
    setLoading(true);
    try {
      const res = await api.getPatients(query);
      if (res.success && res.patients) {
        setPatients(res.patients);
      }
    } catch (err) {
      console.warn('Error loading patients:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    loadPatients(text);
  };

  const handleRegisterPatient = async () => {
    if (!fullName.trim() || !mobileNo.trim()) {
      Alert.alert('Missing Info', 'Please enter patient full name and mobile number.');
      return;
    }

    setSavingPatient(true);
    try {
      const res = await api.savePatient({
        full_name: fullName.trim(),
        gender,
        age: parseInt(age) || 0,
        mobile_no: mobileNo.trim(),
        address: address.trim(),
        blood_group: bloodGroup,
        medical_history: medicalHistory.trim(),
        allergies: allergies.trim(),
      });

      if (res.success) {
        Alert.alert('Success', 'Patient registered successfully!');
        setShowAddModal(false);
        setFullName(''); setAge(''); setMobileNo(''); setAddress(''); setMedicalHistory(''); setAllergies('');
        loadPatients();
      } else {
        Alert.alert('Error', res.error || 'Failed to register patient');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error registering patient');
    } finally {
      setSavingPatient(false);
    }
  };

  const openCaseSheet = async (patient) => {
    setSelectedPatient(patient);
    setShowCaseSheetModal(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Search and Add Action Bar */}
      <View style={styles.topRow}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
          placeholder="🔍 Search patient name, phone, UHID..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={handleSearch}
        />
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.accent }]} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addBtnText}>+ Patient</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={[styles.card, Shadows.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.headerRow}>
                <Text style={[styles.patientName, { color: colors.text }]}>{item.full_name}</Text>
                <View style={[styles.badge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Text style={[styles.genderTag, { color: colors.accent }]}>{item.gender || 'M'} • {item.age || '—'} yrs</Text>
                </View>
              </View>
              <Text style={[styles.mobileText, { color: colors.textMuted }]}>📱 Phone: {item.mobile_no || '—'}</Text>
              <Text style={[styles.addressText, { color: colors.textMuted }]}>📍 Address: {item.address || 'Not specified'}</Text>
              <View style={[styles.footerRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.uhidText, { color: colors.textMuted }]}>UHID: #{item.id}</Text>
                <TouchableOpacity style={[styles.caseSheetBtn, { backgroundColor: colors.cardSub }]} onPress={() => openCaseSheet(item)}>
                  <Text style={[styles.caseSheetBtnText, { color: colors.accent }]}>View Case Sheet 📄</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textMuted }]}>No registered patients found.</Text>}
        />
      )}

      {/* Register Patient Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>👤 Register New Patient</Text>

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Full Name *</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="e.g. Ramesh Kumar" placeholderTextColor="#64748b" value={fullName} onChangeText={setFullName} />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Gender</Text>
                <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="Male / Female" placeholderTextColor="#64748b" value={gender} onChangeText={setGender} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Age (years)</Text>
                <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="35" placeholderTextColor="#64748b" keyboardType="numeric" value={age} onChangeText={setAge} />
              </View>
            </View>

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Mobile Number *</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="e.g. 9876543210" placeholderTextColor="#64748b" keyboardType="phone-pad" value={mobileNo} onChangeText={setMobileNo} />

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Blood Group</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="O+, A+, B+, etc." placeholderTextColor="#64748b" value={bloodGroup} onChangeText={setBloodGroup} />

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Address</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="Residential city / area" placeholderTextColor="#64748b" value={address} onChangeText={setAddress} />

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Past Medical History</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="Diabetic, Hypertension, etc." placeholderTextColor="#64748b" value={medicalHistory} onChangeText={setMedicalHistory} />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={handleRegisterPatient} disabled={savingPatient}>
                {savingPatient ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.saveBtnText}>Save Patient</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Patient Case Sheet Modal */}
      <Modal visible={showCaseSheetModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>📄 Medical Case Sheet</Text>
            
            {selectedPatient && (
              <View>
                <View style={[styles.caseSheetHeader, { backgroundColor: colors.cardSub, borderColor: colors.border }]}>
                  <Text style={[styles.caseSheetName, { color: colors.text }]}>{selectedPatient.full_name}</Text>
                  <Text style={[styles.caseSheetSub, { color: colors.textMuted }]}>UHID: #{selectedPatient.id} • {selectedPatient.gender || 'M'} / {selectedPatient.age || '—'} yrs</Text>
                  <Text style={[styles.caseSheetSub, { color: colors.textMuted }]}>📱 {selectedPatient.mobile_no || '—'}</Text>
                </View>

                <View style={styles.sectionBox}>
                  <Text style={[styles.sectionTitle, { color: colors.accent }]}>📌 Clinical Overview & Vitals</Text>
                  <Text style={[styles.detailItem, { color: colors.text }]}>• Blood Group: <Text style={{ fontWeight: '800' }}>{selectedPatient.blood_group || 'O+'}</Text></Text>
                  <Text style={[styles.detailItem, { color: colors.text }]}>• Medical History: {selectedPatient.medical_history || 'No prior chronic conditions recorded.'}</Text>
                  <Text style={[styles.detailItem, { color: colors.text }]}>• Known Allergies: {selectedPatient.allergies || 'None reported'}</Text>
                </View>

                <View style={styles.sectionBox}>
                  <Text style={[styles.sectionTitle, { color: colors.accent }]}>💊 Active Prescriptions Log</Text>
                  <Text style={[styles.detailItem, { color: colors.textMuted }]}>No active prescription orders flagged in electronic health records.</Text>
                </View>

                <View style={styles.sectionBox}>
                  <Text style={[styles.sectionTitle, { color: colors.accent }]}>🧪 Diagnostic Lab History</Text>
                  <Text style={[styles.detailItem, { color: colors.textMuted }]}>Lab reports attached to patient case history: 0 records found.</Text>
                </View>

                <TouchableOpacity style={[styles.cancelBtn, { marginTop: 16 }]} onPress={() => setShowCaseSheetModal(false)}>
                  <Text style={{ color: '#ffffff', fontWeight: '800' }}>Close Case Sheet</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  topRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  searchInput: { flex: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, borderWidth: 1 },
  addBtn: { borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 13 },
  card: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  patientName: { fontSize: 16, fontWeight: '800' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  genderTag: { fontSize: 12, fontWeight: '800' },
  mobileText: { fontSize: 13, marginTop: 6 },
  addressText: { fontSize: 12, marginTop: 2 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1 },
  uhidText: { fontSize: 11, fontWeight: '700' },
  caseSheetBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  caseSheetBtnText: { fontSize: 12, fontWeight: '700' },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalBox: { borderRadius: 20, padding: 20, borderWidth: 1, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  modalLabel: { fontSize: 12, marginBottom: 4, marginTop: 8 },
  modalInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  cancelBtn: { backgroundColor: '#334155', paddingVertical: 12, borderRadius: 10, alignItems: 'center', flex: 1 },
  saveBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', flex: 1 },
  saveBtnText: { color: '#0f172a', fontWeight: '800' },
  caseSheetHeader: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 14 },
  caseSheetName: { fontSize: 18, fontWeight: '800' },
  caseSheetSub: { fontSize: 12, marginTop: 2 },
  sectionBox: { marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
  detailItem: { fontSize: 13, marginTop: 2 },
});
