import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import * as vscode from 'vscode';
import { API_ENDPOINTS } from '../services/api/endpoints';
import * as tar from 'tar';
import { ConfigManager } from '../utilities/ConfigManager';
import * as crypto from 'crypto';
import axios from 'axios';
import { spawn, SpawnOptions } from 'child_process';
import { MAX_PORT_ATTEMPTS, getBinaryPort , setBinaryPort } from '../config';
import { Logger } from '../utilities/Logger';
// const AdmZip = require('adm-zip') as typeof import('adm-zip');
let BINARY_PORT: number | null = null;
export class ServerManager {
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private logger: Logger;
    private configManager: ConfigManager;
    private essential_config: any;
    private binaryPath_root: string;
    private binaryPath: string;

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel, logger: Logger , configManager: ConfigManager) {
        this.context = context;
        this.outputChannel = outputChannel;
        this.logger = logger;
        this.configManager = configManager;
        this.essential_config = this.configManager.getAllConfigEssentials();
        this.binaryPath_root = path.join(this.context.globalStorageUri.fsPath, 'binary'); // root Path to extracted dir
        this.outputChannel.appendLine(`Binary root path: ${this.binaryPath_root}`);
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
        this.logger.warn(`Binary not found. Downloading and extracting...`);
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
            this.logger.info(`Downloaded binary`);
            this.outputChannel.appendLine('Downloaded binary.');
            await this.decryptAndExtract(downloadPath, this.binaryPath);
            this.logger.info(`Extracted binary`);
            return true;
        } catch (err) {
            this.outputChannel.appendLine(`Error downloading/extracting binary: ${err}`);
            this.logger.error(`Error downloading/extracting binary: ${err}`);
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


        // Always delete this.binaryPath_root and its contents
        if (fs.existsSync(this.binaryPath_root)) {
            fs.rmSync(this.binaryPath_root, { recursive: true, force: true });
            this.outputChannel.appendLine(`Deleted existing binaryPath_root: ${this.binaryPath_root}`);
        }


         // Ensure the directory for the output path exists
        const dir = path.dirname(outputPath);
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
                this.logger.info(`Download started`);
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
    const SALT_LENGTH = 16;
    const IV_LENGTH = 16;
    const KEY_LENGTH = 32;
    const HMAC_LENGTH = 32;
    const ITERATIONS = 100000;

    this.outputChannel.appendLine(`Starting decryption of: ${encPath}`);
    this.outputChannel.appendLine(`Will extract to: ${extractTo}`);
    this.outputChannel.appendLine(`Temporary tar path: ${tempTarPath}`);

    const inputBuffer = fs.readFileSync(encPath);
    this.outputChannel.appendLine(`Read encrypted file. Total size: ${inputBuffer.length} bytes`);

    const salt = inputBuffer.subarray(0, SALT_LENGTH);
    const iv = inputBuffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const ciphertext = inputBuffer.subarray(SALT_LENGTH + IV_LENGTH, inputBuffer.length - HMAC_LENGTH);
    const receivedHmac = inputBuffer.subarray(-HMAC_LENGTH);

    this.outputChannel.appendLine(`Parsed salt (${SALT_LENGTH} bytes), IV (${IV_LENGTH} bytes), ciphertext (${ciphertext.length} bytes), HMAC (${HMAC_LENGTH} bytes)`);

    this.outputChannel.appendLine(`Deriving key using PBKDF2...`);
    const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
    this.outputChannel.appendLine(`Key derivation complete.`);

    this.outputChannel.appendLine(`Verifying HMAC...`);
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(ciphertext);
    const expectedHmac = hmac.digest();

    if (!crypto.timingSafeEqual(receivedHmac, expectedHmac)) {
        vscode.window.showErrorMessage('Decryption failed: HMAC does not match. File may be tampered.');
        this.outputChannel.appendLine('HMAC verification failed. Aborting decryption.');
        return;
    }
    this.outputChannel.appendLine('HMAC verified successfully.');

    this.outputChannel.appendLine('Decrypting ciphertext...');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
    ]);
    this.outputChannel.appendLine(`Decryption complete. Decrypted size: ${decrypted.length} bytes`);

    this.outputChannel.appendLine(`Writing decrypted tar to: ${tempTarPath}`);
    fs.writeFileSync(tempTarPath, decrypted);
    this.outputChannel.appendLine('Decrypted tar file written.');

    this.outputChannel.appendLine(`Starting extraction of tar file to: ${extractTo}`);
    try {
        await tar.x({ file: tempTarPath, cwd: extractTo });
        this.outputChannel.appendLine('Extraction complete.');

        const binaryPath = path.join(this.binaryPath_root, this.essential_config["BINARY"]["service_path"]);
        this.outputChannel.appendLine(`Setting executable permission on: ${binaryPath}`);
        fs.chmodSync(binaryPath, 0o755);
        this.outputChannel.appendLine(`Executable permission set.`);

        this.outputChannel.appendLine(`Cleaning up: ${encPath}`);
        fs.unlinkSync(encPath);
        this.outputChannel.appendLine(`Deleted: ${encPath}`);

        this.outputChannel.appendLine(`Cleaning up: ${tempTarPath}`);
        fs.unlinkSync(tempTarPath);
        this.outputChannel.appendLine(`Deleted: ${tempTarPath}`);

        this.outputChannel.appendLine(`✅ Decrypt and extract completed successfully.`);
    } catch (err) {
        this.outputChannel.appendLine(`❌ Extraction failed: ${err}`);
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
        const maxAttempts = MAX_PORT_ATTEMPTS;

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
        try {
            const existingPort = getBinaryPort();

            if (!existingPort) return false;

            const response = await axios.get('http://localhost:' + existingPort + API_ENDPOINTS.PING);
            if (response?.status === 200) {
                vscode.window.showInformationMessage('Server is already running.');
                this.logger.info(`Reusing running local server at port ${existingPort}`);
                this.outputChannel.appendLine(`🔄 Reusing running server at port ${existingPort}`);
                setBinaryPort(existingPort);
                return true;
            }
        } catch (err) {
            this.logger.warn("Failed to ping existing local server. Will launch new one.");
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
    public async startServer(): Promise<boolean> {
        this.outputChannel.appendLine('Sthe registry file path is ');
        const serviceExecutable = this.getServiceExecutablePath();
        const portRange: number[] | undefined = this.essential_config?.["BINARY"]?.["port_range"];
        this.outputChannel.appendLine(`Starting server with binary: ${serviceExecutable}`);
        this.outputChannel.appendLine(`Port range: ${portRange}`);
        if (!serviceExecutable || !fs.existsSync(serviceExecutable)) {
            vscode.window.showErrorMessage('Server binary not found.');
            this.outputChannel.appendLine('❌ Server binary not found at path: ' + serviceExecutable);
            return false;;
        }

        if (!portRange || portRange.length !== 2) {
            vscode.window.showErrorMessage('Invalid or missing port range in config.');
            this.outputChannel.appendLine('❌ Missing or invalid port range in config.');
            return false;
        }

        try {
            const reused = await this.tryReuseExistingServer();
            if (reused) {
                this.outputChannel.appendLine('✅ Reused existing running server.');
                return true
            }

            const port = await this.findAvailablePort(portRange);
            if (!port) {
                vscode.window.showErrorMessage('No available port found to start server.');
                this.outputChannel.appendLine('❌ No available port found in range.');
                return false;
            }
            setBinaryPort(port);
            this.logger.info(`Starting server on port: ${port}`);
            this.outputChannel.appendLine(`🚀 Starting server: ${serviceExecutable} ${port}`);
            
            const spawnOptions: SpawnOptions = {
                stdio: ['ignore', 'pipe', 'pipe','inherit'],
                detached: false,                   // Important: this keeps child tied to parent
                shell: false                       // Don't launch via shell
              };
              
            const serverProcess =  spawn(serviceExecutable, [port.toString()], spawnOptions);              

            serverProcess.stdout?.on('data', (data) => this.outputChannel.appendLine(`Server: ${data}`));
            serverProcess.stderr?.on('data', (data) => this.outputChannel.appendLine(`Server Error: ${data}`));
            // Write to registry before launching
            if (serverProcess.pid !== undefined) {
            } else {
                this.outputChannel.appendLine('❌ Failed to retrieve server process PID just saving pid.');
            }

            await this.delay(1000); // Let it warm up

            const serverStarted = await this.waitForServer(port);
            if (serverStarted) {
                this.logger.info('Server started successfully.');
                // vscode.window.showInformationMessage('Server started successfully!');
                this.outputChannel.appendLine('✅ Server started successfully!');
                return true;
            } else {
                vscode.window.showErrorMessage('Server failed to start.');
                this.outputChannel.appendLine('❌ Server failed to respond after launch.');
                return false;
            }

        } catch (err) {
            this.outputChannel.appendLine(`❌ Exception during server startup: ${err}`);
            vscode.window.showErrorMessage('Error starting the server.');
            return false;
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
        const maxAttempts = this.essential_config["BINARY"]["max_init_retry"];
        this.outputChannel.appendLine(`🔄 Waiting for server to respond on port ${port}...`)
        // hlog max attempts

        this.outputChannel.appendLine(`Max attempts: ${maxAttempts}`)
        let attempt = 0;

        while (attempt < maxAttempts) {
            try {
                const response = await axios.get('http://localhost:' + port + API_ENDPOINTS.PING);
                if (response.status === 200) {
                    this.logger.info('Server is running.');
                    this.outputChannel.appendLine('Server is running.');
                    return true;
                }
            } catch (error) {
                this.logger.warn(`Ping attempt ${attempt + 1} failed. Retrying...`);
                this.outputChannel.appendLine(`Ping attempt ${attempt + 1} failed. Retrying...`);
            }
            attempt++;
            await this.delay(1000);
        }

        return false;
    }
}


