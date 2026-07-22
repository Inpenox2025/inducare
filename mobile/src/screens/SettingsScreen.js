import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert
} from 'react-native';
import { Colors, Shadows } from '../theme/colors';
import { api } from '../services/api';

export default function SettingsScreen({ user, onLogout }) {
  const [serverUrl, setServerUrl] = useState(api.baseUrl);

  const handleSaveServerUrl = () => {
    if (!serverUrl.trim()) return;
    api.setBaseUrl(serverUrl.trim());
    Alert.alert('Saved', `API Base URL updated to: ${serverUrl.trim()}`);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of the mobile portal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await api.logout();
            onLogout();
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.profileCard, Shadows.card]}>
        <Text style={styles.avatarText}>👨‍⚕️</Text>
        <Text style={styles.userName}>{user?.full_name || user?.username || 'User'}</Text>
        <Text style={styles.userRole}>{(user?.role || 'Staff').toUpperCase()}</Text>
        <Text style={styles.hospitalName}>🏥 {user?.hospital_name || 'Inducare Medical Center'}</Text>
      </View>

      <View style={[styles.card, Shadows.card]}>
        <Text style={styles.cardTitle}>⚙️ Server Connection Settings</Text>
        <Text style={styles.label}>Live Backend API Endpoint URL</Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          autoCapitalize="none"
          keyboardType="url"
        />
        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveServerUrl}>
          <Text style={styles.saveBtnText}>Update API Endpoint</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>🔴 Sign Out of Portal</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgDark, padding: 16 },
  profileCard: { backgroundColor: Colors.bgCardDark, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: Colors.borderDark },
  avatarText: { fontSize: 54, marginBottom: 8 },
  userName: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  userRole: { color: Colors.accent, fontSize: 12, fontWeight: '800', marginTop: 2, letterSpacing: 1 },
  hospitalName: { color: Colors.textMutedLight, fontSize: 13, marginTop: 8 },
  card: { backgroundColor: Colors.bgCardDark, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.borderDark },
  cardTitle: { color: '#ffffff', fontSize: 15, fontWeight: '800', marginBottom: 12 },
  label: { color: Colors.textMutedLight, fontSize: 12, marginBottom: 6 },
  input: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: Colors.borderDark, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: '#ffffff', fontSize: 13 },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 13 },
  logoutBtn: { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderWidth: 1, borderColor: Colors.danger, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  logoutBtnText: { color: Colors.danger, fontWeight: '800', fontSize: 14 },
});
