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
  Alert,
  ScrollView
} from 'react-native';
import { Colors, getThemeColors, Shadows } from '../theme/colors';
import { api } from '../services/api';

export default function LabScreen({ isDarkMode = true }) {
  const colors = getThemeColors(isDarkMode);
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'orders' | 'receipts'
  const [labTests, setLabTests] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Lab Test Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [testCode, setTestCode] = useState('');
  const [testName, setTestName] = useState('');
  const [category, setCategory] = useState('Haematology');
  const [sampleType, setSampleType] = useState('Blood');
  const [price, setPrice] = useState('');
  const [normalRange, setNormalRange] = useState('');
  const [savingTest, setSavingTest] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'catalog') {
        const res = await api.getLabTests(searchQuery);
        if (res.success && res.tests) setLabTests(res.tests);
      } else if (activeTab === 'orders') {
        const res = await api.getLabInvoices();
        if (res.success && res.invoices) setInvoices(res.invoices);
      } else if (activeTab === 'receipts') {
        const res = await api.getLabReceipts();
        if (res.success && res.receipts) setReceipts(res.receipts);
      }
    } catch (err) {
      console.warn('Error loading lab data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLabTest = async () => {
    if (!testName.trim() || !price.trim()) {
      Alert.alert('Missing Info', 'Please enter lab test name and price.');
      return;
    }

    setSavingTest(true);
    try {
      const res = await api.saveLabTest({
        test_code: testCode.trim() || `LAB-${Date.now().toString().slice(-4)}`,
        test_name: testName.trim(),
        category,
        sample_type: sampleType.trim(),
        price: parseFloat(price) || 0,
        normal_range: normalRange.trim(),
      });

      if (res.success) {
        Alert.alert('Success', 'Lab test added to diagnostic catalog!');
        setShowAddModal(false);
        setTestCode(''); setTestName(''); setPrice(''); setNormalRange('');
        loadData();
      } else {
        Alert.alert('Error', res.error || 'Failed to save lab test');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error registering lab test');
    } finally {
      setSavingTest(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Tab Segment Controls */}
      <View style={[styles.tabBar, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'catalog' && [styles.tabBtnActive, { backgroundColor: colors.accent }]]}
          onPress={() => setActiveTab('catalog')}
        >
          <Text style={[styles.tabBtnText, { color: colors.textMuted }, activeTab === 'catalog' && styles.tabBtnTextActive]}>🧪 Test Catalog</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'orders' && [styles.tabBtnActive, { backgroundColor: colors.accent }]]}
          onPress={() => setActiveTab('orders')}
        >
          <Text style={[styles.tabBtnText, { color: colors.textMuted }, activeTab === 'orders' && styles.tabBtnTextActive]}>🔬 Lab Orders</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'receipts' && [styles.tabBtnActive, { backgroundColor: colors.accent }]]}
          onPress={() => setActiveTab('receipts')}
        >
          <Text style={[styles.tabBtnText, { color: colors.textMuted }, activeTab === 'receipts' && styles.tabBtnTextActive]}>📄 Receipts</Text>
        </TouchableOpacity>
      </View>

      {/* Header Actions */}
      {activeTab === 'catalog' && (
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="🔍 Search test name or code..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              api.getLabTests(text).then(res => { if (res.success && res.tests) setLabTests(res.tests); });
            }}
          />
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.accent }]} onPress={() => setShowAddModal(true)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content List */}
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : activeTab === 'catalog' ? (
        <FlatList
          data={labTests}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item }) => (
            <View style={[styles.card, Shadows.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.testTitle, { color: colors.text }]}>{item.test_name}</Text>
                <Text style={[styles.priceTag, { color: colors.accent }]}>₹{item.price}</Text>
              </View>
              <Text style={[styles.testSub, { color: colors.textMuted }]}>Code: {item.test_code || '—'} • Category: {item.category || 'General'}</Text>
              <Text style={[styles.testRange, { color: colors.textMuted }]}>Sample: {item.sample_type || 'Blood'} | Ref Range: {item.normal_range || '—'}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textMuted }]}>No diagnostic tests found in lab catalog.</Text>}
        />
      ) : activeTab === 'orders' ? (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item }) => (
            <View style={[styles.card, Shadows.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.testTitle, { color: colors.text }]}>Order #{item.invoice_no}</Text>
                <Text style={[styles.invoiceDate, { color: colors.textMuted }]}>{item.invoice_date}</Text>
              </View>
              <Text style={[styles.patientName, { color: colors.text }]}>Patient: {item.patient_name || 'Patient'}</Text>
              <Text style={[styles.testSub, { color: colors.textMuted }]}>Doctor: {item.doctor_name || '—'}</Text>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.priceTag, { color: colors.accent }]}>Payable: ₹{item.net_payable}</Text>
                <Text style={[styles.statusText, item.status === 'paid' ? { color: colors.accent } : styles.statusDue]}>
                  {item.status?.toUpperCase()}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textMuted }]}>No lab orders recorded yet.</Text>}
        />
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item }) => (
            <View style={[styles.card, Shadows.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.testTitle, { color: colors.text }]}>Receipt #{item.receipt_no}</Text>
              <Text style={[styles.patientName, { color: colors.text }]}>Patient: {item.patient_name || 'Patient'}</Text>
              <Text style={[styles.priceTag, { color: colors.accent }]}>Paid: ₹{item.amount_paid} ({item.payment_mode})</Text>
              <Text style={[styles.invoiceDate, { color: colors.textMuted }]}>Date: {item.payment_date}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textMuted }]}>No lab payment receipts found.</Text>}
        />
      )}

      {/* Add Lab Test Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>🧪 Add Diagnostic Test</Text>

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Test Code</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="e.g. CBC-01" placeholderTextColor="#64748b" value={testCode} onChangeText={setTestCode} />

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Test Name *</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="e.g. Complete Blood Count (CBC)" placeholderTextColor="#64748b" value={testName} onChangeText={setTestName} />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Sample Type</Text>
                <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="Blood / Urine" placeholderTextColor="#64748b" value={sampleType} onChangeText={setSampleType} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Price (₹) *</Text>
                <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="450.00" placeholderTextColor="#64748b" keyboardType="numeric" value={price} onChangeText={setPrice} />
              </View>
            </View>

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Reference / Normal Range</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="e.g. 13.0 - 17.0 g/dL" placeholderTextColor="#64748b" value={normalRange} onChangeText={setNormalRange} />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={handleSaveLabTest} disabled={savingTest}>
                {savingTest ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.saveBtnText}>Save Lab Test</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  tabBar: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 14 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabBtnActive: {},
  tabBtnText: { fontSize: 12, fontWeight: '700' },
  tabBtnTextActive: { color: '#0f172a' },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  searchInput: { flex: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, borderWidth: 1 },
  addBtn: { borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 13 },
  card: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  testTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  priceTag: { fontWeight: '800', fontSize: 14 },
  testSub: { fontSize: 12, marginTop: 4 },
  testRange: { fontSize: 11, marginTop: 4 },
  invoiceDate: { fontSize: 11 },
  patientName: { fontSize: 13, marginTop: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  statusDue: { color: '#ef4444' },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalBox: { borderRadius: 20, padding: 20, borderWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  modalLabel: { fontSize: 12, marginBottom: 4, marginTop: 8 },
  modalInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  cancelBtn: { flex: 1, backgroundColor: '#334155', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  cancelBtnText: { color: '#ffffff', fontWeight: '700' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#0f172a', fontWeight: '800' },
});
