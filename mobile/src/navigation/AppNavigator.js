import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  Modal,
  ScrollView,
  Switch
} from 'react-native';
import { getThemeColors } from '../theme/colors';

import DashboardScreen from '../screens/DashboardScreen';
import PharmacyScreen from '../screens/PharmacyScreen';
import LabScreen from '../screens/LabScreen';
import PatientsScreen from '../screens/PatientsScreen';
import SupportTicketsScreen from '../screens/SupportTicketsScreen';
import SettingsScreen from '../screens/SettingsScreen';

export default function AppNavigator({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const colors = getThemeColors(isDarkMode);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const renderScreen = () => {
    switch (activeTab) {
      case 'Overview':
        return <DashboardScreen user={user} onNavigate={setActiveTab} isDarkMode={isDarkMode} />;
      case 'Pharmacy':
        return <PharmacyScreen isDarkMode={isDarkMode} />;
      case 'Laboratory':
        return <LabScreen isDarkMode={isDarkMode} />;
      case 'Patients':
        return <PatientsScreen isDarkMode={isDarkMode} />;
      case 'Support':
        return <SupportTicketsScreen isDarkMode={isDarkMode} />;
      case 'Settings':
        return <SettingsScreen user={user} onLogout={onLogout} isDarkMode={isDarkMode} onToggleTheme={toggleTheme} />;
      default:
        return <DashboardScreen user={user} onNavigate={setActiveTab} isDarkMode={isDarkMode} />;
    }
  };

  const bottomTabs = [
    { key: 'Overview', label: 'Overview', icon: '📊' },
    { key: 'Patients', label: 'Patients', icon: '👥' },
    { key: 'Pharmacy', label: 'Pharmacy', icon: '💊' },
    { key: 'Laboratory', label: 'Lab', icon: '🧪' },
    { key: 'More', label: 'More', icon: '☰' },
  ];

  const allWebModules = [
    { key: 'Patients', label: 'Patients Registry', icon: '👥', group: 'Clinical Management' },
    { key: 'Patients', label: 'Discharged Patients', icon: '👥', group: 'Clinical Management' },
    { key: 'Overview', label: 'Appointments', icon: '📅', group: 'Clinical Management' },
    { key: 'Overview', label: 'Billing & Invoices', icon: '💳', group: 'Financials' },
    { key: 'Overview', label: 'Payment Receipts', icon: '📜', group: 'Financials' },
    { key: 'Pharmacy', label: 'Pharmacy Inventory', icon: '💊', group: 'Pharmacy & Lab' },
    { key: 'Pharmacy', label: 'Pharma Bills & Receipts', icon: '📜', group: 'Pharmacy & Lab' },
    { key: 'Laboratory', label: 'Lab Tests Inventory', icon: '🧪', group: 'Pharmacy & Lab' },
    { key: 'Laboratory', label: 'Lab Bills & Receipts', icon: '🔬', group: 'Pharmacy & Lab' },
    { key: 'Overview', label: 'Doctors Registry', icon: '👨‍⚕️', group: 'Hospital Operations' },
    { key: 'Overview', label: 'Rooms & Allocations', icon: '🏢', group: 'Hospital Operations' },
    { key: 'Settings', label: 'Staff Settings', icon: '👩‍⚕️', group: 'Hospital Operations' },
    { key: 'Settings', label: 'Hospital Setup', icon: '⚙️', group: 'Hospital Operations' },
    { key: 'Overview', label: 'Insurance Claims', icon: '📄', group: 'Hospital Operations' },
    { key: 'Support', label: 'Support Tickets', icon: '🛠️', group: 'Support & Settings' },
    { key: 'Settings', label: 'Profile & Preferences', icon: '👤', group: 'Support & Settings' },
  ];

  const handleSelectModule = (tabKey) => {
    setActiveTab(tabKey);
    setShowMoreMenu(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.card}
      />

      {/* Modern Header Bar with Notch Padding */}
      <View style={[styles.headerBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>🏥 ICARE MOBILE</Text>
          <Text style={[styles.headerSubtitle, { color: colors.accent }]}>{activeTab.toUpperCase()}</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: colors.cardSub, borderColor: colors.border }]}
            onPress={() => setShowMoreMenu(true)}
          >
            <Text style={{ fontSize: 16 }}>☰</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Active Screen View */}
      <View style={styles.screenContainer}>
        {renderScreen()}
      </View>

      {/* Modern Bottom Navigation Bar */}
      <View style={[styles.bottomNavBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {bottomTabs.map((tab) => {
          const isActive = activeTab === tab.key && !showMoreMenu;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.navItem, isActive && [styles.navItemActive, { backgroundColor: colors.cardSub }]]}
              onPress={() => {
                if (tab.key === 'More') {
                  setShowMoreMenu(true);
                } else {
                  setActiveTab(tab.key);
                }
              }}
            >
              <Text style={[styles.navIcon, isActive && styles.navIconActive]}>{tab.icon}</Text>
              <Text style={[styles.navLabel, { color: colors.textMuted }, isActive && { color: colors.accent, fontWeight: '800' }]}>
                {tab.label}
              </Text>
              {isActive && <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Complete Web Modules Slide-over Drawer Modal */}
      <Modal visible={showMoreMenu} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.drawerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.drawerHeader}>
              <View>
                <Text style={[styles.drawerTitle, { color: colors.text }]}>📋 All Hospital Modules</Text>
                <Text style={[styles.drawerSub, { color: colors.textMuted }]}>Full Web Portal Navigation</Text>
              </View>
              <TouchableOpacity style={styles.closeDrawerBtn} onPress={() => setShowMoreMenu(false)}>
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }}>
              {/* Quick Theme Switch inside Drawer */}
              <View style={[styles.themeRow, { backgroundColor: colors.cardSub, borderColor: colors.border }]}>
                <Text style={[styles.themeLabel, { color: colors.text }]}>
                  {isDarkMode ? '🌙 Dark Mode Active' : '☀️ Light Mode Active'}
                </Text>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#cbd5e1', true: '#10b981' }}
                  thumbColor={isDarkMode ? '#ffffff' : '#f8fafc'}
                />
              </View>

              {/* List of Web Portal Modules */}
              {allWebModules.map((mod, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.moduleRow, { borderBottomColor: colors.border }]}
                  onPress={() => handleSelectModule(mod.key)}
                >
                  <Text style={styles.moduleIcon}>{mod.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.moduleLabel, { color: colors.text }]}>{mod.label}</Text>
                    <Text style={[styles.moduleGroup, { color: colors.textMuted }]}>{mod.group}</Text>
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>›</Text>
                </TouchableOpacity>
              ))}

              {/* Sign Out Option */}
              <TouchableOpacity
                style={[styles.moduleRow, { marginTop: 16, borderBottomWidth: 0 }]}
                onPress={() => {
                  setShowMoreMenu(false);
                  onLogout();
                }}
              >
                <Text style={styles.moduleIcon}>🚪</Text>
                <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 15 }}>Sign Out of Portal</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 12 : 16,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'column',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  screenContainer: {
    flex: 1,
  },
  bottomNavBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    minWidth: 58,
  },
  navItemActive: {},
  navIcon: {
    fontSize: 22, // Larger icons
  },
  navIconActive: {
    transform: [{ scale: 1.1 }],
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  drawerContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    height: '85%',
    borderWidth: 1,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  drawerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  closeDrawerBtn: {
    backgroundColor: '#334155',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  themeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  moduleIcon: {
    fontSize: 20,
  },
  moduleLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  moduleGroup: {
    fontSize: 11,
    marginTop: 2,
  },
});
