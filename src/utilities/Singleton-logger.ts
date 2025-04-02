import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';

export class SingletonLogger {
  private static _instance: SingletonLogger | null = null;

  private logFilePath: string;
  private debugMode: boolean;

  private constructor() {
    this.debugMode = true;

    const homeDir = os.homedir();
    const baseDir = path.join(homeDir, '.deputydev', 'logs');
    const pid = process.pid.toString();

    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    const pidFolderPrefix = `pid_${pid}_`;
    const existingPidFolder = fs.readdirSync(baseDir).find(folder =>
      folder.startsWith(pidFolderPrefix)
    );

    let pidDir: string;
    if (existingPidFolder) {
      pidDir = existingPidFolder;
    } else {
      const startDate = new Date().toISOString().slice(0, 10);
      pidDir = `${pidFolderPrefix}${startDate}`;
      fs.mkdirSync(path.join(baseDir, pidDir));
    }

    const today = new Date().toISOString().slice(0, 10);
    const logDir = path.join(baseDir, pidDir, today);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.logFilePath = path.join(logDir, 'debug.log');

    // console.log('DeputyDev (singleton) debug logs filepath is:', this.logFilePath);
  }

  public static getInstance(): SingletonLogger {
    if (!SingletonLogger._instance) {
      SingletonLogger._instance = new SingletonLogger();
    }
    return SingletonLogger._instance;
  }

  deleteLogsOlderThan(days: number) {
    const homeDir = os.homedir();
    const baseDir = path.join(homeDir, '.deputydev', 'logs');
    const now = Date.now();

    if (!fs.existsSync(baseDir)) return;

    fs.readdirSync(baseDir).forEach(folder => {
      const fullPath = path.join(baseDir, folder);
      if (!fs.statSync(fullPath).isDirectory()) return;

      try {
        const stats = fs.statSync(fullPath);
        const ageInDays = (now - stats.ctime.getTime()) / (1000 * 60 * 60 * 24);
        if (ageInDays > days) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        }
      } catch (err) {
        // Handle error silently or log it elsewhere
      }
    });
  }

  private formatArgs(level: string, args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.map(arg => {
      if (typeof arg === 'string') return arg;
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    });
    return `[${timestamp}] ${level.toUpperCase()}: ${formattedArgs.join(' ')}\n`;
  }

  private log(level: string, ...args: any[]) {
    if (!this.debugMode) return;

    const formatted = this.formatArgs(level, args);

    try {
      fs.appendFileSync(this.logFilePath, formatted, 'utf8');
    } catch (err) {
      // Silently fail
    }
  }

  error(...args: any[]) {
    this.log('error', ...args);
  }

  info(...args: any[]) {
    this.log('info', ...args);
  }

  warn(...args: any[]) {
    this.log('warn', ...args);
  }

  debug(...args: any[]) {
    this.log('debug', ...args);
  }

  async showCurrentProcessLogs() {
    const pid = process.pid.toString();
    const homeDir = os.homedir();
    const baseDir = path.join(homeDir, '.deputydev', 'logs');

    const pidFolderPrefix = `pid_${pid}_`;
    const pidFolder = fs.readdirSync(baseDir).find(folder =>
      folder.startsWith(pidFolderPrefix)
    );

    if (!pidFolder) {
      return;
    }

    const logDir = path.join(baseDir, pidFolder);
    const today = new Date().toISOString().slice(0, 10);
    const logFilePath = path.join(logDir, today, 'debug.log');

    if (!fs.existsSync(logFilePath)) {
      return;
    }

    const logContent = fs.readFileSync(logFilePath, 'utf-8');

    const doc = await vscode.workspace.openTextDocument({
      language: 'log',
      content: logContent
    });

    await vscode.window.showTextDocument(doc, { preview: false });
  }
}
