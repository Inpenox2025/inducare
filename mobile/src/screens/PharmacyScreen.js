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

export default function PharmacyScreen({ isDarkMode = true }) {
  const colors = getThemeColors(isDarkMode);
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'billing' | 'receipts'
  const [medicines, setMedicines] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Barcode / Add Medicine Modal
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [medName, setMedName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [category, setCategory] = useState('Tablets');
  const [stockQty, setStockQty] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [savingMed, setSavingMed] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'inventory') {
        const res = await api.getMedicines(searchQuery);
        if (res.success && res.medicines) setMedicines(res.medicines);
      } else if (activeTab === 'billing') {
        const res = await api.getPharmaInvoices();
        if (res.success && res.invoices) setInvoices(res.invoices);
      } else if (activeTab === 'receipts') {
        const res = await api.getPharmaReceipts();
        if (res.success && res.receipts) setReceipts(res.receipts);
      }
    } catch (err) {
      console.warn('Error loading pharmacy data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    if (activeTab === 'inventory') {
      api.getMedicines(text).then(res => {
        if (res.success && res.medicines) setMedicines(res.medicines);
      });
    }
  };

  const handleSaveMedicine = async () => {
    if (!medName.trim() || !unitPrice.trim() || !stockQty.trim()) {
      Alert.alert('Missing Information', 'Please fill medicine name, price, and stock quantity.');
      return;
    }

    setSavingMed(true);
    try {
      const res = await api.saveMedicine({
        name: medName.trim(),
        generic_name: genericName.trim(),
        category,
        barcode: barcode.trim(),
        stock_quantity: parseInt(stockQty) || 0,
        unit_price: parseFloat(unitPrice) || 0,
        mrp: parseFloat(mrp) || parseFloat(unitPrice) || 0,
      });

      if (res.success) {
        Alert.alert('Success', 'Medicine registered into pharmacy inventory!');
        setShowAddMedModal(false);
        setMedName(''); setGenericName(''); setBarcode(''); setStockQty(''); setUnitPrice(''); setMrp('');
        loadData();
      } else {
        Alert.alert('Error', res.error || 'Failed to save medicine');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error registering medicine');
    } finally {
      setSavingMed(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Tab Segment Controls */}
      <View style={[styles.tabBar, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'inventory' && [styles.tabBtnActive, { backgroundColor: colors.accent }]]}
          onPress={() => setActiveTab('inventory')}
        >
          <Text style={[styles.tabBtnText, { color: colors.textMuted }, activeTab === 'inventory' && styles.tabBtnTextActive]}>💊 Inventory</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'billing' && [styles.tabBtnActive, { backgroundColor: colors.accent }]]}
          onPress={() => setActiveTab('billing')}
        >
          <Text style={[styles.tabBtnText, { color: colors.textMuted }, activeTab === 'billing' && styles.tabBtnTextActive]}>🧾 Pharma Bills</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'receipts' && [styles.tabBtnActive, { backgroundColor: colors.accent }]]}
          onPress={() => setActiveTab('receipts')}
        >
          <Text style={[styles.tabBtnText, { color: colors.textMuted }, activeTab === 'receipts' && styles.tabBtnTextActive]}>📄 Receipts</Text>
        </TouchableOpacity>
      </View>

      {/* Header Actions */}
      {activeTab === 'inventory' && (
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="🔍 Search name, generic, barcode..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.accent }]} onPress={() => setShowAddMedModal(true)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content List */}
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : activeTab === 'inventory' ? (
        <FlatList
          data={medicines}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item }) => (
            <View style={[styles.card, Shadows.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.medTitle, { color: colors.text }]}>{item.name}</Text>
                <View style={[styles.stockBadge, parseInt(item.stock_quantity) <= 10 ? styles.badgeDanger : styles.badgeSuccess]}>
                  <Text style={[styles.stockBadgeText, { color: colors.accent }]}>Qty: {item.stock_quantity}</Text>
                </View>
              </View>
              <Text style={[styles.medGeneric, { color: colors.textMuted }]}>Generic: {item.generic_name || '—'}</Text>
              <View style={styles.cardDetailRow}>
                <Text style={[styles.priceTag, { color: colors.accent }]}>₹{item.unit_price} / unit</Text>
                <Text style={[styles.barcodeText, { color: colors.textMuted }]}>Barcode: {item.barcode || '—'}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textMuted }]}>No medicines found in inventory.</Text>}
        />
      ) : activeTab === 'billing' ? (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item }) => (
            <View style={[styles.card, Shadows.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.invoiceNo, { color: colors.text }]}>Bill #{item.invoice_no}</Text>
                <Text style={[styles.invoiceDate, { color: colors.textMuted }]}>{item.invoice_date}</Text>
              </View>
              <Text style={[styles.patientName, { color: colors.text }]}>Patient: {item.patient_name || 'Walk-in'}</Text>
              <Text style={[styles.doctorName, { color: colors.textMuted }]}>Prescribed Doctor: {item.doctor_name || '—'}</Text>
              <View style={styles.cardDetailRow}>
                <Text style={[styles.totalPayable, { color: colors.accent }]}>Payable: ₹{item.net_payable}</Text>
                <Text style={[styles.statusText, item.status === 'paid' ? { color: colors.accent } : styles.statusDue]}>
                  {item.status?.toUpperCase()}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textMuted }]}>No pharmacy bills recorded yet.</Text>}
        />
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item }) => (
            <View style={[styles.card, Shadows.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.invoiceNo, { color: colors.text }]}>Receipt #{item.receipt_no}</Text>
              <Text style={[styles.patientName, { color: colors.text }]}>Patient: {item.patient_name || 'Customer'}</Text>
              <Text style={[styles.totalPayable, { color: colors.accent }]}>Paid: ₹{item.amount_paid} ({item.payment_mode})</Text>
              <Text style={[styles.invoiceDate, { color: colors.textMuted }]}>Date: {item.payment_date}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textMuted }]}>No payment receipts found.</Text>}
        />
      )}

      {/* Add Medicine Modal */}
      <Modal visible={showAddMedModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>💊 Add Medicine to Inventory</Text>

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Barcode / SKU Code</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="Barcode" placeholderTextColor="#64748b" value={barcode} onChangeText={setBarcode} />

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Medicine Name *</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="e.g. Paracetamol 500mg" placeholderTextColor="#64748b" value={medName} onChangeText={setMedName} />

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Generic Name</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="e.g. Acetaminophen" placeholderTextColor="#64748b" value={genericName} onChangeText={setGenericName} />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Stock Qty *</Text>
                <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="100" placeholderTextColor="#64748b" keyboardType="numeric" value={stockQty} onChangeText={setStockQty} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Unit Price (₹) *</Text>
                <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="15.00" placeholderTextColor="#64748b" keyboardType="numeric" value={unitPrice} onChangeText={setUnitPrice} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddMedModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={handleSaveMedicine} disabled={savingMed}>
                {savingMed ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.saveBtnText}>Save Medicine</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabBtnActive: {},
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: '#0f172a',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
  },
  addBtn: {
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 13,
  },
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  medTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeSuccess: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  badgeDanger: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
  stockBadgeText: { fontSize: 11, fontWeight: '700' },
  medGeneric: { fontSize: 12, marginTop: 2 },
  cardDetailRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  priceTag: { fontWeight: '800', fontSize: 13 },
  barcodeText: { fontSize: 11 },
  invoiceNo: { fontSize: 14, fontWeight: '700' },
  invoiceDate: { fontSize: 11 },
  patientName: { fontSize: 13, marginTop: 4 },
  doctorName: { fontSize: 12 },
  totalPayable: { fontWeight: '800', fontSize: 13, marginTop: 4 },
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
