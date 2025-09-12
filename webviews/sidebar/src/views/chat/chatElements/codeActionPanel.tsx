import { UsageTrackingRequestFromSidebar } from '@/types';
import { SnippetReference } from './CodeBlockStyle';

import {
  checkDiffApplicable,
  usageTracking,
  openFile,
  writeFile,
  checkFileExists,
} from '@/commandApi';
import { useEffect, useState } from 'react';
import { useChatSettingStore } from '@/stores/chatStore';

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
  isStreaming: boolean;
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
  isStreaming,
}: CodeActionPanelProps) {
  const combined = { language, filepath, is_diff, content, inline };
  const [isApplicable, setIsApplicable] = useState<boolean | null>(null);
  const [isOpenable, setIsOpenable] = useState<boolean | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [copied, setCopied] = useState(false);
  const showApplyButton = is_diff && filepath && diff && isApplicable;
  const [copyCooldown, setCopyCooldown] = useState(false);

  useEffect(() => {
    const checkApplicability = async () => {
      if (is_diff && filepath && diff) {
        const { diffApplySuccess, addedLines, removedLines } = await checkDiffApplicable({
          filePath: filepath,
          raw_diff: diff,
        });
        setIsApplicable(diffApplySuccess);
      }
    };

    checkApplicability();
  }, [is_diff, filepath, diff]);

  // This effect checks if the file is openable
  useEffect(() => {
    const checkFileIsOpenable = async () => {
      if (filepath) {
        // Replace with your own logic to check if file can be opened
        const openable = await checkFileExists(filepath);
        setIsOpenable(openable);
      }
    };

    checkFileIsOpenable();
  }, [filepath]);

  useEffect(() => {
    if (is_diff && isStreaming) {
      const usageTrackingData: UsageTrackingRequestFromSidebar = {
        eventType: 'GENERATED',
        eventData: {
          source: getSource(),
          file_path: filepath || '',
          lines: Math.abs(added_lines || 0) + Math.abs(removed_lines || 0),
        },
      };
      usageTracking(usageTrackingData);
    }
  }, [is_diff, isStreaming, filepath, added_lines, removed_lines]);

  useEffect(() => {
    if (
      is_diff && // must be a diff
      isApplicable === false && // not applicable
      isStreaming // streaming
    ) {
      const usageTrackingData: UsageTrackingRequestFromSidebar = {
        eventType: 'INVALID_DIFF',
        eventData: {
          source: getSource(),
          file_path: filepath || '',
          lines: Math.abs(added_lines || 0) + Math.abs(removed_lines || 0),
        },
      };
      usageTracking(usageTrackingData);
    }
  }, [isApplicable, isStreaming, is_diff, filepath, added_lines, removed_lines]);

  const getSource = () => {
    const chatSource = useChatSettingStore.getState().chatSource;
    const chatType = useChatSettingStore.getState().chatType;
    if (chatSource === 'inline-chat') {
      if (chatType === 'write') {
        return 'inline-chat-act';
      }
      return 'inline-chat';
    } else {
      if (chatType === 'write') {
        return 'act';
      }
      return 'chat';
    }
  };

  const getLineCountFromContent = (content: string) => {
    const lines = content.split('\n');
    let line_count = lines.length;
    if (lines[line_count - 1] === '') {
      line_count--;
    }
    if (lines[0] === '') {
      line_count--;
    }
    return line_count;
  };

  const handleCopy = () => {
    if (!copyCooldown) {
      const usageTrackingData: UsageTrackingRequestFromSidebar = {
        eventType: 'COPIED',
        eventData: {
          file_path: filepath || '',
          source: getSource(),
          lines: showApplyButton
            ? Math.abs(added_lines || 0) + Math.abs(removed_lines || 0)
            : getLineCountFromContent(content),
        },
      };
      usageTracking(usageTrackingData);

      // Start cooldown
      setCopyCooldown(true);
      setTimeout(() => setCopyCooldown(false), 10000); // 10 sec cooldown
    }

    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 200);
  };

  const handleApply = (filePath: string, diff: string) => {
    // Set the applying state to true, likely to indicate that an action is in progress
    setIsApplying(true);

    // Create a usage tracking data object to log the application event
    const usageTrackingData: UsageTrackingRequestFromSidebar = {
      // Specify the event type as 'applied'
      eventType: 'APPLIED',
      eventData: {
        // Get the source of the application (probably a function that returns the source)
        source: getSource(),
        // Set the file path, using the provided filepath or an empty string if not available
        file_path: filepath || '',
        // Calculate the total number of lines changed
        // This is done by adding the absolute values of added and removed lines
        // The `|| 0` ensures that if either value is undefined, it defaults to 0
        lines: Math.abs(added_lines || 0) + Math.abs(removed_lines || 0),
      },
    };

    // Note: This usage tracking data is likely sent to an analytics service
    // to monitor how the application is being used.
    usageTracking(usageTrackingData);
    writeFile({
      filePath: filePath,
      raw_diff: diff,
      write_mode: useChatSettingStore.getState().chatType === 'write',
      is_inline: useChatSettingStore.getState().chatSource === 'inline-chat',
    });
    setTimeout(() => {
      setIsApplying(false);
      alert('Apply diff logic to be implemented.');
    }, 500);
  };

  const handleInsert = () => {
    // console.log("Insert clicked:", content);
    alert('Insert logic to be implemented.');
  };

  const snippet = {
    language,
    path: filepath,
    is_diff,
    content,
  };

  const isApplyDisabled = !diff;

  // Extract the filename from the full path
  const filename = filepath ? (filepath.split(/[/\\]/).pop() ?? '') : '';

  return (
    <div className="mt-3 w-full overflow-hidden rounded-md border border-gray-500 bg-gray-900">
      <div className="flex h-8 min-w-0 items-center justify-between gap-2 border-b border-gray-500 bg-neutral-700 px-3 py-1 text-xs text-neutral-300">
        {is_diff && filepath && diff && isApplicable ? (
          // CASE 1: Diff with file info and applicable
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
        ) : filepath && isOpenable ? (
          // CASE 2: Just file info, openable
          <button
            className="overflow-hidden truncate text-ellipsis rounded px-1 text-right font-medium transition-colors hover:bg-white/10"
            onClick={() => filepath && openFile(filepath)}
            title={filepath}
          >
            {filename}
          </button>
        ) : (
          // CASE 3: Fallback to language
          <span>{language || 'plaintext'}</span>
        )}

        <div className="flex gap-2">
          <button
            className="text-xs text-neutral-300 transition-transform duration-150 hover:text-white active:scale-90"
            onClick={handleCopy}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>

          {
            showApplyButton ? (
              <button
                className={`text-xs text-neutral-300 transition-transform duration-150 hover:text-white active:scale-90 ${
                  isApplyDisabled ? 'cursor-not-allowed opacity-50' : ''
                }`}
                onClick={() => {
                  if (filepath && diff) {
                    handleApply(filepath, diff);
                  } else {
                    alert('File path or diff is missing!');
                  }
                }}
                disabled={isApplyDisabled}
              >
                {isApplying ? 'Applying...' : 'Apply'}
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
