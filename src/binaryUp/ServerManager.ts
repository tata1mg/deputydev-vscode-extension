import axios from 'axios';
import { spawn, SpawnOptions } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { createReadStream, promises as fsp } from 'fs';
import * as https from 'https';
import * as net from 'node:net';
import * as path from 'path';
import * as tar from 'tar';
import * as vscode from 'vscode';
import { getBinaryPort, MAX_PORT_ATTEMPTS, setBinaryPort } from '../config';
import { API_ENDPOINTS } from '../services/api/endpoints';
import { ConfigManager } from '../utilities/ConfigManager';
import { loaderMessage } from '../utilities/contextManager';
import { Logger } from '../utilities/Logger';
import { pipeline as streamPipeline } from 'stream/promises';
import * as child_process from 'child_process';

export class ServerManager {
  private readonly context: vscode.ExtensionContext;
  private readonly outputChannel: vscode.OutputChannel;
  private readonly logger: Logger;
  private readonly configManager: ConfigManager;
  private readonly essential_config: any;
  private readonly binaryPath_root: string;
  private readonly binaryPath: string;
  private currentPort: number | null = null;

  constructor(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel,
    logger: Logger,
    configManager: ConfigManager,
  ) {
    this.context = context;
    this.outputChannel = outputChannel;
    this.logger = logger;
    this.configManager = configManager;
    this.essential_config = this.configManager.getAllConfigEssentials();
    this.binaryPath_root = path.join(this.context.globalStorageUri.fsPath, 'binary'); // root Path to extracted dir
    this.outputChannel.appendLine(`Binary root path: ${this.binaryPath_root}`);
    this.binaryPath = path.join(this.binaryPath_root, this.essential_config['BINARY']['directory']);
  }

  /** Utility */
  private async pathExists(p: string): Promise<boolean> {
    try {
      await fsp.access(p);
      return true;
    } catch {
      return false;
    }
  }

