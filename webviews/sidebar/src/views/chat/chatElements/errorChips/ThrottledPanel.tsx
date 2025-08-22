import { useChatStore } from '@/stores/chatStore';
import { useLLMModelStore } from '@/stores/llmModelStore';
import { RotateCw } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

/**
 * ChatMessage: UI for throttling errors with retry-after, message, retry button, model switcher, and progress bar.
 */
interface ThrottledChatMessageProps {
  retryAfterSeconds?: number;
  currentModel: string | undefined;
  errorMessage: string;
  retry: boolean;
  payloadToRetry: unknown;
}

export function ThrottledChatMessage({
  retryAfterSeconds = 60,
  currentModel,
  errorMessage,
  retry,
  payloadToRetry,
}: ThrottledChatMessageProps) {
  const { sendChatMessage } = useChatStore();
  const { llmModels, setActiveModel } = useLLMModelStore();
  const [secondsLeft, setSecondsLeft] = useState(retryAfterSeconds);
  const [selectedModel, setSelectedModel] = useState(currentModel);
  // Stable reference for progress
  const totalSeconds = useMemo(() => retryAfterSeconds, [retryAfterSeconds]);
  // Keep dropdown in sync if model changes
  useEffect(() => {
    setSelectedModel(currentModel);
  }, [currentModel]);

  // Countdown
  useEffect(() => {
    setSecondsLeft(retryAfterSeconds);
    if (retryAfterSeconds > 0) {
      const interval = setInterval(() => {
        setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [retryAfterSeconds]);

  // Auto-retry on timeout
  useEffect(() => {
    if (secondsLeft === 0 && retry) {
      handleRetry();
    }
    // eslint-disable-next-line
  }, [secondsLeft, retry]);

  // Only show non-throttled models
  const availableModels = llmModels.filter((m) => m.name !== currentModel);

  const formatTime = (secs: number) => {
    if (!secs || secs <= 0) return 'Retrying...';
    if (secs < 60) return `Retrying in ${secs} seconds.`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (s === 0) {
      return `Retrying in ${m} minute${m > 1 ? 's' : ''}.`;
    }
    return `Retrying in ${m}m ${s}s.`;
  };

  const progressPct = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0;

  function handleRetry() {
    const newPayload = {
      ...(payloadToRetry as Record<string, unknown>),
      llm_model: selectedModel,
    };
    sendChatMessage('retry', [], undefined, true, newPayload, undefined, 'THROTTLED');
  }

  function handleModelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const model = e.target.value;
    setSelectedModel(model);
    setActiveModel(model);
  }

  return (
    <div className="mt-2 flex w-full items-center justify-center">
      <div
        className="w-full rounded px-2 py-2 text-sm shadow-md"
        style={{
          background: 'var(--vscode-editorWidget-background)',
          border: '1px solid var(--vscode-inputValidation-warningBorder)',
        }}
      >
        {/* Progress bar */}
        <div
          className="mb-2 h-1 w-full overflow-hidden rounded"
          style={{ background: 'var(--vscode-inputValidation-warningBackground)' }}
        >
          <div
            className="h-full transition-[width] duration-1000 ease-linear"
            style={{
              width: `${progressPct}%`,
              background: 'var(--vscode-inputValidation-warningBorder)',
            }}
          />
        </div>

        {/* Top strip: Throttling time */}
        <div
          className="w-full rounded-t border-b px-3 py-1 text-center text-xs font-semibold"
          style={{
            color: 'var(--vscode-inputValidation-warningForeground)',
            background: 'var(--vscode-inputValidation-warningBackground)',
            borderColor: 'var(--vscode-inputValidation-warningBorder)',
          }}
        >
          {formatTime(secondsLeft)}
        </div>

        {/* Main error message */}
        <div className="mb-4 mt-3 flex items-center justify-center">
          <span
            className="font-medium"
            style={{ color: 'var(--vscode-inputValidation-warningForeground)' }}
          >
            {errorMessage ||
              'This chat is currently being throttled. You can wait, or switch to a different model.'}
          </span>
        </div>

        {/* Model selector + retry */}
        <div className="mt-2 flex w-full justify-center">
          <div className="flex w-full max-w-[400px] flex-row items-center gap-2">
            <select
              className="h-7 min-w-[120px] max-w-full flex-1 rounded border px-2 text-xs focus:outline-none"
              style={{
                borderColor: 'var(--vscode-input-border)',
                background: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                height: 28,
              }}
              value={selectedModel}
              onChange={handleModelChange}
            >
              {availableModels.map((model) => (
                <option key={model.name} value={model.name}>
                  {model.display_name}
                </option>
              ))}
            </select>

            <button
              className="flex items-center justify-center rounded border bg-transparent focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                width: 28,
                height: 28,
                borderColor: 'var(--vscode-button-border)',
                color: 'var(--vscode-button-foreground)',
              }}
              onClick={handleRetry}
              title="Retry"
            >
              <RotateCw className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
