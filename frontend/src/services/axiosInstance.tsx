import axios, { AxiosInstance } from 'axios';

// Create the axios instance
const baseServer: AxiosInstance = axios.create({
  baseURL: 'http://localhost:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default baseServer;