  private hmacSha256File(filePath: string, secretKey: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hmac = crypto.createHmac('sha256', secretKey);
      const stream = fs.createReadStream(filePath);

      stream.on('data', (chunk) => hmac.update(chunk));
      stream.on('end', () => resolve(hmac.digest('hex')));
      stream.on('error', reject);
    });
  }

  private tarAppUncompressed(appPath: string, outputTarPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const baseName = path.basename(appPath);
      const dirName = path.dirname(appPath);
      // Deterministic tar: sorted files, neutral ownership. On macOS (BSD tar), --uid/--gid supported, --sort/--mtime not available.
      // Use find + sort for sorted inclusion.
      const cmd = `cd "${dirName}" && find "${baseName}" -type f | sort | tar -cf "${outputTarPath}" --uid=0 --gid=0 -T -`;
      child_process.exec(cmd, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(outputTarPath);
      });
    });
  }

  private async recursivelyHashPath(
    targetPath: string,
    secretKey: string,
    relativeTo: string = targetPath,
  ): Promise<crypto.Hmac> {
    const hmac = crypto.createHmac('sha256', secretKey);
    const queue: string[] = [targetPath];

    while (queue.length) {
      const current = queue.pop()!;
      const stat = fs.statSync(current);
      const relPath = path.relative(relativeTo, current);
      if (stat.isDirectory()) {
        const entries = fs.readdirSync(current).sort();
        for (const entry of entries.reverse()) {
          queue.push(path.join(current, entry));
        }
        hmac.update('DIR:' + relPath);
      } else if (stat.isFile()) {
        hmac.update('FILE:' + relPath);
        const fileBuffer = fs.readFileSync(current);
        hmac.update(fileBuffer);
      }
    }
    return hmac;
  }

  private async getChecksumForBinaryFile(binaryFilePath: string, secretKey: string): Promise<string> {
    try {
      const hmac = await this.recursivelyHashPath(binaryFilePath, secretKey);
      return hmac.digest('hex');
    } catch (err) {
      console.error('Error:', err);
      return '';
    }
  }

  private async isBinaryAvailable(): Promise<boolean> {
    const binaryFilePath = this.getBinaryFilePath();
    this.outputChannel.appendLine(`Checking for binary at: ${binaryFilePath}`);
    const exists = await this.pathExists(binaryFilePath);
    if (!exists) {
      this.outputChannel.appendLine('Binary file does not exist.');
      return false;
    }
    // Checksum verification
    const expectedChecksum = this.getBinaryFileChecksum();
    this.outputChannel.appendLine(`Expected checksum: ${expectedChecksum}`);
    this.outputChannel.appendLine(`Calculating checksum for binary file...`);
    const actualChecksum = await this.getChecksumForBinaryFile(
      binaryFilePath,
      this.essential_config['BINARY']['password'],
    );
    this.outputChannel.appendLine(`Actual checksum: ${actualChecksum}`);
    if (actualChecksum !== expectedChecksum) {
      this.outputChannel.appendLine(`Checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`);
      return false;
    }
    this.outputChannel.appendLine('Checksum verification succeeded.');
    return true;
  }

  /** Ensure the binary exists and is extracted */
  public async ensureBinaryExists(): Promise<boolean> {
    if (await this.isBinaryAvailable()) {
      this.outputChannel.appendLine('Server binary already exists.');
      return true;
    }

    this.logger.warn(`Binary not found or corrupted. Downloading and extracting...`);
    this.outputChannel.appendLine('Binary not found or corrupted. Downloading and extracting...');
    return await this.downloadAndExtractBinary();
  }

  /** Download and extract the binary */
  private async downloadAndExtractBinary(): Promise<boolean> {
    const fileUrl = this.essential_config['BINARY']['download_link'];
    if (!fileUrl) {
      this.logger.error(`Unsupported platform, no binary download link found from essential config.`);
      vscode.window.showErrorMessage(`Unsupported platform, no binary download link found from essential config.`);
      return false;
    }

    try {
      const urlObj = new URL(fileUrl);
      const fileName = path.basename(urlObj.pathname);
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

    // Always delete this.binaryPath_root and its contents (non‑blocking)
    await fsp.rm(this.binaryPath_root, { recursive: true, force: true }).catch(() => {});
    this.logger.info(`Deleted existing BinaryPath`);

    // Ensure the directory for the output path exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      this.outputChannel.appendLine(`Created directory: ${dir}`);
    }

    await new Promise<void>((resolve, reject) => {
      https
        .get(url, async (response) => {
          if (response.statusCode !== 200 || !response.readable) {
            this.logger.error(`Failed to download file. HTTP Status: ${response.statusCode}`);
            this.outputChannel.appendLine(`❌ Failed to download file. HTTP Status: ${response.statusCode}`);
            return reject(`HTTP ${response.statusCode}`);
          }
          loaderMessage(true);
          this.logger.info(`Download started`);
          this.outputChannel.appendLine('Download in progress...');

          const fileStream = fs.createWriteStream(outputPath);
          try {
            await streamPipeline(response, fileStream);
            this.outputChannel.appendLine('Download completed successfully.');
            resolve();
          } catch (err) {
            await fsp.unlink(outputPath).catch(() => {});
            this.outputChannel.appendLine(`Error during download: ${err}`);
            this.logger.error(`Error during download: ${err}`);
            reject(err);
          }
        })
        .on('error', reject);
    });
  }

  /** Decrypt and extract a tar.gz using streaming pipeline */
  private async decryptAndExtract(encPath: string, extractTo: string): Promise<void> {
    const password = this.essential_config['BINARY']['password'];
    const SALT_LENGTH = 16;
    const IV_LENGTH = 16;
    const KEY_LENGTH = 32;
    const HMAC_LENGTH = 32;
    const ITERATIONS = 100_000;

    // Read header + footer only
    const fd = await fsp.open(encPath, 'r');
    const headerBuf = Buffer.alloc(SALT_LENGTH + IV_LENGTH);
    await fd.read(headerBuf, 0, headerBuf.length, 0);

    const stats = await fd.stat();
    const tailPos = stats.size - HMAC_LENGTH;
    const hmacBuf = Buffer.alloc(HMAC_LENGTH);
    await fd.read(hmacBuf, 0, HMAC_LENGTH, tailPos);
    await fd.close();

    const salt = headerBuf.subarray(0, SALT_LENGTH);
    const iv = headerBuf.subarray(SALT_LENGTH);
    const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');

    const expectedHmac = hmacBuf;
    const hmac = crypto.createHmac('sha256', key);

    await fsp.mkdir(extractTo, { recursive: true });

    const cipherStream = createReadStream(encPath, {
      start: SALT_LENGTH + IV_LENGTH,
      end: tailPos - 1, // exclude HMAC footer
    });

    cipherStream.on('data', (chunk) => hmac.update(chunk));

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    await streamPipeline(cipherStream, decipher, tar.x({ cwd: extractTo }));

    // Verify HMAC after stream finished
    const calculatedHmac = hmac.digest();
    if (!crypto.timingSafeEqual(calculatedHmac, expectedHmac)) {
      vscode.window.showErrorMessage('Decryption failed: HMAC does not match. File may be tampered.');
      this.logger.error('HMAC verification failed. File may be tampered.');
      throw new Error('HMAC verification failed. File may be tampered.');
    }

    // set executable permissions
    const binaryPath = path.join(this.binaryPath_root, this.essential_config['BINARY']['service_path']);
    await fsp.chmod(binaryPath, 0o755);

    // cleanup
    await fsp.unlink(encPath).catch(() => {});
    this.outputChannel.appendLine(`✅ Decrypt and extract completed successfully.`);
  }
  /** Check if the port is available */
  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.unref();
      server.on('error', () => resolve(false));
      server.listen(port, () => {
        server.close(() => resolve(true));
      });
    });
  }

  private async findAvailablePort([min, max]: [number, number]): Promise<number | null> {
    for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
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
        // vscode.window.showInformationMessage('Server is already running.');
        this.logger.info(`Reusing running local server at port ${existingPort}`);
        this.outputChannel.appendLine(`🔄 Reusing running server at port ${existingPort}`);
        setBinaryPort(existingPort);
        this.currentPort = existingPort;
        return true;
      }
    } catch (err) {
      this.logger.warn('Failed to ping existing local server. Will launch new one.');
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
    loaderMessage(true);
    // loaderMessage('Starting server...');
    this.outputChannel.appendLine('Sthe registry file path is ');
    const serviceExecutable = this.getServiceExecutablePath();
    const portRange: [number, number] | undefined = this.essential_config?.['BINARY']?.['port_range'];
    this.outputChannel.appendLine(`Starting server with binary: ${serviceExecutable}`);
    this.outputChannel.appendLine(`Port range: ${portRange}`);
    if (!serviceExecutable || !fs.existsSync(serviceExecutable)) {
      this.logger.error('Server binary not found.');
      this.outputChannel.appendLine('❌ Server binary not found at path: ' + serviceExecutable);
      return false;
    }

    if (!portRange || portRange.length !== 2) {
      this.outputChannel.appendLine('❌ Missing or invalid port range in config.');
      return false;
    }

    try {
      const reused = await this.tryReuseExistingServer();
      if (reused) {
        this.outputChannel.appendLine('✅ Reused existing running server.');
        return true;
      }

      const port = await this.findAvailablePort(portRange);
      if (!port) {
        // vscode.window.showErrorMessage('No available port found to start server.');
        this.logger.error('No available port found to start server.');
        this.outputChannel.appendLine('❌ No available port found in range.');
        return false;
      }
      setBinaryPort(port);
      this.currentPort = port;
      this.logger.info(`Starting server on port: ${port}`);
      this.outputChannel.appendLine(`🚀 Starting server: ${serviceExecutable} ${port}`);

      const spawnOptions: SpawnOptions = {
        stdio: ['ignore', 'pipe', 'pipe'], // Use 'pipe' for stdout and stderr to capture output
        detached: false, // Important: this keeps child tied to parent
        shell: false, // Don't launch via shell
      };

      const serverProcess = spawn(serviceExecutable, [port.toString()], spawnOptions);

      serverProcess.stdout?.on('data', (data) => this.outputChannel.appendLine(`Server: ${data}`));
      serverProcess.stderr?.on('data', (data) => this.outputChannel.appendLine(`Server Error: ${data}`));

      // logger to logs/
      serverProcess.stdout?.on('data', (data) => this.logger.info(`Server: ${data}`));
      serverProcess.stderr?.on('data', (data) => this.logger.error(`Server Error: ${data}`));
      // Write to registry before launching
      if (serverProcess.pid == undefined) {
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
    const service_path = this.essential_config['BINARY']['service_path'];
    return path.join(this.binaryPath_root, service_path);
  }

  private getBinaryFilePath(): string {
    return path.join(this.binaryPath_root, this.essential_config['BINARY']['file_path']);
  }

  private getBinaryFileChecksum(): string {
    return this.essential_config['BINARY']['file_checksum'];
  }

  /** Delay utility */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Poll /ping endpoint until server responds */
  private async waitForServer(port: number): Promise<boolean> {
    const maxAttempts = this.essential_config['BINARY']['max_init_retry'];
    this.outputChannel.appendLine(`🔄 Waiting for server to respond on port ${port}...`);
    // hlog max attempts

    this.outputChannel.appendLine(`Max attempts: ${maxAttempts}`);
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
        this.logger.error(`Ping attempt ${attempt + 1} failed. Error: ${error}, retrying `);
        this.outputChannel.appendLine('the port no we used for ping is (error) ' + port);
        this.outputChannel.appendLine(`Ping attempt ${attempt + 1} failed. Error: ${error}`);
        // this.outputChannel.appendLine(`Ping attempt ${attempt + 1} failed. Retrying...`);
      }
      attempt++;
      await this.delay(1000);
    }

    return false;
  }
  public getCurrentPort(): number | null {
    return this.currentPort;
  }
}
