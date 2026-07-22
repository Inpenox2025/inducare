import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  Alert
} from 'react-native';
import { getThemeColors, Shadows } from '../theme/colors';
import { api } from '../services/api';

export default function SettingsScreen({ user, onLogout, isDarkMode, onToggleTheme }) {
  const colors = getThemeColors(isDarkMode);

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out',
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
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Profile Header */}
      <View style={[styles.profileCard, Shadows.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.avatarText}>👨‍⚕️</Text>
        <Text style={[styles.userName, { color: colors.text }]}>{user?.full_name || user?.username || 'Hospital User'}</Text>
        <Text style={[styles.userRole, { color: colors.accent }]}>{(user?.role || 'Staff').toUpperCase()}</Text>
        <Text style={[styles.hospitalName, { color: colors.textMuted }]}>🏥 {user?.hospital_name || 'Inspenox Medical Center'}</Text>
      </View>

      {/* App Theme Settings Card */}
      <View style={[styles.card, Shadows.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>🎨 Appearance & Theme</Text>
        
        <View style={styles.settingRow}>
          <View>
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              {isDarkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </Text>
            <Text style={[styles.settingSub, { color: colors.textMuted }]}>
              Toggle app color scheme theme
            </Text>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={onToggleTheme}
            trackColor={{ false: '#cbd5e1', true: '#10b981' }}
            thumbColor={isDarkMode ? '#ffffff' : '#f8fafc'}
          />
        </View>
      </View>

      {/* App Version Info Card */}
      <View style={[styles.card, Shadows.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>📱 App Metadata</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>App Name</Text>
          <Text style={[styles.metaVal, { color: colors.text }]}>Icare Mobile</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Build Version</Text>
          <Text style={[styles.metaVal, { color: colors.accent }]}>v1.0.0 (Play Store Release)</Text>
        </View>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>🚪 Sign Out of Portal</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  profileCard: { borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 16, borderWidth: 1 },
  avatarText: { fontSize: 48, marginBottom: 6 },
  userName: { fontSize: 18, fontWeight: '800' },
  userRole: { fontSize: 12, fontWeight: '800', marginTop: 2, letterSpacing: 1 },
  hospitalName: { fontSize: 13, marginTop: 6 },
  card: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingLabel: { fontSize: 14, fontWeight: '700' },
  settingSub: { fontSize: 11, marginTop: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  metaLabel: { fontSize: 13 },
  metaVal: { fontSize: 13, fontWeight: '700' },
  logoutBtn: { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: '#ef4444', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  logoutBtnText: { color: '#ef4444', fontWeight: '800', fontSize: 14 },
});
