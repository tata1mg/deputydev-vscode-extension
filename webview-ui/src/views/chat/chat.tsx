import { useEffect, useRef, useState } from "react";
import { EnterIcon } from "../../components/enterIcon";
import { useChatStore } from "../../stores/chatStore";
import { ChatArea } from "./chatMessagesArea";
import { AutocompleteMenu } from "./autocomplete";
import { Folder, File, Code } from "lucide-react";
import { AutocompleteOption } from "@/types";
import { keywordSearch, keywordTypeSearch } from "@/commandApi";


const initialAutocompleteOptions: AutocompleteOption[] = [
  {
    icon: 'directory',
    label: "Directory",
    value: "Directory: ",
    description: "A folder containing files and subfolders",
  },
  {
    icon: "file",
    label: "File",
    value: "File: ",
    description: "A single file such as a document or script",
  },
  {
    icon: "function",
    label: "Function",
    value: "Function: ",
    description: "A short piece of reusable code",
  },
  {
    icon: "class",
    label: "Class",
    value: "Class: ",
    description: "A short piece of reusable class code",
  },
];

export function ChatUI() {
  const { sendChatMessage, cancelChat, isLoading } = useChatStore();
  const [repoSelectorDisabled] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [chipText, setChipText] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chipInputRef = useRef<HTMLInputElement | null>(null);
  const [typingTimeout, setTypingTimeout] = useState<number | null>(null);
  const [selectedReferenceItem, setSelectedReferenceItem] = useState("");

  useEffect(() => {
    if (chipText !== null && chipInputRef.current) {
      chipInputRef.current.focus();
    }
  }, [chipText]);

  const handleSend = async () => {
    if (!userInput.trim() && !chipText) return;
    setUserInput("");
    setChipText(null);
    setShowAutocomplete(false);
    await sendChatMessage(userInput, () => { });
    if (textareaRef.current) textareaRef.current.style.height = "70px";
  };

  const handleSelectAutocomplete = (label: string) => {
    setChipText(label)
    setSelectedReferenceItem(label);
    setShowAutocomplete(false);
  };

  const handleChipClose = () => {
    setChipText(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
    setShowAutocomplete(false);
  };

  function startsWithPrefix(word: string) {
    const prefixes = ["File: ", "Directory: ", "Class: ", "Function: "];
    return prefixes.some(prefix => word.startsWith(prefix));
  }

  const handleChipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setShowAutocomplete(true);
    setChipText(newValue);

    // Clear the previous timeout if the user keeps typing
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Set a new timeout to call the API after 500ms of inactivity
    const newTimeout = window.setTimeout(async () => {
      if (startsWithPrefix(newValue)) {
        await keywordTypeSearch({ 
          keyword: newValue.split(": ")[1], 
          type: newValue.split(": ")[0].toLowerCase()
        }); 
      } else{
        await keywordSearch({ keyword: newValue });
      }
    }, 500);
    
    setTypingTimeout(newTimeout);
  };

  return (
    <div className="flex flex-col justify-between h-full relative">
      <div className="flex-grow overflow-y-auto">
        <ChatArea />
      </div>

      {showAutocomplete && (
        <div className="w-full">
          <AutocompleteMenu options={
            chipText ?
              useChatStore.getState().ChatAutocompleteOptions :
              initialAutocompleteOptions
            } onSelect={handleSelectAutocomplete} />
        </div>
      )}

      <div className="flex flex-col">
        <div className="relative mt-0 p-2 bg-neutral-700 border border-gray-300 rounded w-full min-h-[70px] max-h-[300px]">
          <div className="flex flex-wrap gap-2">
            {chipText !== null && (
              <div className="flex items-center px-2 py-1 bg-gray-600 text-white rounded-md">
                <input
                  ref={chipInputRef}
                  type="text"
                  value={chipText}
                  className="bg-transparent border-none text-white outline-none"
                  onChange={handleChipChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setShowAutocomplete(false);
                      if (textareaRef.current) {
                        textareaRef.current.focus();
                      }
                    }
                  }}
                />
                <button className="ml-2 text-red-400" onClick={handleChipClose}>×</button>
              </div>
            )}
          </div>

          <textarea
            ref={textareaRef}
            className="bg-transparent p-1 w-full text-white resize-none focus:outline-none"
            placeholder="Ask anything (⌘L), @ to mention code blocks"
            value={userInput}
            onChange={(e) => {
              const newValue = e.target.value;

              if (newValue.endsWith("@")) {
                setChipText("");
                setShowAutocomplete(true);
              } else {
                setUserInput(newValue);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={repoSelectorDisabled || isLoading}
          />
          <div className="top-1/2 right-3 absolute flex items-center -translate-y-1/2">
            {isLoading ? (
              <button className="bg-red-500 rounded-sm w-4 h-4" onClick={cancelChat} disabled={repoSelectorDisabled} />
            ) : (
              <button onClick={handleSend} disabled={repoSelectorDisabled}>
                <EnterIcon className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
