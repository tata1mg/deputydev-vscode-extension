import { useSafeAutocompleteBackground } from '@/utils/BgColorPatch';
import { FC, useEffect, useRef } from 'react';
import { SlashCommand, getMatchingSlashCommands } from './slashCommand';

/**
 * Props for the SlashCommandMenu
 */
interface SlashCommandMenuProps {
  query: string;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  onSelect: (command: SlashCommand) => void;
}

const SlashCommandMenuInner: FC<SlashCommandMenuProps> = ({
  query,
  selectedIndex,
  setSelectedIndex,
  onSelect,
}) => {
  const safeBg = useSafeAutocompleteBackground();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const allCommands = getMatchingSlashCommands(query);
  const defaultCommands = allCommands.filter((cmd) => cmd.section === 'default' || !cmd.section);
  const workflowCommands = allCommands.filter((cmd) => cmd.section === 'custom');

  // Keep the selected item in view
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current.querySelector<HTMLButtonElement>(
      `[data-slash-index="${selectedIndex}"]`
    );
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex, allCommands.length]);

  const renderSection = (title: string, commands: SlashCommand[], indexOffset: number) => {
    if (commands.length === 0) return null;

    return (
      <div>
        <div className="border-b border-[#3c3c3c] px-3 py-1 text-xs font-semibold text-[var(--vscode-descriptionForeground)]">
          {title}
        </div>
        {commands.map((command, idx) => {
          const itemIndex = indexOffset + idx;
          const isActive = itemIndex === selectedIndex;

          return (
            <button
              key={`${command.section ?? 'default'}-${command.name}-${itemIndex}`}
              type="button"
              data-slash-index={itemIndex}
              className={`flex w-full items-start gap-2 px-3 py-2 text-left text-xs transition-colors ${
                isActive
                  ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                  : 'hover:bg-[var(--vscode-list-hoverBackground)]'
              }`}
              onClick={() => onSelect(command)}
              onMouseEnter={() => setSelectedIndex(itemIndex)}
            >
              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-md bg-[var(--vscode-editorWidget-background)] text-[var(--vscode-descriptionForeground)]">
                <span className="text-[0.65rem] font-semibold">/</span>
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  <span className="opacity-70">/</span>
                  {command.name}
                </div>
                {command.description && (
                  <div className="mt-0.5 truncate text-[0.75rem] text-[var(--vscode-descriptionForeground)]">
                    {command.description}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="z-50 w-full overflow-hidden rounded-md border border-[#3c3c3c] shadow-xl"
      style={{ backgroundColor: safeBg, maxHeight: 300 }}
    >
      <div ref={containerRef} className="max-h-[300px] overflow-y-auto">
        {allCommands.length === 0 ? (
          <div className="px-3 py-2 text-xs text-[var(--vscode-descriptionForeground)]">
            No matching commands
          </div>
        ) : (
          <>
            {renderSection('Default Commands', defaultCommands, 0)}
            {renderSection('Workflow Commands', workflowCommands, defaultCommands.length)}
          </>
        )}
      </div>
    </div>
  );
};

export const SlashCommandMenu = SlashCommandMenuInner;
export default SlashCommandMenuInner;
