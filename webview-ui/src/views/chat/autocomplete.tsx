import { FC } from "react";
import { AutocompleteOption } from "@/types";
import { Folder, File, Code, Boxes } from "lucide-react";

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
  return (
    <div className="min-h-[200px] max-h-[300px] overflow-y-auto w-full bg-[var(--vscode-list-inactiveSelectionBackgroundd)] border border-[#3c3c3c] rounded-md shadow-xl z-50">
      <ul className="p-1 space-y-1">
        {options.map((option, index) => (
          <li
            key={index}
            className=" hover:text-[--vscode-list-activeSelectionForeground]  flex items-center gap-3 px-3 py-2 rounded-sm transition-all duration-150 hover:bg-[var(--deputydev-active-selection-background)] cursor-pointer"
            onClick={() => onSelect(option)}
          >
            <div className="p-1 bg-[#333]/80  rounded-md">
              {iconMap[option.icon as keyof typeof iconMap]}
            </div>
            <div>
              <span className="text-sm font-medium">
                {option.label}
              </span>
              <p className="text-xs break-all whitespace-normal opacity-70">
                {option.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
