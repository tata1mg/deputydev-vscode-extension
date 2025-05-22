import { UsageTrackingRequest } from '@/types';
import { SnippetReference } from './CodeBlockStyle';

import { checkDiffApplicable, usageTracking, openFile, writeFile } from '@/commandApi';
import { useEffect, useState } from 'react';
import { useChatSettingStore } from '@/stores/chatStore';
import { usePartialFileDiff } from '@/utils/usePartialFileDiff';
import { getLanguageInfoByExtension } from '@/utils/getLanguageByExtension';

export interface CodeActionPanelFileEditProps {
  isToolUse: boolean;
  content: string;
  status: string;
  write_mode: boolean;
  isStreaming?: boolean;
  filepath?: string;
  streamComplete?: boolean;
}

export function CodeActionPanelFileEdit({
  isToolUse,
  content,
  status,
  write_mode,
  isStreaming,
  filepath = '',
  streamComplete = false,
}: CodeActionPanelFileEditProps) {
  // ───────────────────────────────────────────────────────────────────────────
  // 1) derive path/diff/complete
  let path: string | undefined;
  let diff: string | undefined;
  let parseComplete: boolean | undefined;

  if (isToolUse) {
    ({ path, diff, complete: parseComplete } = usePartialFileDiff(content));
  } else {
    path = filepath;
    diff = content;
    parseComplete = false;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2) filename + language (for syntax highlighting, etc)
  const filename = path?.split('/').pop() ?? '';
  const ext = filename.split('.').pop() ?? '';
  const { p: language } = getLanguageInfoByExtension(ext);

  // ───────────────────────────────────────────────────────────────────────────
  // 3) component state
  const [isApplicable, setIsApplicable] = useState<boolean | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyCooldown, setCopyCooldown] = useState(false);

  // keep track of the latest diff stats
  const [localAdded, setLocalAdded] = useState<number>(0);
  const [localRemoved, setLocalRemoved] = useState<number>(0);

  const showApplyButton = Boolean(path && diff && isApplicable);

  // ───────────────────────────────────────────────────────────────────────────
  // 4) check applicability once parsing or streaming finishes
  useEffect(() => {
    const ready = streamComplete && !!path && !!diff;
    if (!ready) {
      setIsApplicable(null);
      return;
    }
    (async () => {
      try {
        const { diffApplySuccess, addedLines, removedLines } = await checkDiffApplicable({
          filePath: path!,
          raw_diff: diff!,
        });

        setIsApplicable(diffApplySuccess);
        setLocalAdded(addedLines);
        setLocalRemoved(removedLines);
      } catch (err) {
        setIsApplicable(false);
      }
    })();
  }, [parseComplete, streamComplete, path, diff]);
  // ───────────────────────────────────────────────────────────────────────────
  // 5) track “generated” once the diff is live and applicable
  useEffect(() => {
    const ready = streamComplete && isApplicable;
    if (!ready) return;

    usageTracking({
      event: 'generated',
      properties: {
        source: getSource(),
        file_path: path || '',
        lines: Math.abs(localAdded) + Math.abs(localRemoved),
      },
    });
  }, [parseComplete, streamComplete, isApplicable, path, localAdded, localRemoved]);

  // ───────────────────────────────────────────────────────────────────────────
  // Helpers
  const getSource = () => {
    const { chatSource, chatType } = useChatSettingStore.getState();
    if (chatSource === 'inline-chat') {
      return chatType === 'write' ? 'inline-chat-act' : 'inline-chat';
    }
    return chatType === 'write' ? 'act' : 'chat';
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 6) copy-to-clipboard + tracking + cooldown todo
  const handleCopy = () => {
    usageTracking({
      event: 'copied',
      properties: {
        file_path: path || '',
        source: getSource(),
        lines: showApplyButton ? Math.abs(localAdded) + Math.abs(localRemoved) : 0,
      },
    });

    setCopyCooldown(true);
    setTimeout(() => setCopyCooldown(false), 10_000);

    navigator.clipboard.writeText(diff ?? content);
    setCopied(true);
    setTimeout(() => setCopied(false), 200);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 7) apply-button handler
  const handleApply = () => {
    if (!path || !diff) return;
    setIsApplying(true);

    usageTracking({
      event: 'applied',
      properties: {
        source: getSource(),
        file_path: path,
        lines: Math.abs(localAdded) + Math.abs(localRemoved),
      },
    });

    writeFile({
      filePath: path,
      raw_diff: diff,
      write_mode,
      is_inline: useChatSettingStore.getState().chatSource === 'inline-chat',
    }).finally(() => {
      setIsApplying(false);
      // TODO: replace with real confirmation UI
      alert('Apply diff logic to be implemented.');
    });
  };

  const handleInsert = () => {
    // TODO: implement insert logic
    alert('Insert logic to be implemented.');
  };

  const isApplyDisabled = !diff || !path || !(parseComplete || streamComplete) || !isApplicable;

  // Extract the filename from the full path

  return (
    <div className="mt-3 w-full overflow-hidden rounded-md border border-gray-500 bg-gray-900">
      <div className="flex h-8 min-w-0 items-center justify-between gap-2 border-b border-gray-500 bg-neutral-700 px-3 py-1 text-xs text-neutral-300">
        {path && diff && isApplicable ? (
          <div className="flex min-w-0 items-center gap-1">
            <span>Edit:</span>
            <button
              className="overflow-hidden truncate text-ellipsis rounded px-1 text-right font-medium transition-colors hover:bg-white/10"
              onClick={() => path && openFile(path)}
              title={path}
            >
              {filename}
            </button>

            <span className="text-green-400">+{localAdded}</span>
            <span className="text-red-400">-{localRemoved}</span>
          </div>
        ) : (
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
                  if (path && diff) {
                    handleApply();
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
      {diff && <SnippetReference snippet={{ content: diff, language }} />}
    </div>
  );
}
