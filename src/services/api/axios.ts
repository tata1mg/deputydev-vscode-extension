import axios from 'axios';
import { DD_HOST,getBinaryHost ,CLIENT_VERSION , CLIENT } from '../../config';

const api = axios.create({
    baseURL: DD_HOST,
    headers: {
        'Content-Type': 'application/json',
        'X-Client': CLIENT,
        'X-Client-Version': CLIENT_VERSION,
    },
    withCredentials: false
});

export function binaryApi() {
    return axios.create({
      baseURL: getBinaryHost(),
      headers: {
        'Content-Type': 'application/json',
        'X-Client': CLIENT,
        'X-Client-Version': CLIENT_VERSION,
      },
      withCredentials: false
    });
  }
  

export { api };