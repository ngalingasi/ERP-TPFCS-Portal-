import axios from 'axios';

const BASE_URL = (import.meta as any).env?.VITE_ERP_API_URL ?? '/api/v1';

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach ERP portal token to admin requests
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('erp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default client;
export { BASE_URL };
