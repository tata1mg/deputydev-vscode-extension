

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { binaryApi } from '../services/api/axios';
import { API_ENDPOINTS } from '../services/api/endpoints';
import axios from 'axios';

let REGISTRY_DIR: string;

const platform = process.platform;

if (platform === 'darwin') {
  // macOS
  REGISTRY_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'deputydev');
} else if (platform === 'win32') {
  // Windows
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  REGISTRY_DIR = path.join(appData, 'deputydev');
} else {
  // Linux and others
  REGISTRY_DIR = path.join(os.homedir(), '.config', 'deputydev');
}

export const REGISTRY_FILE = path.join(REGISTRY_DIR, 'binaryRegistry.json');


interface BinaryInfo {
  pid?: number; 
  port: number;
  started: number;
}

interface InstanceInfo {
  pid: number;
  timestamp: number;
}

interface Registry {
  binary?: BinaryInfo;
  instances: InstanceInfo[];
}

function ensureDirectoryExists(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readRegistry(): Registry {
  try {
    const data = fs.readFileSync(REGISTRY_FILE, 'utf8');
    return JSON.parse(data) as Registry;
  } catch (err) {
    return { instances: [] };
  }
}

function writeRegistry(registry: Registry) {
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf8');
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// When an extension activates
export function addInstance() {
  ensureDirectoryExists(REGISTRY_DIR);
  const registry = readRegistry();
  // Clean stale instances
  registry.instances = registry.instances.filter(instance => isProcessAlive(instance.pid));

  registry.instances.push({ pid: process.pid, timestamp: Date.now() });
  writeRegistry(registry);
}

// When binary is started, update its info
export async function setBinaryInfo(port: number, pid: number = 0) {
  ensureDirectoryExists(REGISTRY_DIR);
  const registry = readRegistry();
  registry.binary = { pid, port, started: Date.now() };
  writeRegistry(registry);
}

// When an extension deactivates
export async function removeInstance() {
  const registry = readRegistry();
  registry.instances = registry.instances.filter(instance => instance.pid !== process.pid);
  if (registry.instances.length === 0) {
    await binaryApi.get(API_ENDPOINTS.SHUTDOWN);
  }
  writeRegistry(registry);
}


// create a function to get existing port no from binaryRegistry.json, if it exists else return 0 
export function getExistingPort(): number {
  if (fs.existsSync(REGISTRY_FILE)) {

    const content = fs.readFileSync(REGISTRY_FILE, 'utf-8');
    const registry = JSON.parse(content);
    const existingPort = registry?.binary?.port;
    return existingPort;
  }
  return 0;
}

           



