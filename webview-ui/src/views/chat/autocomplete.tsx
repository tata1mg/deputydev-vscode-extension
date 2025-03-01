import { FC } from "react";
import { AutocompleteOption } from "@/types";

interface AutocompleteMenuProps {
  options: AutocompleteOption[];
  onSelect: (label: string) => void;
}

export const AutocompleteMenu: FC<AutocompleteMenuProps> = ({ options, onSelect }) => {
  return (
    <div className="w-full bg-[#252526] border border-[#3c3c3c] rounded-md shadow-xl z-50">
      <ul className="p-1 space-y-1">
        {options.map((option, index) => (
          <li
            key={index}
            className="flex items-center gap-3 px-3 py-2 rounded-sm transition-all duration-150 hover:bg-[#37373d] cursor-pointer"
            onClick={() => onSelect(option.value)}
          >
            <div className="p-1 bg-[#333] rounded-md">{option.icon}</div>
            <div>
              <span className="text-sm font-medium text-gray-200">{option.label}</span>
              <p className="text-xs text-gray-400">{option.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
