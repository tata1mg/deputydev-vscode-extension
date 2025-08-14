import { createNewWorkspace } from '@/commandApi';
import { useThemeStore } from '@/stores/useThemeStore';
import { useChatStore } from '@/stores/chatStore';
import { StatusIcon } from './ThinkingChip';

export function CreateNewWorkspace({ tool_id, status }: { tool_id: string; status: string }) {
  const handleContinue = () => {
    createNewWorkspace(tool_id);
  };

  const handleCancel = () => {
    useChatStore.getState().cancelChat();
  };

  const { themeKind } = useThemeStore();

  const borderClass =
    themeKind === 'high-contrast' || themeKind === 'high-contrast-light'
      ? 'border border-[--deputydev-button-border]'
      : '';
  const completed = status === 'completed';
  const aborted = status === 'aborted';

  if (completed || aborted) {
    return (
      <div
        className="mt-2 flex w-full items-center gap-2 rounded border border-gray-500/40 px-2 py-2 text-sm"
        title={completed ? 'Directory created successfully' : 'Directory creation cancelled'}
      >
        <div className="flex min-w-[16px] items-center justify-center">
          <StatusIcon status={status} />
        </div>
        <span className="text-sm">
          {completed ? 'Directory created successfully' : 'Directory creation cancelled'}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-2 w-full overflow-hidden rounded border border-gray-500/40 px-2 py-2 text-sm">
      <div className="space-y-1 text-xs">
        <div className="text-sm font-medium">Open an empty folder to continue</div>
        <div className="text-xs">
          DeputyDev requires an empty folder. Please create and select an empty folder. This folder
          will act as the root directory for your project.
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={handleCancel}
            className={`rounded bg-[--deputydev-button-secondaryBackground] px-3 py-1 text-xs font-medium text-[--deputydev-button-secondaryForeground] hover:bg-[--deputydev-button-secondaryHoverBackground] ${borderClass}`}
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            className={`rounded bg-[--deputydev-button-background] px-3 py-1 text-xs font-medium text-[--deputydev-button-foreground] hover:bg-[--deputydev-button-hover-background] ${borderClass}`}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
