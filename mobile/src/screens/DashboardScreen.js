import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { getThemeColors, Shadows } from '../theme/colors';
import { api } from '../services/api';

export default function DashboardScreen({ user, onNavigate, isDarkMode = true }) {
  const colors = getThemeColors(isDarkMode);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    patientsCount: 0,
    medicinesCount: 0,
    labTestsCount: 0,
    openTicketsCount: 0,
  });

  const fetchDashboardData = async () => {
    try {
      const [patData, medData, labData, tktData] = await Promise.all([
        api.getPatients().catch(() => ({ success: false })),
        api.getMedicines().catch(() => ({ success: false })),
        api.getLabTests().catch(() => ({ success: false })),
        api.getTickets().catch(() => ({ success: false })),
      ]);

      setStats({
        patientsCount: patData.success && patData.patients ? patData.patients.length : 0,
        medicinesCount: medData.success && medData.medicines ? medData.medicines.length : 0,
        labTestsCount: labData.success && labData.tests ? labData.tests.length : 0,
        openTicketsCount: tktData.success && tktData.tickets ? tktData.tickets.filter(t => t.status === 'open').length : 0,
      });
    } catch (e) {
      console.warn('Error fetching dashboard stats:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}
    >
      {/* Top Header Card */}
      <View style={styles.topCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userNameText}>{user?.full_name || user?.username || 'User'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {(user?.role || 'Staff').toUpperCase()} • {user?.hospital_name || 'Inducare Medical Center'}
            </Text>
          </View>
        </View>
        <Text style={styles.userAvatar}>👨‍⚕️</Text>
      </View>

      {/* Stats Grid */}
      <Text style={styles.sectionHeader}>📊 Operational Overview</Text>
      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginVertical: 30 }} />
      ) : (
        <View style={styles.statsGrid}>
          <TouchableOpacity style={[styles.statBox, Shadows.card]} onPress={() => onNavigate('Pharmacy')}>
            <Text style={styles.statIcon}>💊</Text>
            <Text style={styles.statNumber}>{stats.medicinesCount}</Text>
            <Text style={styles.statLabel}>Pharmacy Medicines</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.statBox, Shadows.card]} onPress={() => onNavigate('Laboratory')}>
            <Text style={styles.statIcon}>🧪</Text>
            <Text style={styles.statNumber}>{stats.labTestsCount}</Text>
            <Text style={styles.statLabel}>Lab Diagnostic Catalog</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.statBox, Shadows.card]} onPress={() => onNavigate('Patients')}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={styles.statNumber}>{stats.patientsCount}</Text>
            <Text style={styles.statLabel}>Registered Patients</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.statBox, Shadows.card]} onPress={() => onNavigate('Support')}>
            <Text style={styles.statIcon}>🛠️</Text>
            <Text style={styles.statNumber}>{stats.openTicketsCount}</Text>
            <Text style={styles.statLabel}>Open Support Tickets</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Quick Launchers */}
      <Text style={styles.sectionHeader}>⚡ Quick Actions</Text>
      <View style={styles.quickLaunchers}>
        <TouchableOpacity style={styles.launcherBtn} onPress={() => onNavigate('Pharmacy')}>
          <Text style={styles.launcherIcon}>🧾</Text>
          <Text style={styles.launcherText}>New Pharmacy Bill</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.launcherBtn} onPress={() => onNavigate('Laboratory')}>
          <Text style={styles.launcherIcon}>🔬</Text>
          <Text style={styles.launcherText}>New Lab Order</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.launcherBtn} onPress={() => onNavigate('Support')}>
          <Text style={styles.launcherIcon}>🛠️</Text>
          <Text style={styles.launcherText}>Raise Support Ticket</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgDark,
    padding: 16,
  },
  topCard: {
    backgroundColor: Colors.bgCardDark,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.borderDark,
  },
  welcomeText: {
    color: Colors.textMutedLight,
    fontSize: 13,
  },
  userNameText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  roleBadgeText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  userAvatar: {
    fontSize: 42,
    marginLeft: 12,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    width: '48%',
    backgroundColor: Colors.bgCardDark,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderDark,
  },
  statIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMutedLight,
    marginTop: 4,
  },
  quickLaunchers: {
    gap: 10,
    marginBottom: 40,
  },
  launcherBtn: {
    backgroundColor: Colors.bgCardDark,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderDark,
  },
  launcherIcon: {
    fontSize: 22,
    marginRight: 14,
  },
  launcherText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
