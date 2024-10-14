import axios, { AxiosInstance } from 'axios';

// Create the axios instance
const baseServer: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default baseServer;