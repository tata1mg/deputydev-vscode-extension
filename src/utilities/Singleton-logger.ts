import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';

export class SingletonLogger {
  private static _instance: SingletonLogger | null = null;

  private logFilePath: string;
  private debugMode: boolean;
  private pid: string;
  private currentDate: string;

  private constructor() {
    this.debugMode = true;
    this.pid = process.pid.toString();
    this.currentDate = new Date().toISOString().slice(0, 10);
    this.logFilePath = this.getLogFilePath(this.currentDate);
    console.log('DeputyDev (singleton) debug logs filepath is:', this.logFilePath);
  }

  public static getInstance(): SingletonLogger {
    if (!SingletonLogger._instance) {
      SingletonLogger._instance = new SingletonLogger();
    }
    return SingletonLogger._instance;
  }

  private getLogFilePath(date: string): string {
    const homeDir = os.homedir();
    const baseDir = path.join(homeDir, '.deputydev', 'logs');
    const pidDir = path.join(baseDir, `pid_${this.pid}`);
    const logDir = path.join(pidDir, date);

    fs.mkdirSync(logDir, { recursive: true });

    return path.join(logDir, 'debug.log');
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

    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.currentDate) {
      this.currentDate = today;
      this.logFilePath = this.getLogFilePath(today); // 🔄 Switch to new day's log
    }

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
    const homeDir = os.homedir();
    const baseDir = path.join(homeDir, '.deputydev', 'logs');
    const pidDir = path.join(baseDir, `pid_${this.pid}`);
    const today = new Date().toISOString().slice(0, 10);
    const logFilePath = path.join(pidDir, today, 'debug.log');

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
