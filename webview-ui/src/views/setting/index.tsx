import React, { useEffect, useState, useRef } from "react";
import { ChatTypeToggle } from "../chat/chatElements/chatTypeToggle";
import { X } from "lucide-react";
import { Settings } from "../../types";
import { saveSettings } from "@/commandApi";
import { useSettingsStore } from "@/stores/settingsStore";

interface SettingsCardProps {
  title: string;
  description: string;
  children?: React.ReactNode;
  bottom?: boolean;
}

const SettingsCard: React.FC<SettingsCardProps> = ({
  title,
  description,
  children,
  bottom,
}) => {
  return (
    <div
      style={{
        backgroundColor: "var(--vscode-editorWidget-background)",
        border: "1px solid var(--vscode-editorWidget-border)",
      }}
      className="mb-4 rounded-lg p-4 transition-colors hover:border-opacity-80"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2
          style={{ color: "var(--vscode-editor-foreground)" }}
          className="mb-1 text-[13px] font-semibold leading-6"
        >
          {title}
        </h2>
        {!bottom && children}
      </div>
      <div className="flex flex-col">
        {description && (
          <p
            style={{ color: "var(--vscode-descriptionForeground)" }}
            className="mb-2 text-[12px] leading-5"
          >
            {description}
          </p>
        )}
      </div>
      <div className="mt-2 w-full">{children && bottom && children}</div>
    </div>
  );
};

const EditRulesButton: React.FC = () => {
  const handleClick = () => {
    console.log("Edit rules button clicked");
  };

  return (
    <button
      onClick={handleClick}
      className="rounded-md bg-[--deputydev-button-background] px-2 py-1 text-white hover:bg-blue-600"
    >
      Edit Rules
    </button>
  );
};

interface YoloModeToggleProps {
  isYoloModeOn: boolean;
  onToggle: (valur: boolean) => void;
}

