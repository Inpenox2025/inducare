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
import { Colors, getThemeColors, Shadows } from '../theme/colors';
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
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
    >
      {/* Welcome Banner */}
      <View style={[styles.welcomeCard, Shadows.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.welcomeText, { color: colors.textMuted }]}>Welcome back,</Text>
          <Text style={[styles.userNameText, { color: colors.text }]}>{user?.full_name || user?.username || 'Staff User'}</Text>
          <View style={[styles.roleBadge, { backgroundColor: colors.cardSub }]}>
            <Text style={[styles.roleBadgeText, { color: colors.accent }]}>{(user?.role || 'HOSPITAL STAFF').toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.userAvatar}>👨‍⚕️</Text>
      </View>

      {/* Metrics Grid */}
      <Text style={[styles.sectionHeader, { color: colors.text }]}>📊 Operational Summary</Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: 30 }} />
      ) : (
        <View style={styles.statsGrid}>
          <TouchableOpacity
            style={[styles.statBox, Shadows.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => onNavigate && onNavigate('Patients')}
          >
            <Text style={styles.statIcon}>👥</Text>
            <Text style={[styles.statNumber, { color: colors.text }]}>{stats.patientsCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Patients Registry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statBox, Shadows.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => onNavigate && onNavigate('Pharmacy')}
          >
            <Text style={styles.statIcon}>💊</Text>
            <Text style={[styles.statNumber, { color: colors.text }]}>{stats.medicinesCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Pharmacy Items</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statBox, Shadows.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => onNavigate && onNavigate('Laboratory')}
          >
            <Text style={styles.statIcon}>🧪</Text>
            <Text style={[styles.statNumber, { color: colors.text }]}>{stats.labTestsCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Diagnostic Tests</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statBox, Shadows.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => onNavigate && onNavigate('Support')}
          >
            <Text style={styles.statIcon}>🛠️</Text>
            <Text style={[styles.statNumber, { color: colors.accent }]}>{stats.openTicketsCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Open Support Tickets</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Quick Access Launchers */}
      <Text style={[styles.sectionHeader, { color: colors.text }]}>🚀 Quick Launchers</Text>

      <View style={styles.quickLaunchers}>
        <TouchableOpacity
          style={[styles.launcherBtn, Shadows.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => onNavigate && onNavigate('Pharmacy')}
        >
          <Text style={styles.launcherIcon}>🧾</Text>
          <Text style={[styles.launcherText, { color: colors.text }]}>New Pharmacy Bill & Prescription</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.launcherBtn, Shadows.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => onNavigate && onNavigate('Laboratory')}
        >
          <Text style={styles.launcherIcon}>🔬</Text>
          <Text style={[styles.launcherText, { color: colors.text }]}>Generate Diagnostic Lab Order</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.launcherBtn, Shadows.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => onNavigate && onNavigate('Support')}
        >
          <Text style={styles.launcherIcon}>💬</Text>
          <Text style={[styles.launcherText, { color: colors.text }]}>Raise Support Ticket / Live Chat</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  welcomeCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
  },
  welcomeText: {
    fontSize: 13,
  },
  userNameText: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  roleBadgeText: {
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
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  statIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  quickLaunchers: {
    gap: 10,
    marginBottom: 40,
  },
  launcherBtn: {
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  launcherIcon: {
    fontSize: 22,
    marginRight: 14,
  },
  launcherText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
