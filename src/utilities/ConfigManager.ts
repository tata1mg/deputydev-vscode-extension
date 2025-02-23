import * as fs from "fs";

class ConfigManager {
    private static instance: ConfigManager;
    private config: Record<string, any> = {};
    private configPath: string = "../../config.json";
    private inMemory: boolean = false;

    private constructor() {
        this.loadConfig(); // Load config synchronously when instance is created
    }

    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    private loadConfig(): void {
        if (this.inMemory) {
            this.config = {};
            return;
        }

        if (fs.existsSync(this.configPath)) {
            try {
                const data = fs.readFileSync(this.configPath, "utf-8");
                this.config = JSON.parse(data);
            } catch (error) {
                console.error("Error reading config file:", error);
            }
        }
    }

    public get<T>(key: string, defaultValue?: T): T | undefined {
        return this.config.hasOwnProperty(key) ? this.config[key] : defaultValue;
    }

    public set(values: Record<string, any>): void {
        Object.assign(this.config, values);

        if (!this.inMemory) {
            try {
                fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 4), "utf-8");
            } catch (error) {
                console.error("Error writing to config file:", error);
            }
        }
    }

    public get configs(): Readonly<Record<string, any>> {
        return this.config;
    }
}

export default ConfigManager.getInstance();
