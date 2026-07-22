import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_API_BASE = 'https://icare.inspenox.in/api';

class ApiService {
  constructor() {
    this.baseUrl = DEFAULT_API_BASE;
    this.token = null;
    this.user = null;
  }

  async init() {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('auth_user');
      const storedUrl = await AsyncStorage.getItem('api_base_url');

      if (storedToken) this.token = storedToken;
      if (storedUser) this.user = JSON.parse(storedUser);
      if (storedUrl) this.baseUrl = storedUrl;
    } catch (e) {
      console.warn('Error reading storage session:', e);
    }
  }

  setBaseUrl(url) {
    this.baseUrl = url || DEFAULT_API_BASE;
    AsyncStorage.setItem('api_base_url', this.baseUrl);
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  // --- Auth Endpoints ---
  async login(username, password, hospitalCode = '') {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, hospital_code: hospitalCode }),
    });
    const data = await res.json();
    if (res.ok && data.success && data.token) {
      this.token = data.token;
      this.user = data.user;
      await AsyncStorage.setItem('auth_token', data.token);
      await AsyncStorage.setItem('auth_user', JSON.stringify(data.user));
    }
    return data;
  }

  async logout() {
    this.token = null;
    this.user = null;
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_user');
  }

  // --- Patients & Case Sheets ---
  async getPatients(query = '') {
    const url = query ? `${this.baseUrl}/patients?q=${encodeURIComponent(query)}` : `${this.baseUrl}/patients`;
    const res = await fetch(url, { headers: this.getHeaders() });
    return await res.json();
  }

  // --- Pharmacy API ---
  async getMedicines(query = '') {
    const url = query ? `${this.baseUrl}/pharmacy?action=medicines&q=${encodeURIComponent(query)}` : `${this.baseUrl}/pharmacy?action=medicines`;
    const res = await fetch(url, { headers: this.getHeaders() });
    return await res.json();
  }

  async searchMedicineByBarcode(barcode) {
    const res = await fetch(`${this.baseUrl}/pharmacy?action=medicines&barcode=${encodeURIComponent(barcode)}`, { headers: this.getHeaders() });
    return await res.json();
  }

  async saveMedicine(payload) {
    const res = await fetch(`${this.baseUrl}/pharmacy?action=medicines`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return await res.json();
  }

  async getPharmaInvoices() {
    const res = await fetch(`${this.baseUrl}/pharmacy?action=invoices`, { headers: this.getHeaders() });
    return await res.json();
  }

  async getPharmaReceipts() {
    const res = await fetch(`${this.baseUrl}/pharmacy?action=receipts`, { headers: this.getHeaders() });
    return await res.json();
  }

  async createPharmaInvoice(payload) {
    const res = await fetch(`${this.baseUrl}/pharmacy?action=invoices`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return await res.json();
  }

  // --- Lab API ---
  async getLabTests(query = '') {
    const url = query ? `${this.baseUrl}/lab?action=tests&q=${encodeURIComponent(query)}` : `${this.baseUrl}/lab?action=tests`;
    const res = await fetch(url, { headers: this.getHeaders() });
    return await res.json();
  }

  async saveLabTest(payload) {
    const res = await fetch(`${this.baseUrl}/lab?action=tests`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return await res.json();
  }

  async getLabInvoices() {
    const res = await fetch(`${this.baseUrl}/lab?action=invoices`, { headers: this.getHeaders() });
    return await res.json();
  }

  async getLabReceipts() {
    const res = await fetch(`${this.baseUrl}/lab?action=receipts`, { headers: this.getHeaders() });
    return await res.json();
  }

  async createLabInvoice(payload) {
    const res = await fetch(`${this.baseUrl}/lab?action=invoices`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return await res.json();
  }

  // --- Support Tickets API ---
  async getTickets() {
    const res = await fetch(`${this.baseUrl}/tickets`, { headers: this.getHeaders() });
    return await res.json();
  }

  async createTicket(subject, description) {
    const res = await fetch(`${this.baseUrl}/tickets?action=create`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ subject, description }),
    });
    return await res.json();
  }

  async getTicketMessages(ticketId) {
    const res = await fetch(`${this.baseUrl}/tickets?action=messages&ticket_id=${ticketId}`, { headers: this.getHeaders() });
    return await res.json();
  }

  async sendTicketMessage(ticketId, message) {
    const res = await fetch(`${this.baseUrl}/tickets?action=message`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ticket_id: ticketId, message }),
    });
    return await res.json();
  }
}

export const api = new ApiService();
