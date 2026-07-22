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
import { getThemeColors, Shadows } from '../theme/colors';
import { api } from '../services/api';

export default function SupportTicketsScreen({ isDarkMode = true }) {
  const colors = getThemeColors(isDarkMode);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Raise Ticket Modal
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Chat Modal
  const [showChatModal, setShowChatModal] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await api.getTickets();
      if (res.success && res.tickets) {
        setTickets(res.tickets);
      }
    } catch (err) {
      console.warn('Error loading support tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRaiseTicket = async () => {
    if (!subject.trim()) {
      Alert.alert('Required', 'Please enter a ticket subject/topic.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createTicket(subject.trim(), description.trim());
      if (res.success) {
        Alert.alert('Success', 'Support ticket raised successfully!');
        setShowRaiseModal(false);
        setSubject(''); setDescription('');
        loadTickets();
      } else {
        Alert.alert('Error', res.error || 'Failed to raise ticket');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error creating support ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const openChat = async (ticket) => {
    setActiveTicket(ticket);
    setShowChatModal(true);
    try {
      const res = await api.getTicketMessages(ticket.id);
      if (res.success && res.messages) {
        setMessages(res.messages);
      }
    } catch (err) {
      console.warn('Error loading messages:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !activeTicket) return;

    setSendingMsg(true);
    try {
      const res = await api.sendTicketMessage(activeTicket.id, chatMessage.trim());
      if (res.success) {
        setChatMessage('');
        const msgRes = await api.getTicketMessages(activeTicket.id);
        if (msgRes.success && msgRes.messages) setMessages(msgRes.messages);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to send chat message');
    } finally {
      setSendingMsg(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.raiseBtn} onPress={() => setShowRaiseModal(true)}>
        <Text style={styles.raiseBtnText}>+ Raise Support Ticket</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item }) => (
            <View style={[styles.card, Shadows.card]}>
              <View style={styles.headerRow}>
                <Text style={styles.ticketId}>Ticket #{item.id}</Text>
                <View style={[styles.statusBadge, item.status === 'open' ? styles.badgeOpen : styles.badgeResolved]}>
                  <Text style={styles.statusText}>{item.status?.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.subjectText}>{item.subject}</Text>
              {item.description ? <Text style={styles.descText}>{item.description}</Text> : null}

              <TouchableOpacity style={styles.chatBtn} onPress={() => openChat(item)}>
                <Text style={styles.chatBtnText}>💬 View Conversation / Chat</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No support tickets found.</Text>}
        />
      )}

      {/* Raise Ticket Modal */}
      <Modal visible={showRaiseModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>🛠️ Raise Support Ticket</Text>

            <Text style={styles.modalLabel}>Subject / Topic *</Text>
            <TextInput style={styles.modalInput} placeholder="e.g. Reconciliation error, Billing mismatch" placeholderTextColor="#64748b" value={subject} onChangeText={setSubject} />

            <Text style={styles.modalLabel}>Detailed Description</Text>
            <TextInput style={[styles.modalInput, { height: 100 }]} placeholder="Describe the issue..." placeholderTextColor="#64748b" multiline value={description} onChangeText={setDescription} />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRaiseModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleRaiseTicket} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.saveBtnText}>Submit Ticket</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Chat Messages Modal */}
      <Modal visible={showChatModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>💬 Ticket #{activeTicket?.id}: {activeTicket?.subject}</Text>

            <ScrollView style={{ maxHeight: 300, marginVertical: 10 }}>
              {messages.length === 0 ? (
                <Text style={styles.emptyText}>No messages in chat thread yet.</Text>
              ) : (
                messages.map((m, idx) => (
                  <View key={idx} style={[styles.msgBubble, m.sender_role === 'super_admin' ? styles.msgAdmin : styles.msgMe]}>
                    <Text style={styles.msgText}>{m.message}</Text>
                    <Text style={styles.msgMeta}>{m.sender_name || 'User'} ({m.sender_role})</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                placeholder="Type reply message..."
                placeholderTextColor="#64748b"
                value={chatMessage}
                onChangeText={setChatMessage}
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSendMessage} disabled={sendingMsg}>
                <Text style={styles.saveBtnText}>Send</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setShowChatModal(false)}>
              <Text style={{ color: Colors.textMutedLight, fontWeight: '700' }}>Close Chat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgDark, padding: 16 },
  raiseBtn: { backgroundColor: Colors.accent, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginBottom: 16 },
  raiseBtnText: { color: '#0f172a', fontSize: 14, fontWeight: '800' },
  card: { backgroundColor: Colors.bgCardDark, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderDark },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketId: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeOpen: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
  badgeResolved: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  statusText: { color: Colors.accent, fontSize: 11, fontWeight: '800' },
  subjectText: { color: '#ffffff', fontSize: 14, fontWeight: '700', marginTop: 6 },
  descText: { color: Colors.textMutedLight, fontSize: 12, marginTop: 4 },
  chatBtn: { backgroundColor: '#1e293b', paddingVertical: 8, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  chatBtnText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  emptyText: { color: Colors.textMutedLight, textAlign: 'center', marginTop: 30, fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: Colors.bgCardDark, borderRadius: 20, padding: 20 },
  modalTitle: { color: '#ffffff', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  modalLabel: { color: Colors.textMutedLight, fontSize: 12, marginBottom: 4, marginTop: 8 },
  modalInput: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: Colors.borderDark, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: '#ffffff' },
  cancelBtn: { flex: 1, backgroundColor: '#334155', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  cancelBtnText: { color: '#ffffff', fontWeight: '700' },
  saveBtn: { backgroundColor: Colors.accent, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#0f172a', fontWeight: '800' },
  msgBubble: { padding: 10, borderRadius: 12, marginBottom: 8, maxWidth: '85%' },
  msgMe: { backgroundColor: Colors.primary, alignSelf: 'flex-end' },
  msgAdmin: { backgroundColor: '#334155', alignSelf: 'flex-start' },
  msgText: { color: '#ffffff', fontSize: 13 },
  msgMeta: { color: Colors.textMutedLight, fontSize: 10, marginTop: 4, textAlign: 'right' },
});
