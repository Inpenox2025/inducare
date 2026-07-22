import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { Colors, Shadows } from '../theme/colors';
import { api } from '../services/api';

export default function PatientsScreen() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search patient name, phone, UHID..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item }) => (
            <View style={[styles.card, Shadows.card]}>
              <View style={styles.headerRow}>
                <Text style={styles.patientName}>{item.full_name}</Text>
                <Text style={styles.genderTag}>{item.gender || 'M'} • {item.age || '—'} yrs</Text>
              </View>
              <Text style={styles.mobileText}>📱 Phone: {item.mobile_no || '—'}</Text>
              <Text style={styles.addressText}>📍 Address: {item.address || 'Not specified'}</Text>
              <View style={styles.footerRow}>
                <Text style={styles.uhidText}>UHID: #{item.id}</Text>
                <TouchableOpacity style={styles.caseSheetBtn}>
                  <Text style={styles.caseSheetBtnText}>View Case Sheet 📄</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No registered patients found.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgDark, padding: 16 },
  searchRow: { marginBottom: 16 },
  searchInput: { backgroundColor: Colors.bgCardDark, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: '#ffffff', fontSize: 13, borderWidth: 1, borderColor: Colors.borderDark },
  card: { backgroundColor: Colors.bgCardDark, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderDark },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  patientName: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  genderTag: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  mobileText: { color: Colors.textMutedLight, fontSize: 13, marginTop: 6 },
  addressText: { color: Colors.textMutedLight, fontSize: 12, marginTop: 2 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderDark },
  uhidText: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  caseSheetBtn: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  caseSheetBtnText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  emptyText: { color: Colors.textMutedLight, textAlign: 'center', marginTop: 40, fontSize: 13 },
});
