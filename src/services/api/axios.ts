import axios from 'axios';
import { getAuthToken } from '../../utilities/contextManager';


const authToken = getAuthToken();

const api = axios.create({
    baseURL: 'http://localhost:8084',
    headers: {
        'Content-Type': 'application/json',
        'X-Client': 'VSCODE_EXT',
        'X-Client-Version': '0.0.1',
        'Authorization': 'Bearer ' + authToken 
    },
    withCredentials: false
});

const binaryApi = axios.create({
    baseURL: 'http://localhost:8001',
    headers: {
        'Content-Type': 'application/json',
        'X-Client': 'VSCODE_EXT',
        'X-Client-Version': '0.0.1',
        'Authorization': 'Bearer ' + authToken 
    },
    withCredentials: false
});

export { api, binaryApi };