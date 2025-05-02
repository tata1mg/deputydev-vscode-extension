import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';

export class Logger {
  private logFilePath: string;
  private debugMode: boolean;
  private currentDate: string;
  private pidDirPath: string;

  constructor() {
    this.debugMode = true;
    const homeDir = os.homedir();
    const baseDir = path.join(homeDir, '.deputydev', 'logs');
    const pid = process.pid.toString();

    this.currentDate = new Date().toISOString().slice(0, 10);
    this.pidDirPath = path.join(baseDir, `pid_${pid}`);
    const logDir = path.join(this.pidDirPath, this.currentDate);

    fs.mkdirSync(logDir, { recursive: true });
    this.logFilePath = path.join(logDir, 'debug.log');

    console.log('DeputyDev debug logs filepath is:', this.logFilePath);
  }

  deleteLogsOlderThan(days: number) {
    const baseDir = path.join(os.homedir(), '.deputydev', 'logs');
    const now = Date.now();

    if (!fs.existsSync(baseDir)) return;

    fs.readdirSync(baseDir).forEach((folder) => {
      const fullPath = path.join(baseDir, folder);
      if (!fs.statSync(fullPath).isDirectory()) return;

      try {
        const stats = fs.statSync(fullPath);
        const ageInDays = (now - stats.ctime.getTime()) / (1000 * 60 * 60 * 24);
        if (ageInDays > days) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        }
      } catch (err) {
        // fail silently
      }
    });
  }

  private rotateLogIfNeeded() {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.currentDate) {
      this.currentDate = today;
      const logDir = path.join(this.pidDirPath, this.currentDate);
      fs.mkdirSync(logDir, { recursive: true });
      this.logFilePath = path.join(logDir, 'debug.log');
    }
  }

  private formatArgs(level: string, args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.map((arg) => {
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

    this.rotateLogIfNeeded();
    const formatted = this.formatArgs(level, args);

    try {
      fs.appendFileSync(this.logFilePath, formatted, 'utf8');
    } catch {
      // silently fail
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
    const pidFolder = `pid_${pid}`;
    const logDir = path.join(baseDir, pidFolder);
    const today = new Date().toISOString().slice(0, 10);
    const logFilePath = path.join(logDir, today, 'debug.log');

    if (!fs.existsSync(logFilePath)) {
      vscode.window.showWarningMessage(`No log file found for today in: ${logFilePath}`);
      return;
    }

    const doc = await vscode.workspace.openTextDocument(logFilePath);
    await vscode.window.showTextDocument(doc, { preview: false });
  }
}
