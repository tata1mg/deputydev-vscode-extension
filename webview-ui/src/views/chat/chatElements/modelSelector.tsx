import * as Tooltip from '@radix-ui/react-tooltip'; // Import Radix Tooltip components
import { useChatStore } from '../../../stores/chatStore';
import { useState, useRef } from 'react';
import { Box } from 'lucide-react';

const ModelSelector = () => {
  const { history: messages, isLoading } = useChatStore();
  const [activeModel, setActiveModel] = useState("");
  const selectRef = useRef<HTMLSelectElement>(null);

  const disableModelSelector = isLoading;

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedModel = event.target.value;

    if (selectedModel) {
      setActiveModel(selectedModel)
    }
  };

  // Common class names for the wrapper div
  const wrapperBaseClasses = `relative inline-flex w-fit items-center gap-1 px-1 py-0.5 rounded-full text-xs border border-[--vscode-commandCenter-inactiveBorder]`;
  // Conditional classes based on the disabled state
  const wrapperConditionalClasses = disableModelSelector
    ? 'opacity-50 p-0 cursor-not-allowed' // Disabled styles
    : 'hover:bg-[var(--deputydev-input-background)]'; // Enabled hover style

  const models = [
    { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }
  ];

  const selectElement = (
    <div className="relative w-full">
      <select
        ref={selectRef}
        className="w-full cursor-pointer bg-inherit text-xs text-ellipsis whitespace-nowrap focus:outline-none appearance-none pr-7"
        value={activeModel}
        onChange={handleChange}
        disabled={disableModelSelector}
        style={{ pointerEvents: 'none' }}
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
      <button
        className="absolute right-1 top-1/2 -translate-y-1/2 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          if (selectRef.current) {
            const event = new MouseEvent('mousedown', { bubbles: true });
            selectRef.current.dispatchEvent(event);
          }
        }}
      >
        <Box className='h-4 w-4'/>
      </button>
    </div>
  );

  // If the selector is disabled, wrap it with the Radix Tooltip
  if (disableModelSelector) {
    return (
      <Tooltip.Provider delayDuration={200}>
        {' '}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            {/* The trigger is the wrapper div */}
            <div className={`${wrapperBaseClasses} ${wrapperConditionalClasses}`}>
              {selectElement}
            </div>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="top" // Or "bottom", "left", "right"
              align="center" // Adjust alignment as needed
              className="z-50 ml-3 max-w-[300px] break-words rounded-md px-2 py-1.5 text-xs shadow-md" // Added z-index just in case
              style={{
                backgroundColor: 'var(--vscode-editorHoverWidget-background)',
                color: 'var(--vscode-editorHoverWidget-foreground)',
                border: '1px solid var(--vscode-editorHoverWidget-border)',
              }}
            >
              Create new chat to select new model.
              <Tooltip.Arrow style={{ fill: 'var(--vscode-editorHoverWidget-background)' }} />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    );
  }

  // If the selector is enabled, render it without the tooltip wrapper
  return (
    <div className={`${wrapperBaseClasses} ${wrapperConditionalClasses}`}>{selectElement}</div>
  );
};

export default ModelSelector;