const YoloModeToggle: React.FC<YoloModeToggleProps> = ({
  isYoloModeOn,
  onToggle,
}) => {
  const handleToggle = () => {
    onToggle(!isYoloModeOn);
  };

  return (
    <label className="flex cursor-pointer items-center gap-1">
      <div className="relative inline-block h-5 w-10">
        <input
          type="checkbox"
          checked={isYoloModeOn}
          onChange={handleToggle}
          className="sr-only"
        />
        <div
          className={`block h-full w-full rounded-full transition-colors ${
            isYoloModeOn ? "bg-[--deputydev-button-background]" : "bg-gray-400"
          }`}
        ></div>
        <div
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            isYoloModeOn ? "translate-x-5" : "translate-x-0"
          }`}
        ></div>
      </div>
    </label>
  );
};

interface CommandDenyListProps {
  commands: string[];
  setCommands: (newCommands: string[]) => void;
}

const CommandDenyList: React.FC<CommandDenyListProps> = ({
  commands,
  setCommands,
}) => {
  const [currentCommand, setCurrentCommand] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleAddCommand = () => {
    const trimmed = currentCommand.trim();
    if (!trimmed) return;
    if (commands.includes(trimmed)) {
      setError("Command already exists in the deny list.");
      return;
    }
    setCommands([...commands, trimmed]);
    setCurrentCommand("");
  };

  const handleRemoveCommand = (command: string) => {
    setCommands(commands.filter((cmd) => cmd !== command));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentCommand(e.target.value);
    if (error) setError(null);
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {commands.map((command, index) => (
          <div
            key={index}
            className="bg-[color:var(--vscode-editor-background)]/80 flex items-center gap-2 rounded-full border border-[color:var(--vscode-editorWidget-border)] px-3 py-1 text-[color:var(--vscode-foreground)] shadow-sm"
          >
            <span className="text-sm">{command}</span>
            <button
              onClick={() => handleRemoveCommand(command)}
              className="hover:bg-[color:var(--vscode-input-background)]/60 rounded-full p-0.5 transition-colors duration-150"
            >
              <X className="h-4 w-4 text-[color:var(--vscode-icon-foreground)]" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex w-full gap-2">
        <input
          type="text"
          value={currentCommand}
          onChange={handleChange}
          onKeyDown={(e) => e.key === "Enter" && handleAddCommand()}
          placeholder="Enter command to deny"
          className="flex-1 rounded-md border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-input-background)] p-1.5 text-sm text-[var(--vscode-input-foreground)] focus:border-[var(--vscode-input-border)] focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
        />
        <button
          onClick={handleAddCommand}
          className="rounded-md bg-[--deputydev-button-background] px-3 py-1 text-white hover:bg-blue-600"
        >
          Add
        </button>
      </div>

      {error && (
        <p
          className="mt-2 text-xs"
          style={{ color: "var(--vscode-errorForeground)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
};

interface SliderProps {
  min: number;
  max: number;
  value: number;
  postfix?: string;
  onChange: (value: number) => void;
}

const Slider: React.FC<SliderProps> = ({
  min,
  max,
  value,
  postfix = "",
  onChange,
}) => {
  const [internalValue, setInternalValue] = useState(value);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setInternalValue(value); // Sync if parent updates
  }, [value]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      onChange(internalValue);
    }, 300); // 300ms debounce
  }, [internalValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInternalValue(Number(e.target.value));
  };

  return (
    <div className="flex items-center">
      <input
        type="range"
        min={min}
        max={max}
        value={internalValue}
        onChange={handleChange}
        className="focus:ring-none h-2 w-full cursor-pointer rounded-lg focus:outline-none"
      />
      <span className="ml-2">
        {internalValue}
        {postfix}
      </span>
    </div>
  );
};

const Setting = () => {
  const {
    terminalOutputLimit,
    shellIntegrationTimeout,
    shellCommandTimeout,
    isYoloModeOn,
    commandsToDeny,
    chatType,
    setTerminalOutputLimit,
    setShellIntegrationTimeout,
    setShellCommandTimeout,
    setIsYoloModeOn,
    setCommandsToDeny,
    setChatType,
  } = useSettingsStore();

  useEffect(() => {
    const settings: Settings = {
      default_mode: chatType,
      terminal_settings: {
        terminal_output_limit: terminalOutputLimit,
        shell_integration_timeout: shellIntegrationTimeout,
        shell_command_timeout: shellCommandTimeout,
        enable_yolo_mode: isYoloModeOn,
        command_deny_list: commandsToDeny,
      },
    };
    saveSettings(settings);
  }, [
    chatType,
    terminalOutputLimit,
    shellIntegrationTimeout,
    shellCommandTimeout,
    isYoloModeOn,
    commandsToDeny,
  ]);

  return (
    <div
      className="flex h-screen flex-col"
      style={{
        padding: "1rem",
        backgroundColor: "var(--vscode-sidebar-background-rgb)",
      }}
    >
      <div>
        <h3
          className="mb-3 text-lg font-semibold"
          style={{ color: "var(--vscode-editor-foreground)" }}
        >
          DeputyDev Settings
        </h3>
        <SettingsCard
          title="DeputyDev Default Behavior"
          description={
            "Choose how DeputyDev interacts with your code by default. In 'Act' mode, it can directly modify your code. In 'Chat' mode, it will only provide recommendations without making changes."
          }
        >
          <ChatTypeToggle chatType={chatType} setChatType={setChatType} />
        </SettingsCard>
        <SettingsCard
          title="DeputyDev Configuration Rules"
          description={
            "Customize DeputyDev behavior by creating a `.deputudevrules` file in the root of your project. Define rules to tailor functionality to your needs."
          }
        >
          <EditRulesButton />
        </SettingsCard>
      </div>
      <div>
        <h3
          className="mb-3 mt-2 text-lg font-semibold"
          style={{ color: "var(--vscode-editor-foreground)" }}
        >
          Terminal Settings
        </h3>
        <SettingsCard
          title="Enable/Disable YOLO Mode"
          description={
            "YOLO mode allows DeputyDev to execute commands in the terminal without confirmation. Use with caution!"
          }
        >
          <YoloModeToggle
            isYoloModeOn={isYoloModeOn}
            onToggle={setIsYoloModeOn}
          />
        </SettingsCard>
        <SettingsCard
          title="Command Deny List"
          description={
            "Prevent DeputyDev from executing specific commands in the terminal. This is useful for security and safety."
          }
          bottom
        >
          <CommandDenyList
            commands={commandsToDeny}
            setCommands={setCommandsToDeny}
          />
        </SettingsCard>
        <SettingsCard
          title="Terminal Output Limit"
          description={
            "Set the maximum number of lines DeputyDev will include in a terminal output when executing commands. When exceeded, it will truncate the output. Saving tokens and improving performance."
          }
          bottom
        >
          <Slider
            min={100}
            max={5000}
            value={terminalOutputLimit}
            onChange={setTerminalOutputLimit}
            postfix=""
          />
        </SettingsCard>
        <SettingsCard
          title="Shell Integration Initialization Timeout"
          description={
            "Set the maximum wait time (in seconds) for the terminal shell integration to initialize. Increase this value if you're working on a large project or using a slower machine to avoid premature timeout errors."
          }
          bottom
        >
          <Slider
            min={1}
            max={60}
            value={shellIntegrationTimeout}
            onChange={setShellIntegrationTimeout}
            postfix="s"
          />
        </SettingsCard>
        <SettingsCard
          title="Shell Command Execution Timeout"
          description={
            "Set the maximum wait time (in seconds) for a shell command to execute. Increase this value if you're working on a large project or using a slower machine to avoid premature timeout errors."
          }
          bottom
        >
          <Slider
            min={10}
            max={120}
            value={shellCommandTimeout}
            onChange={setShellCommandTimeout}
            postfix="s"
          />
        </SettingsCard>
      </div>
      <div>
        <h3
          className="mb-3 mt-2 text-lg font-semibold"
          style={{ color: "var(--vscode-editor-foreground)" }}
        >
          URL Management
        </h3>
      </div>
    </div>
  );
};

export default Setting;
