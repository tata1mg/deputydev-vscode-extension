import React, { FC, useRef, useEffect, useState } from "react";
import { AutocompleteOption, SaveUrlRequest } from "@/types";
import {
  Folder,
  File,
  Code,
  Boxes,
  Link,
  Plus,
  ArrowLeft,
  Pencil,
  RefreshCw,
  ExternalLink,
  Trash2,
  MoreVertical,
  XCircle,
} from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useSafeAutocompleteBackground } from "../../utils/BgColorPatch";
import {
  saveUrl,
  deleteSavedUrl,
  updateSavedUrl,
  openBrowserPage,
} from "@/commandApi";

interface AutocompleteMenuProps {
  showAddNewButton?: boolean;
  options: AutocompleteOption[];
  onSelect: (option: AutocompleteOption) => void;
}

const iconMap = {
  class: <Boxes className="h-5 w-5 text-blue-400" />,
  function: <Code className="h-5 w-5 text-purple-400" />,
  file: <File className="h-5 w-5 text-green-400" />,
  directory: <Folder className="h-5 w-5 text-blue-400" />,
  url: <Link className="h-5 w-5 text-blue-400" />,
};

export const AutocompleteMenu: FC<AutocompleteMenuProps> = ({
  showAddNewButton,
  options,
  onSelect,
}) => {
  const safeBg = useSafeAutocompleteBackground();
  const { selectedOptionIndex } = useChatStore();
  const listRef = useRef<HTMLUListElement>(null);
  const [showAddNewForm, setShowAddNewForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [confirmingDeleteIndex, setConfirmingDeleteIndex] = useState<
    string | null
  >(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [id, setId] = useState("");
  const [urlError, setUrlError] = useState("");
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(
    null,
  );
  const [selectedOption, setSelectedOption] =
    useState<AutocompleteOption | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const dropdownRefs = useRef<(HTMLDivElement | null)[]>([]);

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
  }, []);

  const handleAction = (e: React.MouseEvent, action: string) => {
    e.stopPropagation();
    switch (action) {
      case "edit":
        setEditMode(true);
        selectedOption && setName(selectedOption.label);
        selectedOption?.url && setUrl(selectedOption.url);
        selectedOption?.id && setId(selectedOption.id);
        setShowAddNewForm(true);
        setSelectedOption(null);
        setOpenDropdownIndex(null);
        break;
      case "reindex":
        handleSave(selectedOption?.label, selectedOption?.url);
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
        selectedOption?.id && deleteSavedUrl(selectedOption.id);
        setConfirmingDeleteIndex(null);
        setSelectedOption(null);
        setOpenDropdownIndex(null);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    if (listRef.current && selectedOptionIndex !== -1) {
      const selectedElement = listRef.current.children[selectedOptionIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [selectedOptionIndex]);

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

  const handleSave = (customName?: string, customUrl?: string) => {
    const finalName = customName ?? name;
    const finalUrl = customUrl ?? url;

    if (!finalName || !finalUrl || urlError) return;

    if (editMode) {
      updateSavedUrl({ id, name: finalName });
    } else {
      const payload: SaveUrlRequest = { name: finalName, url: finalUrl };
      saveUrl(payload);
    }

    setName("");
    setUrl("");
    setUrlError("");
    setShowAddNewForm(false);
    setEditMode(false);
  };

  const handleMoreClick = (
    e: React.MouseEvent,
    option: AutocompleteOption,
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

  return (
    <div
      className={`${
        options.length > 0 ? "max-h-[300px]" : "h-auto"
      } z-50 w-full overflow-y-auto rounded-md border border-[#3c3c3c] shadow-xl`}
      style={{ backgroundColor: safeBg }}
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
                  maxLength={50}
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
        <ul className="space-y-1 p-1" ref={listRef}>
          {options.length === 0 && (
            <li className="py-2 text-center text-xs opacity-70">
              No results found
            </li>
          )}
          {options.map((option, index) => (
            <li
              key={index}
              className={`relative flex cursor-pointer items-start justify-between gap-3 rounded-sm px-3 py-2 transition-all duration-150 ${
                index === selectedOptionIndex &&
                "bg-[var(--deputydev-active-selection-background)] text-[--vscode-list-activeSelectionForeground]"
              }`}
              onClick={(e) => {
                e.preventDefault();
                onSelect(option);
              }}
              onMouseEnter={() =>
                useChatStore.setState({ selectedOptionIndex: index })
              }
            >
              <div className="flex min-w-0 flex-1 gap-3">
                <div className="rounded-md p-1">
                  {iconMap[option.icon as keyof typeof iconMap]}
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {option.label}
                  </span>
                  <p className="block truncate text-xs opacity-70">
                    {option.description}
                  </p>
                </div>
              </div>

              {option.icon === "url" && option.label !== "URL" && (
                <div
                  ref={(el) => {
                    dropdownRefs.current[index] = el;
                  }}
                  className="relative ml-auto flex-shrink-0"
                >
                  <button
                    onClick={(e) => handleMoreClick(e, option, index)}
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
                            style={{ color: "var(--vscode-editor-foreground)" }}
                          >
                            Are you sure you want to delete this reference?
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
                              onClick={(e) => handleAction(e, "confirm-delete")}
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
              )}
            </li>
          ))}
          {showAddNewButton && (
            <li
              className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 transition-all duration-150 hover:bg-[var(--deputydev-active-selection-background)] hover:text-[--vscode-list-activeSelectionForeground]"
              onClick={(e) => {
                e.preventDefault();
                setShowAddNewForm(true);
              }}
            >
              <div className="rounded-md p-1">
                <Plus className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <span className="text-sm font-medium">
                  Add new reference document
                </span>
              </div>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
