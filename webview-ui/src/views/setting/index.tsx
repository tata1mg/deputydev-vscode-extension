import React, { useEffect, useState, useRef } from "react";
import { ChatTypeToggle } from "../chat/chatElements/chatTypeToggle";
import {
  X,
  Link,
  MoreVertical,
  Pencil,
  RefreshCw,
  Trash2,
  ExternalLink,
  ArrowLeft,
  Plus,
} from "lucide-react";
import { Settings, URLListItem, SaveUrlRequest } from "../../types";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  saveSettings,
  getSavedUrls,
  saveUrl,
  deleteSavedUrl,
  updateSavedUrl,
  openBrowserPage,
  urlSearch,
  createOrOpenFile,
} from "@/commandApi";
import { BarLoader } from "react-spinners";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const getLocaleTimeString = (dateString: string) => {
  const cleanedDateString = dateString.split(".")[0] + "Z"; // Force UTC
  const date = new Date(cleanedDateString);
  const dateOptions: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  };

  const locale = navigator.language || "en-US";
  const datePart = date.toLocaleDateString(locale, dateOptions);
  const timePart = date.toLocaleTimeString(locale, timeOptions);

  return `${datePart}, ${timePart.toUpperCase()}`;
};

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
  const { workspaceRepos } = useWorkspaceStore();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleRepoClick = (repoPath: string) => {
    setIsOpen(false);
    const filePath = `${repoPath}/.deputydevrules`;
    createOrOpenFile(filePath);
  };

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="rounded-md bg-[--vscode-button-background] px-2 py-1 text-[--vscode-button-foreground] hover:bg-[--vscode-button-hoverBackground]"
      >
        Edit Rules
      </button>

      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-64 rounded-md border border-[--vscode-dropdown-border] bg-[--vscode-editor-background] shadow-lg">
          <ul className="py-1 text-sm text-[--vscode-editor-foreground]">
            {workspaceRepos.map((repo, index) => (
              <li
                key={index}
                className="cursor-pointer px-4 py-2 hover:bg-[--vscode-list-hoverBackground]"
                onClick={() => handleRepoClick(repo.repoPath)}
              >
                {repo.repoName}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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

export function CustomLoader() {
  return (
    <div style={{ width: "100%" }}>
      <BarLoader
        width="100%"
        color="var(--vscode-editor-foreground)" // dynamically picks up from VSCode theme
      />
    </div>
  );
}

const Setting = () => {
  const {
    terminalOutputLimit,
    shellIntegrationTimeout,
    shellCommandTimeout,
    isYoloModeOn,
    commandsToDeny,
    chatType,
    urls,
    setTerminalOutputLimit,
    setShellIntegrationTimeout,
    setShellCommandTimeout,
    setIsYoloModeOn,
    setCommandsToDeny,
    setChatType,
  } = useSettingsStore();
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(
    null,
  );
  const [confirmingDeleteIndex, setConfirmingDeleteIndex] = useState<
    string | null
  >(null);
  const dropdownRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [selectedOption, setSelectedOption] = useState<URLListItem | null>(
    null,
  );
  const [editMode, setEditMode] = useState(false);
  const [showAddNewForm, setShowAddNewForm] = useState(false);
  const [name, setName] = useState("");
  const [searchInput, setSeachInput] = useState("");
  const [url, setUrl] = useState("");
  const [id, setId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [urlError, setUrlError] = useState("");

  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const handleMoreClick = (
    e: React.MouseEvent,
    option: URLListItem,
    index: number,
  ) => {
    e.stopPropagation();
    setSelectedOption(option);
    const button = e.currentTarget;
    const buttonRect = button.getBoundingClientRect();
    const dropdownHeight = 160;
    const spaceBelow = window.innerHeight - buttonRect.bottom;

    let top = buttonRect.bottom;
    let left = buttonRect.right - 150;

    if (spaceBelow < dropdownHeight && buttonRect.top > dropdownHeight) {
      top = buttonRect.top - dropdownHeight;
    }

    setOpenDropdownIndex(index);
    setDropdownPosition({ top, left });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRefs.current.every(
          (ref) => !ref || !ref.contains(event.target as Node),
        )
      ) {
        setOpenDropdownIndex(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [urls]);
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

  useEffect(() => {
    getSavedUrls({ isSettings: true });
  }, []);

  useEffect(() => {
    setIsLoading(false);
  }, [urls]);

  useEffect(() => {
    searchInput.length
      ? urlSearch({ keyword: searchInput, isSettings: true })
      : getSavedUrls({ isSettings: true });
  }, [searchInput]);

  const handleSave = (customName?: string, customUrl?: string) => {
    setIsLoading(true);
    const finalName = customName ?? name;
    const finalUrl = customUrl ?? url;

    if (!finalName || !finalUrl || urlError) return;

    if (editMode) {
      updateSavedUrl({ id, name: finalName, isSettings: true });
    } else {
      const payload: SaveUrlRequest = {
        name: finalName,
        url: finalUrl,
        isSettings: true,
      };
      saveUrl(payload);
    }

    setName("");
    setUrl("");
    setUrlError("");
    setShowAddNewForm(false);
    setEditMode(false);
  };

  const handleAction = (e: React.MouseEvent, action: string) => {
    e.stopPropagation();
    switch (action) {
      case "edit":
        setEditMode(true);
        selectedOption && setName(selectedOption.name);
        selectedOption?.url && setUrl(selectedOption.url);
        selectedOption?.id && setId(selectedOption.id);
        setShowAddNewForm(true);
        setSelectedOption(null);
        setOpenDropdownIndex(null);
        break;
      case "reindex":
        setIsLoading(true);
        handleSave(selectedOption?.name, selectedOption?.url);
        setSelectedOption(null);
        setOpenDropdownIndex(null);
        break;
      case "open":
        selectedOption?.url && openBrowserPage(selectedOption.url);
        setSelectedOption(null);
        setOpenDropdownIndex(null);
        break;
      case "delete":
        selectedOption?.id && setConfirmingDeleteIndex(selectedOption.id);
        break;
      case "confirm-delete":
        setIsLoading(true);
        selectedOption?.id && deleteSavedUrl(selectedOption.id, true);
        setConfirmingDeleteIndex(null);
        setSelectedOption(null);
        setOpenDropdownIndex(null);
        break;
      default:
        break;
    }
  };

  const validateUrl = (input: string) => {
    try {
      new URL(input);
      return true;
    } catch {
      return false;
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);
    setUrlError(validateUrl(value) ? "" : "Please enter a valid URL");
  };

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
        <div>
          <div className="mb-3 mt-2 flex items-center justify-between gap-4">
            <h3
              className="text-lg font-semibold"
              style={{ color: "var(--vscode-editor-foreground)" }}
            >
              URL Management
            </h3>
            <button
              onClick={(e) => {
                e.preventDefault();
                setShowAddNewForm(true);
              }}
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <Plus className="h-4 w-4" />
              Add New URL
            </button>
          </div>
        </div>
        <div
          style={{
            backgroundColor: "var(--vscode-editorWidget-background)",
            border: "1px solid var(--vscode-editorWidget-border)",
          }}
          className={`mb-4 rounded-lg p-2 transition-colors hover:border-opacity-80`}
        >
          {isLoading && <CustomLoader />}

          <div
            className={`${urls.length > 0 ? "max-h-[300px]" : "h-auto"} overflow-y-auto`}
          >
            {showAddNewForm ? (
              <div
                className="flex flex-col space-y-4 p-4"
                style={{ fontFamily: "var(--vscode-font-family)" }}
              >
                <div className="flex items-center justify-between">
                  <button
                    className="flex items-center text-sm transition-all hover:text-[var(--vscode-textLink-activeForeground)]"
                    onClick={() => {
                      setShowAddNewForm(false);
                      setEditMode(false);
                    }}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4 transition-transform hover:-translate-x-0.5" />
                    <span className="hover:underline">Back to list</span>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      className="mb-1 block text-sm font-medium"
                      style={{ color: "var(--vscode-foreground)" }}
                    >
                      Name
                      <span className="ml-1 text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-lg px-4 py-2 text-sm transition-all focus:outline-none"
                        style={{
                          background: "var(--vscode-input-background)",
                          color: "var(--vscode-input-foreground)",
                          border: "1px solid var(--vscode-input-border)",
                          boxShadow: "var(--vscode-widget-shadow) 0px 1px 4px",
                          transition: "all 0.2s ease", // Smooth transition
                        }}
                        onFocus={(e) => {
                          e.target.style.border =
                            "1px solid var(--vscode-focusBorder)";
                          e.target.style.boxShadow =
                            "var(--vscode-widget-shadow) 0px 2px 6px";
                        }}
                        onBlur={(e) => {
                          e.target.style.border =
                            "1px solid var(--vscode-input-border)";
                          e.target.style.boxShadow =
                            "var(--vscode-widget-shadow) 0px 1px 4px";
                        }}
                        placeholder="Friendly URL Name"
                        maxLength={50}
                      />

                      <div
                        className="absolute bottom-1.5 right-3 text-xs opacity-70"
                        style={{ color: "var(--vscode-descriptionForeground)" }}
                      >
                        {name.length}/50
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      className="mb-1 block text-sm font-medium"
                      style={{ color: "var(--vscode-foreground)" }}
                    >
                      URL
                      <span className="ml-1 text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={url}
                        onChange={handleUrlChange}
                        className="w-full rounded-lg px-4 py-2 text-sm transition-all focus:outline-none"
                        disabled={editMode}
                        style={{
                          background: "var(--vscode-input-background)",
                          color: "var(--vscode-input-foreground)",
                          border: urlError
                            ? "1px solid var(--vscode-errorForeground)"
                            : "1px solid var(--vscode-input-border)",
                          boxShadow: "var(--vscode-widget-shadow) 0px 1px 4px",
                          transition: "all 0.2s ease", // Smooth transition
                        }}
                        onFocus={(e) => {
                          e.target.style.border = urlError
                            ? "1px solid var(--vscode-errorForeground)"
                            : "1px solid var(--vscode-focusBorder)";
                          e.target.style.boxShadow =
                            "var(--vscode-widget-shadow) 0px 2px 6px";
                        }}
                        onBlur={(e) => {
                          e.target.style.border = urlError
                            ? "1px solid var(--vscode-errorForeground)"
                            : "1px solid var(--vscode-input-border)";
                          e.target.style.boxShadow =
                            "var(--vscode-widget-shadow) 0px 1px 4px";
                        }}
                        placeholder="http://example.com"
                      />

                      {urlError && (
                        <div className="mt-1">
                          <p
                            className="text-[0.75rem] font-medium"
                            style={{ color: "var(--vscode-errorForeground)" }}
                          >
                            {urlError}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  style={
                    urlError
                      ? {
                          marginTop: "0px",
                          paddingTop: "5px",
                        }
                      : {}
                  }
                  className="mt-3 flex justify-end gap-3 pt-4"
                >
                  <button
                    className="rounded-lg px-4 py-2 text-sm font-medium transition-all hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                    style={{
                      color: "var(--vscode-button-secondaryForeground)",
                      background: "var(--vscode-button-secondaryBackground)",
                    }}
                    onClick={() => {
                      setShowAddNewForm(false);
                      setEditMode(false);
                      setName("");
                      setUrl("");
                      setUrlError("");
                    }}
                  >
                    Discard
                  </button>
                  <button
                    className="rounded-lg px-4 py-2 text-sm font-medium transition-all hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                    style={{
                      background: "var(--vscode-button-background)",
                      color: "var(--vscode-button-foreground)",
                      boxShadow: "var(--vscode-widget-shadow) 0px 2px 8px -2px",
                    }}
                    onClick={() => {
                      handleSave();
                    }}
                    disabled={!name || !url || !!urlError}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <ul className="space-y-1 p-1">
                {urls.length === 0 && (
                  <li className="py-2 text-center text-xs opacity-70">
                    No Saved URL
                  </li>
                )}
                {urls.map((url, index) => (
                  <li
                    key={index}
                    className="relative flex cursor-pointer items-start justify-between gap-3 rounded-sm px-3 py-2 transition-all duration-150 hover:bg-[var(--deputydev-active-selection-background)] hover:text-[--vscode-list-activeSelectionForeground]"
                    onClick={(e) => {
                      e.preventDefault();
                    }}
                  >
                    <div className="flex min-w-0 flex-1 gap-3">
                      <div className="rounded-md p-1">
                        <Link className="h-5 w-5 text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <span
                          className="block truncate text-sm font-medium"
                          title={url.name}
                        >
                          {url.name}
                        </span>
                        <p className="block truncate text-xs opacity-70">
                          {"Indexed on " +
                            getLocaleTimeString(url.last_indexed)}
                        </p>
                      </div>
                    </div>
                    <div
                      ref={(el) => {
                        dropdownRefs.current[index] = el;
                      }}
                      className="relative ml-auto flex-shrink-0"
                    >
                      <button
                        onClick={(e) => handleMoreClick(e, url, index)}
                        className="text-muted-foreground p-1 hover:text-white"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {openDropdownIndex !== null && dropdownPosition && (
                        <div
                          className="fixed z-50 w-40 rounded-md border border-gray-700 bg-[#1e1e1e] text-sm shadow-lg"
                          style={{
                            top: `${dropdownPosition.top}px`,
                            left: `${dropdownPosition.left}px`,
                          }}
                        >
                          {confirmingDeleteIndex ? (
                            <div className="space-y-4 p-3">
                              <p
                                className="text-sm"
                                style={{
                                  color: "var(--vscode-editor-foreground)",
                                }}
                              >
                                Are you sure you want to delete this URL?
                              </p>
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmingDeleteIndex(null);
                                  }}
                                  className="rounded-md px-2 py-1 text-sm"
                                  style={{
                                    color: "var(--vscode-button-foreground)",
                                    backgroundColor:
                                      "var(--vscode-button-secondaryBackground)",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      "var(--vscode-button-secondaryHoverBackground)";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      "var(--vscode-button-secondaryBackground)";
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={(e) =>
                                    handleAction(e, "confirm-delete")
                                  }
                                  className="rounded-md px-2 py-1 text-sm"
                                  style={{
                                    color: "var(--vscode-button-foreground)",
                                    backgroundColor: "#de8188",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      "#ed939a";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      "#de8188";
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ) : (
                            <ul>
                              <li
                                onClick={(e) => handleAction(e, "edit")}
                                className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-700"
                              >
                                <Pencil size={16} /> Edit
                              </li>
                              <li
                                onClick={(e) => handleAction(e, "reindex")}
                                className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-700"
                              >
                                <RefreshCw size={16} /> Re-Index
                              </li>
                              <li
                                onClick={(e) => handleAction(e, "open")}
                                className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-700"
                              >
                                <ExternalLink size={16} /> Open Page
                              </li>
                              <li
                                onClick={(e) => handleAction(e, "delete")}
                                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-red-400 hover:bg-gray-700"
                              >
                                <Trash2 size={16} /> Delete
                              </li>
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!showAddNewForm && (
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSeachInput(e.target.value)}
              className="w-full rounded-lg px-4 py-2 text-sm transition-all focus:outline-none"
              style={{
                background: "var(--vscode-input-background)",
                color: "var(--vscode-input-foreground)",
                border: "1px solid var(--vscode-input-border)",
                boxShadow: "var(--vscode-widget-shadow) 0px 1px 4px",
                transition: "all 0.2s ease", // Smooth transition
              }}
              onFocus={(e) => {
                e.target.style.border = "1px solid var(--vscode-focusBorder)";
                e.target.style.boxShadow =
                  "var(--vscode-widget-shadow) 0px 2px 6px";
              }}
              onBlur={(e) => {
                e.target.style.border = "1px solid var(--vscode-input-border)";
                e.target.style.boxShadow =
                  "var(--vscode-widget-shadow) 0px 1px 4px";
              }}
              placeholder="Search URL"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Setting;
