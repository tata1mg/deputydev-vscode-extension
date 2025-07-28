import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useChatSettingStore, useChatStore } from '@/stores/chatStore';

interface TokenLimitExceededPanelProps {
  currentModel: string;
  query: string;
  errorMessage: string;
  retry?: boolean;
  payloadToRetry?: unknown;
}

export function TokenLimitExceededPanel({
  currentModel,
  query,
  errorMessage,
  retry = false,
  payloadToRetry,
}: TokenLimitExceededPanelProps): React.JSX.Element {
  const { llmModels } = useChatStore();
  const [selectedModel, setSelectedModel] = useState(currentModel);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState('');
  const [autoRetryCountdown, setAutoRetryCountdown] = useState(60);
  const [autoRetryInProgress, setAutoRetryInProgress] = useState(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const autoRetryRef = useRef<NodeJS.Timeout | null>(null);
  
  // Sort models by token limits (highest first) - show all models
  const modelsWithLimits = useMemo(() => {
    const currentModelData = llmModels.find((m) => m.name === currentModel);
    const currentModelLimit = currentModelData?.input_token_limit || 100000;
    
    return llmModels
      .filter((m) => m.name !== currentModel)
      .map((model) => ({
        ...model,
        tokenLimit: model.input_token_limit || 100000,
        hasHigherCapacity: (model.input_token_limit || 100000) > currentModelLimit,
      }))
      .sort((a, b) => b.tokenLimit - a.tokenLimit);
  }, [llmModels, currentModel]);

  // Reset states when current model changes (indicates a new error or retry)
  useEffect(() => {
    setSelectedModel(currentModel);
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

    // Find the model with highest token limit that has higher capacity
    const highestTokenModel = modelsWithLimits.find(m => m.hasHigherCapacity);
    
    if (!highestTokenModel) return;

    setAutoRetryInProgress(true);
    setAutoRetryCountdown(60);

    // Start countdown
    countdownRef.current = setInterval(() => {
      setAutoRetryCountdown(prev => {
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
  const currentModelDisplay = llmModels.find((m) => m.name === currentModel)?.display_name || currentModel;

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
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Extract information from the original payload to create a fresh query
      const originalQuery = query;
      const originalReferences = payload.referenceList as any[] || [];
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
          <div className="mb-2 flex items-center gap-2 rounded px-2 py-1" 
               style={{ 
                 background: retryMessage.includes('failed') 
                   ? 'var(--vscode-inputValidation-errorBackground)'
                   : 'var(--vscode-inputValidation-infoBackground)',
                 border: `1px solid ${retryMessage.includes('failed') 
                   ? 'var(--vscode-inputValidation-errorBorder)'
                   : 'var(--vscode-inputValidation-infoBorder)'}` 
               }}>
            <span className="text-xs" style={{ 
              color: retryMessage.includes('failed')
                ? 'var(--vscode-inputValidation-errorForeground)'
                : 'var(--vscode-inputValidation-infoForeground)' 
            }}>
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
          <span className="font-medium text-xs">Input Too Large</span>
        </div>

        {/* Auto-retry countdown*/}
        {autoRetryInProgress && modelsWithLimits.some(m => m.hasHigherCapacity) && (() => {
          const highestCapacityModel = modelsWithLimits.find(m => m.hasHigherCapacity);
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
                className="w-full text-center text-xs font-semibold mb-2"
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
          <div className="mb-1 font-medium text-xs">Try:</div>
          <ul className="text-xs space-y-0.5">
            <li>• Reduce selected code/files</li>
            <li>• Shorten your query</li>
            {modelsWithLimits.some(m => m.hasHigherCapacity) && (
              <li>• Send fresh query with higher capacity model</li>
            )}
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
              <option value={currentModel}>{currentModelDisplay} (Current)</option>
              {modelsWithLimits.map((model) => (
                <option key={model.name} value={model.name}>
                  {model.display_name}{model.hasHigherCapacity ? ' (Higher capacity)' : ''}
                </option>
              ))}
            </select>

            {retry && payloadToRetry ? (
              <button
                className="rounded border bg-transparent px-2 py-1 text-xs focus:outline-none hover:opacity-80 disabled:opacity-50"
                style={{
                  borderColor: 'var(--vscode-button-border)',
                  color: 'var(--vscode-button-foreground)',
                  background: 'var(--vscode-button-background)',
                }}
                onClick={handleRetry}
                disabled={isRetrying || selectedModel === currentModel}
                title={selectedModel === currentModel ? "Select a different model to retry" : "Retry with selected model"}>
                {isRetrying ? 'Sending...' : 'Retry'}
              </button>
            ) : null}
          </div>
        )}

        {/* Show message when no higher capacity models are available */}
        {!modelsWithLimits.some(m => m.hasHigherCapacity) && (
          <div className="text-center py-1">
            <span className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
              No higher capacity models available. Try reducing your input size or opening a new chat.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}