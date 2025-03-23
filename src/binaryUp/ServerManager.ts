import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { binaryApi } from '../services/api/axios'; 
import { API_ENDPOINTS } from '../services/api/endpoints';
import * as tar from 'tar';
import { ConfigManager } from '../utilities/ConfigManager';
import * as crypto from 'crypto';
import { REGISTRY_FILE, setBinaryInfo } from './BinaryPort';
import axios from 'axios';
import { spawn, SpawnOptions, ChildProcess } from 'child_process';
export let port_no : number = 0;
import * as os from 'os';
// const AdmZip = require('adm-zip') as typeof import('adm-zip');

export class ServerManager {
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private configManager: ConfigManager;
    private essential_config: any;
    private binaryPath_root: string;
    private binaryPath: string;

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel, configManager: ConfigManager) {
        this.context = context;
        this.outputChannel = outputChannel;
        this.configManager = configManager;
        this.essential_config = this.configManager.getAllConfigEssentials();
        this.binaryPath_root = path.join(this.context.globalStorageUri.fsPath, 'binary'); // root Path to extracted dir
        this.binaryPath = path.join(
            this.binaryPath_root,
            this.essential_config["BINARY"]["directory"]
        );
            }
        



    /** Check if the binary already exists */
    private isBinaryAvailable(): boolean {
        const servicePath = this.getServiceExecutablePath();
        this.outputChannel.appendLine(`Checking for binary at: ${servicePath}`);
        return fs.existsSync(servicePath);
    }

    /** Ensure the binary exists and is extracted */
    public async ensureBinaryExists(): Promise<boolean> {
        if (this.isBinaryAvailable()) {
            this.outputChannel.appendLine('Server binary already exists.');
            return true;
        }

        this.outputChannel.appendLine('Binary not found. Downloading and extracting...');
        return await this.downloadAndExtractBinary();
    }

    /** Download and extract the binary */
    private async downloadAndExtractBinary(): Promise<boolean> {
        const fileUrl = this.essential_config["BINARY"]["download_link"];
        if (!fileUrl) {
            vscode.window.showErrorMessage(`Unsupported platform, no binary download link found from essential confi .`);
            return false;
        }

        try {
            const fileName = path.basename(fileUrl);
            const downloadPath = path.join(this.binaryPath, fileName);

            await this.downloadFile(fileUrl, downloadPath);
            this.outputChannel.appendLine('Downloaded binary.');
            await this.decryptAndExtract(downloadPath, this.binaryPath);
            vscode.window.showInformationMessage('Server binary downloaded and extracted successfully.');
            return true;
        } catch (err) {
            vscode.window.showErrorMessage(`Error downloading/extracting binary: ${err}`);
            return false;
        }
    }

    /** Download the file from the URL */
    /**
     * Download a file from the given URL and save it to the specified output path.
     * Logs the status of the download process to the output channel.
     * 
     * @param url - The URL to download the file from.
     * @param outputPath - The path where the downloaded file will be saved.
     */
    private async downloadFile(url: string, outputPath: string): Promise<void> {
        this.outputChannel.appendLine(`Starting download from ${url} to ${outputPath}`);

        // Make sure the directory exists
        const dir = path.dirname(outputPath);
        // Make sure the directory exists or is cleaned
        if (fs.existsSync(dir)) {
            if (fs.existsSync(this.binaryPath_root)) {
                fs.rmSync(this.binaryPath_root, { recursive: true, force: true });
                this.outputChannel.appendLine(`Deleted existing binaryPath_root: ${this.binaryPath_root}`);
            }
        }

        // Create the directory again (in case it was deleted)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            this.outputChannel.appendLine(`Created directory: ${dir}`);
        }
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(outputPath);
            let hasError = false;

            const request = https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    this.outputChannel.appendLine(`Failed to download file. HTTP Status: ${response.statusCode}`);
                    return reject(`HTTP ${response.statusCode}`);
                }

                this.outputChannel.appendLine('Download in progress...');
                response.pipe(file);

                response.on('end', () => {
                    this.outputChannel.appendLine('Download stream ended.');
                });

                file.on('finish', () => {
                    if (!hasError) {
                        file.close(() => {
                            this.outputChannel.appendLine('Download completed successfully.');
                            resolve();
                        });
                    }
                });
            });

            request.on('error', (err) => {
                hasError = true;
                fs.unlink(outputPath, () => { }); // Delete incomplete file
                this.outputChannel.appendLine(`Error during download: ${err.message}`);
                reject(err.message);
            });

            file.on('error', (err) => {
                hasError = true;
                fs.unlink(outputPath, () => { }); // Delete incomplete file
                this.outputChannel.appendLine(`File stream error: ${err.message}`);
                reject(err.message);
            });
        });
    }

