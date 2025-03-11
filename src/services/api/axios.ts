import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8084',
    headers: {
        'Content-Type': 'application/json',
        'X-Client': 'VSCODE_EXT',
        'X-Client-Version': '0.0.1'
    },
    withCredentials: false
});

const binaryApi = axios.create({
    baseURL: 'http://localhost:8001',
    headers: {
        'Content-Type': 'application/json',
        'X-Client': 'VSCODE_EXT',
        'X-Client-Version': '0.0.1'
    },
    withCredentials: false
});

export { api, binaryApi };