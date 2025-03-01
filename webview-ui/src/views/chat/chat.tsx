import { useEffect, useRef, useState } from "react";
import { EnterIcon } from "../../components/enterIcon";
import { useChatStore } from "../../stores/chatStore";
import { ChatArea } from "./chatMessagesArea";
import { AutocompleteMenu } from "./autocomplete";
import { Folder, File, Code } from "lucide-react";

const autocompleteOptions = [
  {
    icon: <Folder className="w-5 h-5 text-blue-400" />,
    label: "Directory",
    value: "Directory: ",
    description: "A folder containing files and subfolders",
  },
  {
    icon: <File className="w-5 h-5 text-green-400" />,
    label: "File",
    value: "File: ",
    description: "A single file such as a document or script",
  },
  {
    icon: <Code className="w-5 h-5 text-purple-400" />,
    label: "Code Snippet",
    value: "Code: ",
    description: "A short piece of reusable code",
  },
];

export function ChatUI() {
  const { sendChatMessage, cancelChat, isLoading } = useChatStore();
  const [repoSelectorDisabled] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [chipText, setChipText] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chipInputRef = useRef<HTMLInputElement | null>(null); // New ref for chip input

  useEffect(() => {
    if (chipText !== null && chipInputRef.current) {
      chipInputRef.current.focus();
    }
  }, [chipText]); // Focus on chip input when chipText is set

  const handleSend = async () => {
    if (!userInput.trim() && !chipText) return;
    setUserInput("");
    setChipText(null);
    setShowAutocomplete(false);
    await sendChatMessage(userInput, () => { });
    if (textareaRef.current) textareaRef.current.style.height = "70px";
  };

  const handleSelectAutocomplete = (label: string) => {
    setChipText(label);
    setShowAutocomplete(false);
  };

  return (
    <div className="flex flex-col justify-between h-full relative">
      <div className="flex-grow overflow-y-auto">
        <ChatArea />
      </div>

      {showAutocomplete && (
        <div className="w-full">
          <AutocompleteMenu options={autocompleteOptions} onSelect={handleSelectAutocomplete} />
        </div>
      )}

      <div className="flex flex-col">
        <div className="relative mt-0 p-2 bg-neutral-700 border border-gray-300 rounded w-full min-h-[70px] max-h-[300px]">
          <div className="flex flex-wrap gap-2">
            {chipText !== null && (
              <div className="flex items-center px-2 py-1 bg-gray-600 text-white rounded-md">
                <input
                  ref={chipInputRef} // Set ref to input
                  type="text"
                  value={chipText}
                  className="bg-transparent border-none text-white outline-none"
                  onChange={(e) => setChipText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setShowAutocomplete(false);
                      if (textareaRef.current) {
                        textareaRef.current.focus(); // Move focus back to textarea
                      }
                    }
                  }}
                />
                <button className="ml-2 text-red-400" onClick={() => setChipText(null)}>×</button>
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
              if (newValue.endsWith("@") && chipText === null) {
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
