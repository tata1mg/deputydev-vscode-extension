import { FC, useRef, useEffect, useState } from "react";
import { AutocompleteOption, SaveUrlRequest } from "@/types";
import { Folder, File, Code, Boxes, Link, Plus, ArrowLeft } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useSafeAutocompleteBackground } from "../../utils/BgColorPatch";
import { saveUrl } from "@/commandApi";

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
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");

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

  const handleSave = () => {
    if (!name || !url || urlError) return;
    const payload: SaveUrlRequest = {
      name: name,
      url: url,
    };
    saveUrl(payload);
    setName("");
    setUrl("");
    setUrlError("");
    setShowAddNewForm(false);
  };

  return (
    <div
      className={`${options.length > 0 ? "max-h-[300px]" : "h-auto"} z-50 w-full overflow-y-auto rounded-md border border-[#3c3c3c] shadow-xl`}
      style={{ backgroundColor: safeBg }}
    >
      {showAddNewForm ? (
        <div className="flex flex-col space-y-4 p-4">
          <div className="flex items-center justify-between">
            <button
              className="flex items-center gap-1 text-sm text-blue-500 hover:underline"
              onClick={() => setShowAddNewForm(false)}
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
                } bg-[#1e1e1e] p-2 text-white placeholder-gray-400 focus:outline-none`}
                placeholder="Enter URL"
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
                setName("");
                setUrl("");
                setUrlError("");
              }}
            >
              Cancel
            </button>
            <button
              className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
              onClick={handleSave}
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
              className={`flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 transition-all duration-150 ${
                index === selectedOptionIndex &&
                "bg-[var(--deputydev-active-selection-background)] text-[--vscode-list-activeSelectionForeground]"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(option);
              }}
              onMouseEnter={() =>
                useChatStore.setState({ selectedOptionIndex: index })
              }
            >
              <div className="rounded-md bg-[#333]/80 p-1">
                {iconMap[option.icon as keyof typeof iconMap]}
              </div>
              <div>
                <span className="text-sm font-medium">{option.label}</span>
                <p className="whitespace-normal break-words text-xs opacity-70">
                  {option.description}
                </p>
              </div>
            </li>
          ))}
          {showAddNewButton && (
            <li
              className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 transition-all duration-150 hover:bg-[var(--deputydev-active-selection-background)] hover:text-[--vscode-list-activeSelectionForeground]"
              onMouseDown={(e) => {
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
