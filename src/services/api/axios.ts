import axios from 'axios';
import { DD_HOST,BINARY_HOST ,CLIENT_VERSION } from '../../config';

const api = axios.create({
    baseURL: DD_HOST,
    headers: {
        'Content-Type': 'application/json',
        'X-Client': 'VSCODE_EXT',
        'X-Client-Version': CLIENT_VERSION,
    },
    withCredentials: false
});

const binaryApi = axios.create({
    baseURL: BINARY_HOST,
    headers: {
        'Content-Type': 'application/json',
        'X-Client': 'VSCODE_EXT',
        'X-Client-Version': CLIENT_VERSION,
    },
    withCredentials: false
});

export { api, binaryApi };