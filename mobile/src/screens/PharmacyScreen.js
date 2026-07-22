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
import { Colors, Shadows } from '../theme/colors';
import { api } from '../services/api';

export default function PharmacyScreen() {
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

  // Billing Modal
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [cart, setCart] = useState([]);
  const [savingBill, setSavingBill] = useState(false);

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
    <View style={styles.container}>
      {/* Tab Segment Controls */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'inventory' && styles.tabBtnActive]}
          onPress={() => setActiveTab('inventory')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'inventory' && styles.tabBtnTextActive]}>💊 Inventory</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'billing' && styles.tabBtnActive]}
          onPress={() => setActiveTab('billing')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'billing' && styles.tabBtnTextActive]}>🧾 Pharma Bills</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'receipts' && styles.tabBtnActive]}
          onPress={() => setActiveTab('receipts')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'receipts' && styles.tabBtnTextActive]}>📄 Receipts</Text>
        </TouchableOpacity>
      </View>

      {/* Header Actions */}
      {activeTab === 'inventory' && (
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Search name, generic, barcode..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={handleSearch}
          />
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddMedModal(true)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content List */}
      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      ) : activeTab === 'inventory' ? (
        <FlatList
          data={medicines}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item }) => (
            <View style={[styles.card, Shadows.card]}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.medTitle}>{item.name}</Text>
                <View style={[styles.stockBadge, parseInt(item.stock_quantity) <= 10 ? styles.badgeDanger : styles.badgeSuccess]}>
                  <Text style={styles.stockBadgeText}>Qty: {item.stock_quantity}</Text>
                </View>
              </View>
              <Text style={styles.medGeneric}>Generic: {item.generic_name || '—'}</Text>
              <View style={styles.cardDetailRow}>
                <Text style={styles.priceTag}>₹{item.unit_price} / unit</Text>
                <Text style={styles.barcodeText}>Barcode: {item.barcode || '—'}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No medicines found in inventory.</Text>}
        />
      ) : activeTab === 'billing' ? (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item }) => (
            <View style={[styles.card, Shadows.card]}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.invoiceNo}>Bill #{item.invoice_no}</Text>
                <Text style={styles.invoiceDate}>{item.invoice_date}</Text>
              </View>
              <Text style={styles.patientName}>Patient: {item.patient_name || 'Walk-in'}</Text>
              <Text style={styles.doctorName}>Prescribed Doctor: {item.doctor_name || '—'}</Text>
              <View style={styles.cardDetailRow}>
                <Text style={styles.totalPayable}>Payable: ₹{item.net_payable}</Text>
                <Text style={[styles.statusText, item.status === 'paid' ? styles.statusPaid : styles.statusDue]}>
                  {item.status?.toUpperCase()}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No pharmacy bills recorded yet.</Text>}
        />
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item }) => (
            <View style={[styles.card, Shadows.card]}>
              <Text style={styles.invoiceNo}>Receipt #{item.receipt_no}</Text>
              <Text style={styles.patientName}>Patient: {item.patient_name || 'Customer'}</Text>
              <Text style={styles.totalPayable}>Paid: ₹{item.amount_paid} ({item.payment_mode})</Text>
              <Text style={styles.invoiceDate}>Date: {item.payment_date}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No payment receipts found.</Text>}
        />
      )}

      {/* Add Medicine Modal */}
      <Modal visible={showAddMedModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalBox}>
            <Text style={styles.modalTitle}>💊 Add Medicine to Inventory</Text>

            <Text style={styles.modalLabel}>Barcode / SKU Code</Text>
            <TextInput style={styles.modalInput} placeholder="Barcode" placeholderTextColor="#64748b" value={barcode} onChangeText={setBarcode} />

            <Text style={styles.modalLabel}>Medicine Name *</Text>
            <TextInput style={styles.modalInput} placeholder="e.g. Paracetamol 500mg" placeholderTextColor="#64748b" value={medName} onChangeText={setMedName} />

            <Text style={styles.modalLabel}>Generic Name</Text>
            <TextInput style={styles.modalInput} placeholder="e.g. Acetaminophen" placeholderTextColor="#64748b" value={genericName} onChangeText={setGenericName} />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Stock Qty *</Text>
                <TextInput style={styles.modalInput} placeholder="100" placeholderTextColor="#64748b" keyboardType="numeric" value={stockQty} onChangeText={setStockQty} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Unit Price (₹) *</Text>
                <TextInput style={styles.modalInput} placeholder="15.00" placeholderTextColor="#64748b" keyboardType="numeric" value={unitPrice} onChangeText={setUnitPrice} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddMedModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveMedicine} disabled={savingMed}>
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
    backgroundColor: Colors.bgDark,
    padding: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCardDark,
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
  tabBtnActive: {
    backgroundColor: Colors.accent,
  },
  tabBtnText: {
    color: Colors.textMutedLight,
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
    backgroundColor: Colors.bgCardDark,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
    borderWidth: 1,
    borderColor: Colors.borderDark,
  },
  addBtn: {
    backgroundColor: Colors.accent,
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
    backgroundColor: Colors.bgCardDark,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderDark,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  medTitle: {
    color: '#ffffff',
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
  stockBadgeText: { color: Colors.accent, fontSize: 11, fontWeight: '700' },
  medGeneric: { color: Colors.textMutedLight, fontSize: 12, marginTop: 2 },
  cardDetailRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  priceTag: { color: Colors.accent, fontWeight: '800', fontSize: 13 },
  barcodeText: { color: Colors.textMutedLight, fontSize: 11 },
  invoiceNo: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  invoiceDate: { color: Colors.textMutedLight, fontSize: 11 },
  patientName: { color: '#ffffff', fontSize: 13, marginTop: 4 },
  doctorName: { color: Colors.textMutedLight, fontSize: 12 },
  totalPayable: { color: Colors.accent, fontWeight: '800', fontSize: 13, marginTop: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  statusPaid: { color: Colors.accent },
  statusDue: { color: Colors.danger },
  emptyText: { color: Colors.textMutedLight, textAlign: 'center', marginTop: 40, fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: Colors.bgCardDark, borderRadius: 20, padding: 20 },
  modalTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  modalLabel: { color: Colors.textMutedLight, fontSize: 12, marginBottom: 4, marginTop: 8 },
  modalInput: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: Colors.borderDark, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: '#ffffff' },
  cancelBtn: { flex: 1, backgroundColor: '#334155', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  cancelBtnText: { color: '#ffffff', fontWeight: '700' },
  saveBtn: { flex: 1, backgroundColor: Colors.accent, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#0f172a', fontWeight: '800' },
});
