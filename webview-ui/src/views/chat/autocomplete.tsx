import { FC, useRef, useEffect } from "react";
import { AutocompleteOption } from "@/types";
import { Folder, File, Code, Boxes, Link } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useSafeAutocompleteBackground } from "../../utils/BgColorPatch";

interface AutocompleteMenuProps {
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
  options,
  onSelect,
}) => {
  const safeBg = useSafeAutocompleteBackground();
  const { selectedOptionIndex } = useChatStore();
  const listRef = useRef<HTMLUListElement>(null);

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

  return (
    <div
      className={`${options.length > 0 ? "max-h-[300px]" : "h-auto"} z-50 w-full overflow-y-auto rounded-md border border-[#3c3c3c] shadow-xl`}
      style={{ backgroundColor: safeBg }}
    >
      <ul className="space-y-1 p-1" ref={listRef}>
        {options.length === 0 && (
          <li className="py-2 text-center text-xs opacity-70">
            No results found
          </li>
        )}
        {options.length > 0 &&
          options.map((option, index) => (
            <li
              key={index}
              className={`flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 transition-all duration-150 ${
                index === selectedOptionIndex &&
                "bg-[var(--deputydev-active-selection-background)] text-[--vscode-list-activeSelectionForeground]"
              }`}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent textarea from losing focus
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
      </ul>
    </div>
  );
};
