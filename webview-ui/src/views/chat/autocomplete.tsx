import { FC } from "react";
import { AutocompleteOption } from "@/types";
import { Folder, File, Code } from "lucide-react";

interface AutocompleteMenuProps {
  options: AutocompleteOption[];
  onSelect: (label: string) => void;
}

const iconMap = {
  class: <Folder className="w-5 h-5 text-blue-400" />,
  function: <Code className="w-5 h-5 text-purple-400" />,
  file: <File className="w-5 h-5 text-green-400" />,
}

export const AutocompleteMenu: FC<AutocompleteMenuProps> = ({ options, onSelect }) => {
  return (
    <div className="min-h-[200px] max-h-[300px] overflow-y-auto w-full bg-[#252526] border border-[#3c3c3c] rounded-md shadow-xl z-50">
      <ul className="p-1 space-y-1">
        {options.map((option, index) => (
          <li
            key={index}
            className="flex items-center gap-3 px-3 py-2 rounded-sm transition-all duration-150 hover:bg-[#37373d] cursor-pointer"
            onClick={() => onSelect(option.value)}
          >
            <div className="p-1 bg-[#333] rounded-md">{iconMap[option.icon as keyof typeof iconMap]}</div>
            <div>
              <span className="text-sm font-medium text-gray-200">{option.label}</span>
              <p className="text-xs text-gray-400 break-all whitespace-normal">{option.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
