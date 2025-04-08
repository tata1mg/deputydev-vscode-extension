import { UsageTrackingRequest } from "@/types";
import { SnippetReference } from "./CodeBlockStyle";

import {
  checkDiffApplicable,
  logToOutput,
  usageTracking,
  openFile,
  writeFile,
} from "@/commandApi";
import { useEffect, useState } from "react";

export interface CodeActionPanelProps {
  language: string;
  filepath?: string;
  is_diff?: boolean;
  content: string;
  inline: boolean;
  diff?: string | null; // ✅ added
  added_lines?: number | null; // ✅ updated to match payload
  removed_lines?: number | null; // ✅ added
  write_mode?: boolean;
}

export function CodeActionPanel({
  language,
  filepath,
  is_diff,
  content,
  inline,
  diff,
  added_lines,
  removed_lines,
}: CodeActionPanelProps) {
  const combined = { language, filepath, is_diff, content, inline };
  const [isApplicable, setIsApplicable] = useState<boolean | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const checkApplicability = async () => {
      if (is_diff && filepath && diff) {
        const applicable = await checkDiffApplicable({
          filePath: filepath,
          raw_diff: diff,
        });
        setIsApplicable(applicable);
      }
    };

    checkApplicability();
  }, [is_diff, filepath, diff]);
  const handleCopy = () => {
    const usageTrackingData: UsageTrackingRequest = {
      event: "copied",
      properties: {
        file_path: filepath || "",
        lines: content.split("\n").length,
      },
    };
    usageTracking(usageTrackingData);
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 200);
  };

  const handleUsageTracking = (filePath: string, diff: string) => {
    const lines = diff.split("\n");
    let numLines = 0;
    for (const line of lines) {
      let current_line = line.trim();
      if (
        !current_line.startsWith("++") &&
        !current_line.startsWith("--") &&
        current_line.length > 0
      ) {
        if (line.startsWith("+") || line.startsWith("-")) {
          numLines++;
        }
      }
    }
    const usageTrackingData: UsageTrackingRequest = {
      event: "generated",
      properties: {
        file_path: filepath || "",
        lines: numLines,
      },
    };
    usageTracking(usageTrackingData);
  };

  const handleApply = (filePath: string, diff: string) => {
    setIsApplying(true);
    handleUsageTracking(filePath, diff);
    writeFile({ filePath: filePath, raw_diff: diff });
    setTimeout(() => {
      setIsApplying(false);
      alert("Apply diff logic to be implemented.");
    }, 500);
  };

  const handleInsert = () => {
    // console.log("Insert clicked:", content);
    alert("Insert logic to be implemented.");
  };

  const snippet = {
    language,
    path: filepath,
    is_diff,
    content,
  };

  const isApplyDisabled = !diff;

  // Extract the filename from the full path
  const filename = filepath ? filepath.split("/").pop() : "";

  return (
    <div className="w-full overflow-hidden rounded-md border border-gray-500 mt-3 bg-gray-900">
      <div className="flex h-8 min-w-0 items-center justify-between gap-2 border-b border-gray-500 bg-neutral-700 px-3 py-1 text-xs text-neutral-300">
        {is_diff && filepath && diff && isApplicable ? (
          <div className="flex min-w-0 items-center gap-1">
            <span>Edit:</span>
            <button
              className="overflow-hidden truncate text-ellipsis rounded px-1 text-right font-medium transition-colors hover:bg-white/10"
              onClick={() => filepath && openFile(filepath)}
              title={filepath}
            >
              {filename}
            </button>

            <span className="text-green-400">+{added_lines || 0}</span>
            <span className="text-red-400">-{removed_lines || 0}</span>
          </div>
        ) : (
          <span>{language || "plaintext"}</span>
        )}

        <div className="flex gap-2">
          <button
            className="text-xs text-neutral-300 transition-transform duration-150 hover:text-white active:scale-90"
            onClick={handleCopy}
          >
            {copied ? "Copied!" : "Copy"}
          </button>

          {
            is_diff && filepath && diff && isApplicable ? (
              <button
                className={`text-xs text-neutral-300 transition-transform duration-150 hover:text-white active:scale-90 ${
                  isApplyDisabled ? "cursor-not-allowed opacity-50" : ""
                }`}
                onClick={() => {
                  if (filepath && diff) {
                    handleApply(filepath, diff);
                  } else {
                    alert("File path or diff is missing!");
                  }
                }}
                disabled={isApplyDisabled}
              >
                {isApplying ? "Applying..." : "Apply"}
              </button>
            ) : null

            // (
            //   <button
            //     className="text-neutral-300 hover:text-white text-xs active:scale-90 transition-transform duration-150"
            //     onClick={handleInsert}
            //   >
            //     Insert
            //   </button>
            // )
          }
        </div>
      </div>
      <SnippetReference snippet={combined} />
    </div>
  );
}
