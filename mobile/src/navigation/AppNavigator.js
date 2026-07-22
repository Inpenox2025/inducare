import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { Colors } from '../theme/colors';

import DashboardScreen from '../screens/DashboardScreen';
import PharmacyScreen from '../screens/PharmacyScreen';
import LabScreen from '../screens/LabScreen';
import PatientsScreen from '../screens/PatientsScreen';
import SupportTicketsScreen from '../screens/SupportTicketsScreen';
import SettingsScreen from '../screens/SettingsScreen';

export default function AppNavigator({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('Overview'); // 'Overview' | 'Pharmacy' | 'Laboratory' | 'Patients' | 'Support' | 'Settings'

  const renderScreen = () => {
    switch (activeTab) {
      case 'Overview':
        return <DashboardScreen user={user} onNavigate={setActiveTab} />;
      case 'Pharmacy':
        return <PharmacyScreen />;
      case 'Laboratory':
        return <LabScreen />;
      case 'Patients':
        return <PatientsScreen />;
      case 'Support':
        return <SupportTicketsScreen />;
      case 'Settings':
        return <SettingsScreen user={user} onLogout={onLogout} />;
      default:
        return <DashboardScreen user={user} onNavigate={setActiveTab} />;
    }
  };

  const tabs = [
    { key: 'Overview', label: 'Overview', icon: '📊' },
    { key: 'Pharmacy', label: 'Pharmacy', icon: '💊' },
    { key: 'Laboratory', label: 'Lab', icon: '🧪' },
    { key: 'Patients', label: 'Patients', icon: '👥' },
    { key: 'Support', label: 'Tickets', icon: '🛠️' },
    { key: 'Settings', label: 'Profile', icon: '⚙️' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>🏥 INDUCARE MOBILE</Text>
        <Text style={styles.headerSubtitle}>{activeTab.toUpperCase()}</Text>
      </View>

      {/* Screen View */}
      <View style={styles.screenContainer}>
        {renderScreen()}
      </View>

      {/* Modern Bottom Navigation Bar */}
      <View style={styles.bottomNavBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.navIcon, isActive && styles.navIconActive]}>{tab.icon}</Text>
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{tab.label}</Text>
              {isActive && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgDark,
  },
  headerBar: {
    backgroundColor: Colors.bgCardDark,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDark,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerSubtitle: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  screenContainer: {
    flex: 1,
  },
  bottomNavBar: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: Colors.borderDark,
    paddingVertical: 6,
    paddingHorizontal: 4,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    minWidth: 50,
  },
  navItemActive: {
    backgroundColor: '#172033',
  },
  navIcon: {
    fontSize: 18,
    opacity: 0.6,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMutedLight,
    marginTop: 2,
  },
  navLabelActive: {
    color: Colors.accent,
    fontWeight: '800',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent,
    marginTop: 3,
  },
});
