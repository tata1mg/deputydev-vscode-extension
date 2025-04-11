import { FC } from "react";
import { AutocompleteOption } from "@/types";
import { Folder, File, Code, Boxes } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";

interface AutocompleteMenuProps {
  options: AutocompleteOption[];
  onSelect: (option: AutocompleteOption) => void;
}

const iconMap = {
  class: <Boxes className="w-5 h-5 text-blue-400" />,
  function: <Code className="w-5 h-5 text-purple-400" />,
  file: <File className="w-5 h-5 text-green-400" />,
  directory: <Folder className="w-5 h-5 text-blue-400" />,
};


export const AutocompleteMenu: FC<AutocompleteMenuProps> = ({
  options,
  onSelect,
}) => {
  const { selectedOptionIndex } = useChatStore();
  return (
    <div className={`${options.length > 0 ? "max-h-[300px]" : "h-auto"} overflow-y-auto w-full bg-[var(--vscode-list-inactiveSelectionBackground)] border border-[#3c3c3c] rounded-md shadow-xl z-50`}>
      <ul className="p-1 space-y-1">
        {options.length === 0 && (
          <li className="text-center py-2 text-xs opacity-70">
            No results found
          </li>
        )}
        {options.length > 0 && options.map((option, index) => (
          <li
            key={index}
            className={`flex items-center gap-3 px-3 py-2 rounded-sm transition-all duration-150 cursor-pointer ${
              index === selectedOptionIndex
                ? "bg-[var(--deputydev-active-selection-background)] text-[--vscode-list-activeSelectionForeground]"
                : "hover:bg-[var(--deputydev-active-selection-background)]"
            }`}
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent textarea from losing focus
              onSelect(option);
            }}
            onMouseEnter={() => useChatStore.setState({ selectedOptionIndex: index })}
          >
            <div className="p-1 bg-[#333]/80  rounded-md">
              {iconMap[option.icon as keyof typeof iconMap]}
            </div>
            <div>
              <span className="text-sm font-medium">
                {option.label}
              </span>
              <p className="text-xs break-words whitespace-normal opacity-70">
                {option.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
