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
    setOpenDropdownIndex(null);
    switch (action) {
      case "edit":
        setEditMode(true);
        selectedOption && setName(selectedOption.label);
        selectedOption?.url && setUrl(selectedOption.url);
        selectedOption?.id && setId(selectedOption.id);
        setShowAddNewForm(true);
        break;
      case "reindex":
        handleSave(selectedOption?.label, selectedOption?.url);
        break;
      case "open":
        selectedOption?.url && openBrowserPage(selectedOption.url);
        break;
      case "delete":
        selectedOption?.id && deleteSavedUrl(selectedOption.id);
        break;
      default:
        break;
    }
    setSelectedOption(null);
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
        <div className="flex flex-col space-y-4 p-4">
          <div className="flex items-center justify-between">
            <button
              className="flex items-center gap-1 text-sm text-blue-500 hover:underline"
              onClick={() => {
                setShowAddNewForm(false);
                setEditMode(false);
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-white">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-600 bg-[#1e1e1e] p-2 text-white placeholder-gray-400 focus:outline-none"
                placeholder="Enter name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white">
                URL
              </label>
              <input
                type="text"
                value={url}
                onChange={handleUrlChange}
                className={`mt-1 w-full rounded-md border ${
                  urlError ? "border-red-500" : "border-gray-600"
                } ${
                  editMode
                    ? "cursor-not-allowed bg-[#2a2a2a] text-gray-500 opacity-70"
                    : "bg-[#1e1e1e] text-white"
                } p-2 placeholder-gray-400 focus:outline-none`}
                placeholder="Enter URL"
                disabled={editMode}
              />

              {urlError && (
                <p className="mt-1 text-xs text-red-500">{urlError}</p>
              )}
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button
              className="rounded-md px-4 py-2 text-sm text-gray-400 hover:underline"
              onClick={() => {
                setShowAddNewForm(false);
                setEditMode(false);
                setName("");
                setUrl("");
                setUrlError("");
              }}
            >
              Cancel
            </button>
            <button
              className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
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
              <div className="flex gap-3">
                <div className="rounded-md bg-[#333]/80 p-1">
                  {iconMap[option.icon as keyof typeof iconMap]}
                </div>
                <div>
                  <span className="text-sm font-medium">{option.label}</span>
                  <p className="whitespace-normal break-words text-xs opacity-70">
                    {option.description}
                  </p>
                </div>
              </div>

              {option.icon === "url" && option.label !== "URL" && (
                <div
                  ref={(el) => {
                    dropdownRefs.current[index] = el;
                  }}
                  className="relative ml-auto"
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
              <div className="rounded-md bg-[#333]/80 p-1">
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
