import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import { Colors, Shadows } from '../theme/colors';
import { api } from '../services/api';

export default function LoginScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [hospitalCode, setHospitalCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Missing Credentials', 'Please enter both username and password.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.login(username.trim(), password.trim(), hospitalCode.trim());
      if (result.success) {
        onLoginSuccess(result.user);
      } else {
        Alert.alert('Login Failed', result.error || 'Invalid credentials or hospital code.');
      }
    } catch (err) {
      Alert.alert('Network Error', 'Unable to reach icare server. Please check internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerBox}>
          <Text style={styles.logoIcon}>🏥</Text>
          <Text style={styles.brandTitle}>Icare</Text>
          <Text style={styles.brandSubtitle}>Hospital & Pharmacy Management</Text>
        </View>

        <View style={[styles.card, Shadows.card]}>
          <Text style={styles.cardHeader}>Sign In to Mobile Portal</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Hospital Code (Optional for Super Admin)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. HOSP-101"
              placeholderTextColor="#64748b"
              value={hospitalCode}
              onChangeText={setHospitalCode}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username / Mobile <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your username"
              placeholderTextColor="#64748b"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#64748b"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginBtnText}>SIGN IN TO PORTAL ➔</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footerNote}>
          🔒 Secure SSL Encrypted Mobile Connection • Live icare Cloud
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgDark,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoIcon: {
    fontSize: 54,
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
  },
  brandSubtitle: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '600',
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.bgCardDark,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.borderDark,
  },
  cardHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMutedLight,
    marginBottom: 6,
  },
  req: {
    color: Colors.danger,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: Colors.borderDark,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 14,
  },
  loginBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  footerNote: {
    marginTop: 28,
    textAlign: 'center',
    color: '#64748b',
    fontSize: 11,
  },
});
