import * as Tooltip from '@radix-ui/react-tooltip';
import { useEffect } from 'react';
import { Box } from 'lucide-react';
import { getWorkspaceState } from '@/commandApi';
import { useChatStore, useChatSettingStore } from '@/stores/chatStore';

const ModelSelector = () => {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedModel = event.target.value;

    if (selectedModel) {
      useChatSettingStore.setState({ activeModel: selectedModel });
    }
    // console.log("************", useChatSettingStore.getState().activeModel)
  };

  useEffect(() => {
    const fetchConfigFromWorkspaceState = async () => {
      const essentialConfig = await getWorkspaceState({ key: 'essentialConfigData' });

      // will use this once getting from config
      const llmModels = essentialConfig['LLM_MODELS'];
      // dummy values for now
      // const llmModels = [
      //   {id: 1,display_name: "Claude 3.5 Sonnet", name: "CLAUDE_3_POINT_5_SONNET"},
      //   {id: 2, display_name: "Gemini 2.5 Pro", name: "GEMINI_2_POINT_5_PRO"},
      //   ];
      if (llmModels.length !== 0) {
        useChatStore.setState({ llmModels: llmModels });
        if (useChatSettingStore.getState().activeModel === '') {
          useChatSettingStore.setState({ activeModel: llmModels[0]['name'] });
        }
      }
      // console.log("******active model ***********", useChatSettingStore.getState().activeModel);
    };
    fetchConfigFromWorkspaceState();
  }, []);

  const selectElement = (
    <div className="relative w-full">
      <select
        className="w-[110px] cursor-pointer appearance-none text-ellipsis whitespace-nowrap bg-inherit pl-6 text-xs focus:outline-none"
        value={useChatSettingStore.getState().activeModel}
        onChange={handleChange}
      >
        {useChatStore.getState().llmModels.length !== 0 ? (
          useChatStore.getState().llmModels.map((model) => (
            <option key={model.id} value={model.name}>
              {model.display_name}
            </option>
          ))
        ) : (
          <option value="" disabled>
            No models available
          </option>
        )}
      </select>
      <div className="absolute left-0.5 top-1/2 -translate-y-1/2 cursor-pointer">
        <Box className="h-4 w-4" />
      </div>
    </div>
  );
  return (
    <Tooltip.Provider delayDuration={200}>
      {' '}
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div className="relative inline-flex w-fit items-center gap-1 rounded-full border border-[--vscode-commandCenter-inactiveBorder] px-1 py-0.5 text-xs hover:bg-[var(--deputydev-input-background)]">
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
            Change Model
            <Tooltip.Arrow style={{ fill: 'var(--vscode-editorHoverWidget-background)' }} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

export default ModelSelector;
