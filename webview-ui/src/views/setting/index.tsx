import { useState } from "react";
import { ChevronLeft, Trash2, Plus } from "lucide-react";
import useExtensionStore from "@/stores/useExtensionStore";

export default function Setting() {
  const extensionState = useExtensionStore();
  const [autoExecution, setAutoExecution] = useState(false);
  const [denyList, setDenyList] = useState<string[]>(["rm"]);
  const [newCommand, setNewCommand] = useState("");
  const [showInput, setShowInput] = useState(false);

  const handleToggleAutoExecution = () => {
    setAutoExecution((prev) => !prev);
  };

  const handleAddCommand = () => {
    const trimmed = newCommand.trim();
    if (trimmed && !denyList.includes(trimmed)) {
      setDenyList((prev) => [...prev, trimmed]);
      setNewCommand("");
      setShowInput(false);
    }
  };

  const handleRemoveCommand = (cmd: string) => {
    setDenyList((prev) => prev.filter((c) => c !== cmd));
  };

  const handleBack = () => {
    extensionState.setViewType("profile");
  };

  return (
    <div className="flex h-screen flex-col justify-between">
      <div>
        <button
          className="ml-4 mt-2 flex h-[30px] w-[70px] items-center gap-2 rounded px-2 hover:bg-gray-500/20"
          onClick={handleBack}
        >
          <ChevronLeft />
          <span>Back</span>
        </button>

        <div className="mt-2 flex flex-col px-4">
          {/* Auto Execution Toggle */}
          <div className="mt-2 flex w-full items-center justify-between rounded border border-gray-500/10 bg-gray-500/20 p-2 text-sm">
            <div className="flex flex-col">
              <span className="font-medium opacity-70">
                Enable Terminal Auto-Execution
              </span>
              <p className="text-xs text-gray-400">
                Will auto-run terminal commands unless denied explicitly.
              </p>
            </div>
            <button
              onClick={handleToggleAutoExecution}
              className={`relative ml-4 h-5 w-10 flex-shrink-0 rounded-full transition-colors duration-200 ${
                autoExecution ? "bg-blue-500/70" : "bg-gray-400"
              }`}
            >
              <div
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-200 ${
                  autoExecution ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          {/* Deny List Section */}
          <div className="mt-2 flex w-full flex-col gap-2 rounded border border-gray-500/10 bg-gray-500/20 p-2 text-sm">
            <div>
              <span className="opacity-70">Deny List</span>
              <p className="mt-1 text-xs text-gray-400">
                Commands here won’t auto-execute and will always ask for
                permission.
              </p>
            </div>

            <ul className="space-y-1">
              {denyList.map((cmd, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between rounded border border-gray-300 px-3 py-1 text-sm"
                >
                  <span className="truncate">{cmd}</span>
                  <button
                    onClick={() => handleRemoveCommand(cmd)}
                    className="text-gray-500 transition hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {denyList.length === 0 && (
                <li className="text-xs text-gray-500">
                  No commands in deny list.
                </li>
              )}
            </ul>

            {!showInput && (
              <button
                onClick={() => setShowInput(true)}
                className="mt-1 flex items-center gap-2 self-start rounded border border-gray-400 px-3 py-1 text-sm transition hover:bg-gray-100"
              >
                <Plus className="h-4 w-4" />
                Add Command
              </button>
            )}

            {showInput && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCommand}
                  onChange={(e) => setNewCommand(e.target.value)}
                  placeholder="e.g., rm -rf /"
                  className="flex-1 rounded border border-gray-400 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
                />
                <button
                  onClick={handleAddCommand}
                  className="rounded border border-gray-400 px-3 py-1 text-sm transition hover:bg-gray-100"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setNewCommand("");
                    setShowInput(false);
                  }}
                  className="rounded border border-gray-400 px-3 py-1 text-sm  transition hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="px-4 pb-2 text-center text-xs text-gray-500">
        Version {extensionState.clientVersion}
      </div>
    </div>
  );
}
