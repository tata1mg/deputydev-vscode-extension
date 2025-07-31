import React, { useEffect, useState, useMemo, useRef } from 'react';
import { RotateCw } from 'lucide-react';
import { useChatSettingStore, useChatStore } from '@/stores/chatStore';

interface TokenLimitExceededPanelProps {
  currentModel: string;
  query: string;
  errorMessage: string;
  retry?: boolean;
  payloadToRetry?: unknown;
  betterModels?: Array<{
    id: number;
    display_name: string;
    name: string;
    input_token_limit: number;
  }>;
}

export function TokenLimitExceededPanel({
  currentModel,
  query,
  errorMessage,
  retry = false,
  payloadToRetry,
  betterModels = [],
}: Readonly<TokenLimitExceededPanelProps>): React.JSX.Element {
  const firstModelName = betterModels?.[0]?.name ?? '';
  const { llmModels } = useChatStore();
  const [selectedModel, setSelectedModel] = useState(firstModelName);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState('');
  const [autoRetryCountdown, setAutoRetryCountdown] = useState(60);
  const [autoRetryInProgress, setAutoRetryInProgress] = useState(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const autoRetryRef = useRef<NodeJS.Timeout | null>(null);

  // Use better models from error payload
  const modelsWithLimits = useMemo(() => {
    // Only use betterModels provided from error payload
    if (betterModels && betterModels.length > 0) {
      return betterModels.map((model) => ({
        ...model,
        tokenLimit: model.input_token_limit,
        hasHigherCapacity: true, // All models in betterModels list have higher capacity
      }));
    }

    // Return empty array if no better models available
    return [];
  }, [betterModels]);

  // Reset states when current model changes (indicates a new error or retry)
  useEffect(() => {
    setSelectedModel(firstModelName);
    setIsRetrying(false);
    setRetryMessage('');
    setAutoRetryCountdown(60);
    setAutoRetryInProgress(false);

    // Clear any existing timers
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    if (autoRetryRef.current) {
      clearTimeout(autoRetryRef.current);
    }
  }, [currentModel, errorMessage]);

  // Auto-retry logic with highest token model
  useEffect(() => {
    if (!retry || !payloadToRetry) return;

    let highestTokenModel = modelsWithLimits.find(
      (m) => m.name === 'GEMINI_2_POINT_5_PRO' && m.hasHigherCapacity
    );

    if (!highestTokenModel) {
      highestTokenModel = modelsWithLimits.find((m) => m.hasHigherCapacity);
    }

    if (!highestTokenModel) return;

    setAutoRetryInProgress(true);
    setAutoRetryCountdown(60);

    // Start countdown
    countdownRef.current = setInterval(() => {
      setAutoRetryCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto retry after 60 seconds
    autoRetryRef.current = setTimeout(async () => {
      setAutoRetryInProgress(false);
      setSelectedModel(highestTokenModel.name);
      await performRetry(highestTokenModel.name);
    }, 60000);

    // Cleanup function
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      if (autoRetryRef.current) {
        clearTimeout(autoRetryRef.current);
      }
    };
  }, [retry, payloadToRetry, modelsWithLimits]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      if (autoRetryRef.current) {
        clearTimeout(autoRetryRef.current);
      }
    };
  }, []);

  // Find current model display name
  const currentModelDisplay =
    llmModels.find((m) => m.name === currentModel)?.display_name || currentModel;

  // Function to handle both manual and auto retry
  async function performRetry(modelToUse: string) {
    if (!retry || !payloadToRetry || isRetrying) return;

    setIsRetrying(true);
    setRetryMessage('');

    const payload = payloadToRetry as Record<string, unknown>;
    const selectedModelDisplay =
      llmModels.find((m) => m.name === modelToUse)?.display_name || modelToUse;

    try {
      console.log('Starting fresh query with model:', modelToUse);

      // Set the new model as active
      useChatSettingStore.setState({ activeModel: modelToUse });

      // Small delay to ensure state is updated
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Extract information from the original payload to create a fresh query
      const originalQuery = query;
      const originalReferences = (payload.referenceList as any[]) || [];
      const originalS3References = Array.isArray(payload.attachments)
        ? payload.attachments.map((att: any) => ({ key: att.attachment_id }))
        : [];

      // Get fresh instance of sendChatMessage and send as a new message (not retry)
      const { sendChatMessage } = useChatStore.getState();
      await sendChatMessage(
        originalQuery,
        originalReferences,
        () => {},
        originalS3References,
        false, // Not a retry - this is a fresh message
        undefined // No retry payload needed
      );

      setRetryMessage(`Started fresh query with ${selectedModelDisplay}.`);
    } catch (error) {
      console.error('Fresh query failed:', error);
      setRetryMessage('Failed to start fresh query. Please try again or start a new chat.');
    } finally {
      setIsRetrying(false);
    }
  }

  async function handleRetry() {
    if (selectedModel === currentModel) return;

    // Cancel auto-retry if manual retry is triggered
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    if (autoRetryRef.current) {
      clearTimeout(autoRetryRef.current);
    }
    setAutoRetryInProgress(false);

    await performRetry(selectedModel);
  }

  function handleModelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const model = e.target.value;
    setSelectedModel(model);
  }

  return (
    <div className="mt-1 flex w-full items-center justify-center">
      <div
        className="w-full max-w-md rounded px-2 py-2 text-xs shadow-sm"
        style={{
          background: 'var(--vscode-editorWidget-background)',
          border: '1px solid var(--vscode-inputValidation-errorBorder)',
        }}
      >
        {/* Show retry message */}
        {retryMessage && (
          <div
            className="mb-2 flex items-center gap-2 rounded px-2 py-1"
            style={{
              background: retryMessage.includes('failed')
                ? 'var(--vscode-inputValidation-errorBackground)'
                : 'var(--vscode-inputValidation-infoBackground)',
              border: `1px solid ${
                retryMessage.includes('failed')
                  ? 'var(--vscode-inputValidation-errorBorder)'
                  : 'var(--vscode-inputValidation-infoBorder)'
              }`,
            }}
          >
            <span
              className="text-xs"
              style={{
                color: retryMessage.includes('failed')
                  ? 'var(--vscode-inputValidation-errorForeground)'
                  : 'var(--vscode-inputValidation-infoForeground)',
              }}
            >
              {retryMessage}
            </span>
          </div>
        )}

        {/* Icon and title */}
        <div
          className="mb-2 flex items-center justify-center gap-1 rounded-t px-2 py-1"
          style={{
            color: 'var(--vscode-inputValidation-errorForeground)',
            background: 'var(--vscode-inputValidation-errorBackground)',
            borderColor: 'var(--vscode-inputValidation-errorBorder)',
          }}
        >
          <span className="text-xs font-medium">Input Too Large</span>
        </div>

        {/* Auto-retry countdown*/}
        {autoRetryInProgress &&
          modelsWithLimits.some((m) => m.hasHigherCapacity) &&
          (() => {
            // Prioritize Gemini 2.5 Pro if available and has higher capacity
            let highestCapacityModel = modelsWithLimits.find(
              (m) => m.name === 'GEMINI_2_POINT_5_PRO' && m.hasHigherCapacity
            );

            // If Gemini 2.5 Pro is not available or doesn't have higher capacity, find the model with highest token limit
            if (!highestCapacityModel) {
              highestCapacityModel = modelsWithLimits.find((m) => m.hasHigherCapacity);
            }

            return (
              <div className="mb-2">
                {/* Progress bar */}
                <div
                  className="mb-2 h-1 w-full overflow-hidden rounded"
                  style={{ background: 'var(--vscode-inputValidation-errorBackground)' }}
                >
                  <div
                    className="h-full transition-[width] duration-1000 ease-linear"
                    style={{
                      width: `${((60 - autoRetryCountdown) / 60) * 100}%`,
                      background: 'var(--vscode-inputValidation-errorBorder)',
                    }}
                  />
                </div>

                {/* Countdown text */}
                <div
                  className="mb-2 w-full text-center text-xs font-semibold"
                  style={{
                    color: 'var(--vscode-descriptionForeground)',
                  }}
                >
                  Auto-retrying with {highestCapacityModel?.display_name} in {autoRetryCountdown}s
                </div>
              </div>
            );
          })()}

        {/* Main error message */}
        <div className="mb-2 text-center">
          <span
            className="text-xs"
            style={{ color: 'var(--vscode-inputValidation-errorForeground)' }}
          >
            {errorMessage.replace(currentModel, currentModelDisplay)}
          </span>
        </div>

        {/* Compact suggestions */}
        <div className="mb-2 text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          <div className="mb-1 text-xs font-medium">To proceed, you can try the following:</div>
          <ul className="space-y-0.5 text-xs">
            <li>• Reduce the number of selected files or folders</li>
            <li>• Start a new chat</li>
            <li>• Switch to a model with a higher context window</li>
          </ul>
        </div>

        {/* Model selector + retry */}
        {modelsWithLimits.length > 0 && (
          <div className="flex w-full items-center gap-2">
            <select
              className="h-6 min-w-[100px] flex-1 rounded border px-1 text-xs focus:outline-none"
              style={{
                borderColor: 'var(--vscode-input-border)',
                background: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
              }}
              value={selectedModel}
              onChange={handleModelChange}
              disabled={isRetrying}
            >
              {modelsWithLimits.map((model) => (
                <option key={model.name} value={model.name}>
                  {model.display_name}
                  {model.hasHigherCapacity ? ' (Higher context window)' : ''}
                </option>
              ))}
            </select>

            {retry && payloadToRetry ? (
              <button
                className="rounded border bg-transparent px-2 py-1 text-xs hover:opacity-80 focus:outline-none disabled:opacity-50"
                style={{
                  borderColor: 'var(--vscode-button-border)',
                  color: 'var(--vscode-button-foreground)',
                  background: 'var(--vscode-button-background)',
                }}
                onClick={handleRetry}
                disabled={isRetrying || selectedModel === currentModel}
                title={
                  selectedModel === currentModel
                    ? 'Select a different model to retry'
                    : 'Retry with selected model'
                }
              >
                {isRetrying ? (
                  'Sending...'
                ) : (
                  <span className="flex items-center gap-1">
                    <RotateCw className="h-3 w-3" />
                    Retry
                  </span>
                )}
              </button>
            ) : null}
          </div>
        )}

        {/* Show message when no higher capacity models are available */}
        {!modelsWithLimits.some((m) => m.hasHigherCapacity) && (
          <div className="py-1 text-center">
            <span className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
              No higher capacity models available. Try reducing your input size or opening a new
              chat.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
