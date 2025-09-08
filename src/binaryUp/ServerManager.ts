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
import { SingletonLogger } from '../utilities/Singleton-logger';
import { pipeline as streamPipeline } from 'stream/promises';
import { withLock } from './withLock';

export class ServerManager {
  private readonly context: vscode.ExtensionContext;
  private readonly outputChannel: vscode.LogOutputChannel;
  private readonly logger: ReturnType<typeof SingletonLogger.getInstance>;
  private readonly configManager: ConfigManager;
  private readonly essential_config: any;
  private readonly binaryPath_root: string;
  private readonly binaryPath: string;
  private currentPort: number | null = null;

  constructor(context: vscode.ExtensionContext, outputChannel: vscode.LogOutputChannel, configManager: ConfigManager) {
    this.context = context;
    this.outputChannel = outputChannel;
    this.logger = SingletonLogger.getInstance();
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

  private async recursivelyHashPath(targetPath: string, relativeTo: string = targetPath): Promise<crypto.Hash> {
    const hash = crypto.createHash('sha256');
    const queue: string[] = [targetPath];

    while (queue.length > 0) {
      const current = queue.pop() as string;
      const stat = fs.statSync(current);
      const relPath = path.relative(relativeTo, current);

      if (stat.isDirectory()) {
        const entries = fs.readdirSync(current).sort().reverse();
        for (const entry of entries) {
          queue.push(path.join(current, entry));
        }
        hash.update(relPath);
      } else if (stat.isFile()) {
        if (/\/\._/.test(relPath)) continue; // Skip AppleDouble files anywhere in the tree
        hash.update(relPath);
        const fileBuffer = fs.readFileSync(current);
        hash.update(fileBuffer);
      }
    }

    return hash;
  }

  public async getChecksumForBinaryFile(binaryFilePath: string): Promise<string> {
    try {
      const hash = await this.recursivelyHashPath(binaryFilePath);
      return hash.digest('hex');
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
    const actualChecksum = await this.getChecksumForBinaryFile(binaryFilePath);
    this.outputChannel.appendLine(`Actual checksum: ${actualChecksum}`);
    if (actualChecksum !== expectedChecksum) {
      this.outputChannel.appendLine(`Checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`);
      return false;
    }
    this.outputChannel.appendLine('Checksum verification succeeded.');
    return true;
  }

  /** Ensure the binary exists and is extracted */
  /** Ensure the binary exists and is extracted – guarded by lock */
  public async ensureBinaryExists(): Promise<boolean> {
    const lockDir = this.context.globalStorageUri.fsPath;
    const lockPath = path.join(lockDir, 'binary.lock');
    // Ensure the parent directory exists
    await fsp.mkdir(lockDir, { recursive: true });
    return await withLock(lockPath, async () => {
      // 🔒 Critical section starts — only one window gets here at a time
      if (await this.isBinaryAvailable()) {
        this.outputChannel.appendLine('Server binary already exists.');
        return true;
      }

      this.logger.warn(`Binary not found or corrupted. Downloading and extracting...`);
      this.outputChannel.appendLine('Binary not found or corrupted. Downloading and extracting...');
      return await this.downloadAndExtractBinary();
    });
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
      await this.extractTarGz(downloadPath, this.binaryPath);
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
          const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
          if (response.statusCode !== 200 || !response.readable) {
            this.logger.error(`Failed to download file. HTTP Status: ${response.statusCode}`);
            this.outputChannel.appendLine(`❌ Failed to download file. HTTP Status: ${response.statusCode}`);
            return reject(`HTTP ${response.statusCode}`);
          }
          loaderMessage(true, 'downloading', 0);
          this.logger.info(`Download started`);
          this.outputChannel.appendLine('Download in progress...');
          const fileStream = fs.createWriteStream(outputPath);
          let downloadedBytes = 0;
          response.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            fileStream.write(chunk);

            if (totalBytes > 0) {
              const progress = Math.round((downloadedBytes / totalBytes) * 100);
              loaderMessage(true, 'downloading', progress);
            }
          });

          response.on('end', () => {
            fileStream.end();
            this.outputChannel.appendLine('Download completed successfully.');
            resolve();
          });

          response.on('error', (err) => {
            fileStream.close();
            fs.unlink(outputPath, () => {});
            this.outputChannel.appendLine(`Error during download: ${err}`);
            this.logger.error(`Error during download: ${err}`);
            reject(err);
          });
        })
        .on('error', reject);
    });
  }

  /** Extract a tar.gz using streaming pipeline */
  private async extractTarGz(tarPath: string, extractTo: string): Promise<void> {
    loaderMessage(true, 'extracting', 0);

    await fsp.mkdir(extractTo, { recursive: true });

    // Extract tar.gz using streaming pipeline
    const tarStream = createReadStream(tarPath);
    await streamPipeline(tarStream, tar.x({ cwd: extractTo }));

    // Set executable permissions on the main binary
    const binaryPath = this.getServiceExecutablePath();
    await fsp.chmod(binaryPath, 0o755);

    // Cleanup downloaded tarball
    await fsp.unlink(tarPath).catch(() => {});
    this.outputChannel.appendLine(`✅ Extract completed successfully.`);
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

  /** Start the server */
  public async startServer(): Promise<boolean> {
    loaderMessage(true, 'starting', 0);
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
      const args = this.getSpawnArguments(port);
      const serverProcess = spawn(serviceExecutable, args, spawnOptions);

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

  // TODO : if we ever switch to Python module only, then remove this.
  /** Build path to service executable */
  private getSpawnArguments(port: number): string[] {
    const usePythonModule = this.essential_config['BINARY']?.['use_python_module'] ?? false;
    return usePythonModule
      ? ['-m', 'app.service', port.toString()] // Python module mode
      : [port.toString()]; // Binary mode
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
