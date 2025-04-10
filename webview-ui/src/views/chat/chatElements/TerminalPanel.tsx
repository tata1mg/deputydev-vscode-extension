import {
  checkDiffApplicable,
  usageTracking,
  openFile,
  writeFile,
  acceptTerminalCommand,
  rejectTerminalCommand,
} from "@/commandApi";
import { useEffect, useState } from "react";
import { parse, Allow } from "partial-json";
import { useChatSettingStore } from "@/stores/chatStore";
import { TerminalPanelProps } from "@/types";

export function TerminalPanel({
  content,
  terminal_output,
  status,
  terminal_approval_required,
}: TerminalPanelProps) {
  const [copied, setCopied] = useState(false);

  // Use partial-json to safely parse possibly incomplete JSON
  let command = "";
  let requiresApproval = false;

  try {
    const parsed = parse(content, Allow.STR | Allow.OBJ);
    if (parsed && typeof parsed === "object") {
      command = parsed.command || "";
      requiresApproval = parsed.requires_approval || false;
    }
  } catch (e) {
    console.warn("TerminalPanel: content still incomplete or malformed", content);
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  const handleExecution = () => {
    console.log("Execute command:", command, "Requires approval:", requiresApproval);
    alert("Execution logic not yet implemented");
  };

  const handleApprove = () => {
    console.log("Approved command:", command);
    acceptTerminalCommand(); // Call your actual API
  };

  const handleReject = () => {
    console.log("Rejected command:", command);
    rejectTerminalCommand(); // Call your actual API
  };

  return (
    <div className="w-full overflow-hidden rounded-md border border-gray-600 mt-4 bg-zinc-900 text-white shadow">
      <div className="flex h-9 items-center justify-between border-b border-zinc-700 bg-zinc-800 px-3 text-xs text-neutral-300">
        <span>Terminal Command</span>
        <div className="flex gap-2">
          <button
            className="hover:text-white transition duration-150 text-xs active:scale-95"
            onClick={handleCopy}
            disabled={!command}
          >
            {copied ? "Copied!" : "Copy"}
          </button>

          {terminal_approval_required ? (
            <>
              <button
                className="hover:text-white text-emerald-400 transition duration-150 text-xs active:scale-95"
                onClick={handleApprove}
                disabled={!command}
              >
                Approve
              </button>
              <button
                className="hover:text-white text-red-400 transition duration-150 text-xs active:scale-95"
                onClick={handleReject}
                disabled={!command}
              >
                Reject
              </button>
            </>
          ) : (
            <button
              className="hover:text-white transition duration-150 text-xs active:scale-95"
              onClick={handleExecution}
              disabled={!command}
            >
              Execute
            </button>
          )}
        </div>
      </div>

      {/* Scrollable command output */}
      <div className="bg-zinc-950 px-4 py-3 font-mono text-sm text-green-400 whitespace-pre-wrap break-words overflow-auto max-h-40">
        <pre>{command || "⏳ Streaming command..."}</pre>
      </div>

      {/* Show explanation if approval is required */}
      {terminal_approval_required && (
        <div className="px-4 pb-2 text-xs text-yellow-400 italic">
          ⚠️ This command requires your approval before it can be executed.
        </div>
      )}

      {/* Optional status */}
      {status && (
        <div className="px-4 pb-1 text-xs text-zinc-400">
          <strong>Status:</strong> {status}
        </div>
      )}

      {/* Scrollable terminal output */}
      {terminal_output && (
        <div className="bg-black px-4 py-3 font-mono text-xs text-green-400 overflow-auto max-h-64 whitespace-pre-wrap">
          {terminal_output}
        </div>
      )}
    </div>
  );
}