/** Extract a tar file */
private async decryptAndExtract(encPath: string, extractTo: string): Promise<void> {
    const tempTarPath = path.join(extractTo, 'binary.tar.gz');
    const password = this.essential_config["BINARY"]["password"];
    const keyHex = this.essential_config["BINARY"]["keyHex"]; 
    const ivHex = this.essential_config["BINARY"]["IVHex"];
    if (!password) {
        vscode.window.showErrorMessage('No password found in config.');
        return;
    }




    const key = Buffer.from(keyHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const input = fs.createReadStream(encPath);
    const output = fs.createWriteStream(tempTarPath);

    this.outputChannel.appendLine('Decrypting with fixed key/iv (no salt)...');

    await new Promise<void>((resolve, reject) => {
        input.pipe(decipher).pipe(output)
            .on('finish', () => {
                this.outputChannel.appendLine('Decryption complete.');
                resolve();
            })
            .on('error', reject);
    });

    this.outputChannel.appendLine(`Extracting to ${extractTo}...`);
    try {
        await tar.x({ file: tempTarPath, cwd: extractTo });
        this.outputChannel.appendLine('Extraction complete.');

        const binaryPath = path.join(this.binaryPath_root, this.essential_config["BINARY"]["service_path"] ); // or your actual binary name
        fs.chmodSync(binaryPath, 0o755);
        this.outputChannel.appendLine(`Set executable permission on: ${binaryPath}`);

        fs.unlinkSync(encPath);
        fs.unlinkSync(tempTarPath);
        this.outputChannel.appendLine(`Cleaned up: ${encPath}, ${tempTarPath}`);
    } catch (err) {
        this.outputChannel.appendLine(`Extraction failed: ${err}`);
        throw err;
    }
}

    




    /** Check if the port is available */
    private async isPortAvailable(port: number): Promise<boolean> {
        const net = await import('net');
        return new Promise((resolve) => {
            const server = net.createServer();
            server.unref();
            server.on('error', () => resolve(false));
            server.listen(port, () => {
                server.close(() => resolve(true));
            });
        });
    }

    private async findAvailablePort([min, max]: number[]): Promise<number | null> {
        const maxAttempts = 20;

        for (let i = 0; i < maxAttempts; i++) {
            const port = Math.floor(Math.random() * (max - min + 1)) + min;
            if (await this.isPortAvailable(port)) {
                this.outputChannel.appendLine(`🔎 Found available port: ${port}`);
                return port;
            }
        }

        return null;
    }


    private async tryReuseExistingServer(): Promise<boolean> {
        if (!fs.existsSync(REGISTRY_FILE)) return false;

        try {
            const content = fs.readFileSync(REGISTRY_FILE, 'utf-8');
            const registry = JSON.parse(content);
            const existingPort = registry?.binary?.port;

            if (!existingPort) return false;

            const response = await axios.get('http://localhost:' + existingPort + API_ENDPOINTS.PING);
            if (response?.status === 200) {
                vscode.window.showInformationMessage('Server is already running.');
                this.outputChannel.appendLine(`🔄 Reusing running server at port ${existingPort}`);
                port_no = existingPort;
                return true;
            }
        } catch (err) {
            this.outputChannel.appendLine(`⚠️ Failed to ping existing server. Will launch new one. Error: ${err}`);
        }

        return false;
    }


    // Utility to get a random port from a range
    getRandomPortInRange(range: number[]): number {
        const [min, max] = range;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }


    /** Start the server */
    public async startServer(): Promise<void> {
        this.outputChannel.appendLine('Sthe registry file path is ');
        this.outputChannel.appendLine(REGISTRY_FILE);
        const serviceExecutable = this.getServiceExecutablePath();
        const portRange: number[] | undefined = this.essential_config?.["BINARY"]?.["port_range"];
        this.outputChannel.appendLine(`Starting server with binary: ${serviceExecutable}`);
        this.outputChannel.appendLine(`Port range: ${portRange}`);
        if (!serviceExecutable || !fs.existsSync(serviceExecutable)) {
            vscode.window.showErrorMessage('Server binary not found.');
            this.outputChannel.appendLine('❌ Server binary not found at path: ' + serviceExecutable);
            return;
        }

        if (!portRange || portRange.length !== 2) {
            vscode.window.showErrorMessage('Invalid or missing port range in config.');
            this.outputChannel.appendLine('❌ Missing or invalid port range in config.');
            return;
        }

        try {
            const reused = await this.tryReuseExistingServer();
            if (reused) {
                this.outputChannel.appendLine('✅ Reused existing running server.');
                return;
            }

            const port = await this.findAvailablePort(portRange);
            if (!port) {
                vscode.window.showErrorMessage('No available port found to start server.');
                this.outputChannel.appendLine('❌ No available port found in range.');
                return;
            }
            port_no = port;
            this.outputChannel.appendLine(`🚀 Starting server: ${serviceExecutable} ${port}`);
            
            let spawnOptions: SpawnOptions;
            
            const command = `nohup "${serviceExecutable}" ${port} > /dev/null 2>&1 < /dev/null &`;

            const serverProcess = spawn('sh', ['-c', command], {
              detached: true,
              stdio: 'ignore',
            });
            serverProcess.unref();
            
            


            serverProcess.stdout?.on('data', (data) => this.outputChannel.appendLine(`Server: ${data}`));
            serverProcess.stderr?.on('data', (data) => this.outputChannel.appendLine(`Server Error: ${data}`));
            // Write to registry before launching
            if (serverProcess.pid !== undefined) {
                setBinaryInfo(port, serverProcess.pid);
            } else {
                setBinaryInfo(port);
                this.outputChannel.appendLine('❌ Failed to retrieve server process PID just saving pid.');
            }

            await this.delay(1000); // Let it warm up

            const serverStarted = await this.waitForServer(port);
            if (serverStarted) {
                vscode.window.showInformationMessage('Server started successfully!');
                this.outputChannel.appendLine('✅ Server started successfully!');
            } else {
                vscode.window.showErrorMessage('Server failed to start.');
                this.outputChannel.appendLine('❌ Server failed to respond after launch.');
            }

        } catch (err) {
            this.outputChannel.appendLine(`❌ Exception during server startup: ${err}`);
            vscode.window.showErrorMessage('Error starting the server.');
        }
    }


    /** Build path to service executable */
    private getServiceExecutablePath(): string {
        const service_path = this.essential_config["BINARY"]["service_path"];
        return path.join(this.binaryPath_root, service_path);
    }

    /** Delay utility */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /** Poll /ping endpoint until server responds */
    private async waitForServer(port:number): Promise<boolean> {
        const maxAttempts = 150;
        let attempt = 0;

        while (attempt < maxAttempts) {
            try {
                const response = await axios.get('http://localhost:' + port + API_ENDPOINTS.PING);
                if (response.status === 200) {
                    this.outputChannel.appendLine('Server is running.');
                    return true;
                }
            } catch (error) {
                this.outputChannel.appendLine(`Ping attempt ${attempt + 1} failed. Retrying...`);
            }
            attempt++;
            await this.delay(1000);
        }

        return false;
    }
}


