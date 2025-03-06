import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8084',
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: false
});

const binaryApi = axios.create({
    baseURL: 'http://localhost:8001',
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: false
});

export { api, binaryApi };