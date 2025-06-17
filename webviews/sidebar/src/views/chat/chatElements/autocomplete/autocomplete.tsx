import React, { FC, useRef, useEffect, useState, useCallback } from 'react';
import { AutocompleteOption, SaveUrlRequest } from '@/types';
import {
  Folder,
  File,
  Boxes,
  Link,
  Plus,
  ArrowLeft,
  Pencil,
  RefreshCw,
  ExternalLink,
  Trash2,
  MoreVertical,
  SquareFunction,
  LucideIcon,
} from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { useSafeAutocompleteBackground } from '@/utils/BgColorPatch';
import { saveUrl, deleteSavedUrl, updateSavedUrl, openBrowserPage } from '@/commandApi';
import { BarLoader } from 'react-spinners';

// --- Reusable Custom Hooks ---

/**
 * Custom hook to handle clicks outside a specified element.
 * @param ref - The ref of the element to monitor.
 * @param handler - The function to call on an outside click.
 */
const useClickOutside = (
  ref: React.RefObject<HTMLElement | null>,
  handler: (event: MouseEvent) => void
) => {
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };
    document.addEventListener('mousedown', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
    };
  }, [ref, handler]);
};

// --- Helper Components ---

const iconMap: Record<string, React.ReactElement> = {
  class: <Boxes className="h-5 w-5 text-blue-400" />,
  function: <SquareFunction className="h-5 w-5 text-purple-400" />,
  file: <File className="h-5 w-5 text-green-400" />,
  directory: <Folder className="h-5 w-5 text-blue-400" />,
  url: <Link className="h-5 w-5 text-blue-400" />,
};

const CustomLoader: FC = () => (
  <div style={{ width: '100%' }}>
    <BarLoader width="100%" color="var(--vscode-editor-foreground)" />
  </div>
);

// --- Sub-Components for AutocompleteMenu ---

interface UrlFormProps {
  initialData?: AutocompleteOption;
  onSave: (data: { id?: string; name: string; url: string }) => void;
  onCancel: () => void;
  isEditing: boolean;
}

/**
 * A form for adding or editing a saved URL.
 */
const UrlForm: FC<UrlFormProps> = ({ initialData, onSave, onCancel, isEditing }) => {
  const [name, setName] = useState(initialData?.label || '');
  const [url, setUrl] = useState(initialData?.url || '');
  const [urlError, setUrlError] = useState('');

  const validateUrl = (input: string) => {
    try {
      new URL(input);
      return true;
    } catch {
      return false;
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);
    setUrlError(validateUrl(value) ? '' : 'Please enter a valid URL.');
  };

  const handleSaveClick = () => {
    if (!name || !url || urlError) return;
    onSave({ id: initialData?.id, name, url });
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
    boxShadow: 'var(--vscode-widget-shadow) 0px 1px 4px',
    transition: 'all 0.2s ease',
  };

  return (
    <div
      className="flex flex-col space-y-4 p-4"
      style={{ fontFamily: 'var(--vscode-font-family)' }}
    >
      <button
        className="flex items-center self-start text-sm transition-all hover:text-[var(--vscode-textLink-activeForeground)]"
        onClick={onCancel}
      >
        <ArrowLeft className="mr-2 h-4 w-4 transition-transform hover:-translate-x-0.5" />
        <span className="hover:underline">Back to list</span>
      </button>

      <div className="space-y-4">
        {/* Name Input */}
        <div>
          <label
            className="mb-1 block text-sm font-medium"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            Name<span className="ml-1 text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg px-4 py-2 text-sm focus:outline-none"
              style={inputStyle}
              placeholder="Friendly URL Name"
              maxLength={50}
            />
            <div className="absolute bottom-1.5 right-3 text-xs opacity-70">{name.length}/50</div>
          </div>
        </div>

        {/* URL Input */}
        <div>
          <label
            className="mb-1 block text-sm font-medium"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            URL<span className="ml-1 text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={url}
              onChange={handleUrlChange}
              className="w-full rounded-lg px-4 py-2 text-sm focus:outline-none"
              disabled={isEditing}
              style={{
                ...inputStyle,
                border: urlError ? '1px solid var(--vscode-errorForeground)' : inputStyle.border,
              }}
              placeholder="https://example.com"
            />
            {urlError && (
              <p
                className="mt-1 text-[0.75rem] font-medium"
                style={{ color: 'var(--vscode-errorForeground)' }}
              >
                {urlError}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-3 flex justify-end gap-3 pt-4">
        <button
          className="rounded-lg px-4 py-2 text-sm font-medium transition-all hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
          style={{
            color: 'var(--vscode-button-secondaryForeground)',
            background: 'var(--vscode-button-secondaryBackground)',
          }}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="rounded-lg px-4 py-2 text-sm font-medium transition-all hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
          style={{
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
          }}
          onClick={handleSaveClick}
          disabled={!name || !url || !!urlError}
        >
          Save
        </button>
      </div>
    </div>
  );
};

interface ActionsDropdownProps {
  option: AutocompleteOption;
  onAction: (action: string, option: AutocompleteOption) => void;
}

const dropdownActions: {
  id: string;
  label: string;
  Icon: LucideIcon;
  className?: string;
}[] = [
  { id: 'edit', label: 'Edit', Icon: Pencil },
  { id: 'reindex', label: 'Re-Index', Icon: RefreshCw },
  { id: 'open', label: 'Open Page', Icon: ExternalLink },
  { id: 'delete', label: 'Delete', Icon: Trash2, className: 'text-red-400' },
];

/**
 * A dropdown menu with actions for a URL option.
 */
const ActionsDropdown: FC<ActionsDropdownProps> = ({ option, onAction }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => {
    setIsOpen(false);
    setConfirmingDelete(false);
  });

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    const button = e.currentTarget as HTMLButtonElement;
    const rect = button.getBoundingClientRect();
    const dropdownHeight = 160;
    const spaceBelow = window.innerHeight - rect.bottom;

    setPosition({
      top:
        spaceBelow < dropdownHeight && rect.top > dropdownHeight
          ? rect.top - dropdownHeight
          : rect.bottom,
      left: rect.right - 150, // width of dropdown
    });
    setIsOpen(true);
  };

  const handleActionClick = (e: React.MouseEvent, actionId: string) => {
    e.stopPropagation();
    if (actionId === 'delete') {
      setConfirmingDelete(true);
    } else {
      onAction(actionId, option);
      setIsOpen(false);
      setConfirmingDelete(false);
    }
  };

  const renderDropdownContent = () => {
    if (confirmingDelete) {
      return (
        <div className="space-y-4 p-3">
          <p className="text-sm">Are you sure?</p>
          <div className="flex justify-end gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmingDelete(false);
              }}
              className="rounded-md px-2 py-1 text-sm hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={(e) => handleActionClick(e, 'confirm-delete')}
              className="rounded-md bg-red-600 px-2 py-1 text-sm text-white hover:bg-red-500"
            >
              Delete
            </button>
          </div>
        </div>
      );
    }
    return (
      <ul role="menu">
        {dropdownActions.map(({ id, label, Icon, className }) => (
          <li
            key={id}
            role="menuitem"
            onClick={(e) => handleActionClick(e, id)}
            className={`flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-700 ${className || ''}`}
          >
            <Icon size={16} /> {label}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div ref={dropdownRef} className="relative ml-auto flex-shrink-0">
      <button
        onClick={handleToggle}
        className="text-muted-foreground p-1 hover:text-white"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="More actions"
      >
        <MoreVertical size={16} />
      </button>
      {isOpen && position && (
        <div
          className="fixed z-50 w-40 rounded-md border border-gray-700 bg-[#1e1e1e] text-sm shadow-lg"
          style={{ top: `${position.top}px`, left: `${position.left}px` }}
        >
          {renderDropdownContent()}
        </div>
      )}
    </div>
  );
};

interface AutocompleteListItemProps {
  option: AutocompleteOption;
  index: number;
  isSelected: boolean;
  onSelect: (option: AutocompleteOption) => void;
  onAction: (action: string, option: AutocompleteOption) => void;
}

/**
 * Renders a single item in the autocomplete list.
 */
const AutocompleteListItem: FC<AutocompleteListItemProps> = ({
  option,
  index,
  isSelected,
  onSelect,
  onAction,
}) => {
  return (
    <li
      className={`relative flex cursor-pointer items-start justify-between gap-3 rounded-sm px-3 py-2 transition-all duration-150 ${isSelected && 'bg-[var(--deputydev-active-selection-background)] text-[--vscode-list-activeSelectionForeground]'}`}
      onClick={(e) => {
        e.preventDefault();
        onSelect(option);
      }}
      onMouseEnter={() => useChatStore.setState({ selectedOptionIndex: index })}
      role="option"
      aria-selected={isSelected}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <div className="rounded-md p-1">{iconMap[option.icon as keyof typeof iconMap]}</div>
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium" title={option.label}>
            {option.label}
          </span>
          <p className="block truncate text-xs opacity-70">{option.description}</p>
        </div>
      </div>

      {option.icon === 'url' && option.label !== 'URL' && (
        <ActionsDropdown option={option} onAction={onAction} />
      )}
    </li>
  );
};

// --- Main Component ---

interface AutocompleteMenuProps {
  showAddNewButton?: boolean;
  options: AutocompleteOption[];
  onSelect: (option: AutocompleteOption) => void;
}

export const AutocompleteMenu: FC<AutocompleteMenuProps> = ({
  showAddNewButton,
  options,
  onSelect,
}) => {
  const safeBg = useSafeAutocompleteBackground();
  const { selectedOptionIndex } = useChatStore();
  const listRef = useRef<HTMLUListElement>(null);

  const [formState, setFormState] = useState<{
    mode: 'closed' | 'new' | 'edit';
    option: AutocompleteOption | null;
  }>({ mode: 'closed', option: null });
  const [isLoading, setIsLoading] = useState(false);

  // Stop loading when new options arrive
  useEffect(() => {
    setIsLoading(false);
  }, [options]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current && selectedOptionIndex > -1) {
      const selectedElement = listRef.current.children[selectedOptionIndex] as HTMLLIElement;
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedOptionIndex]);

  const handleSave = useCallback(
    async (data: { id?: string; name: string; url: string }) => {
      setIsLoading(true);
      if (formState.mode === 'edit' && data.id) {
        await updateSavedUrl({ id: data.id, name: data.name });
      } else {
        await saveUrl({ name: data.name, url: data.url } as SaveUrlRequest);
      }
      setFormState({ mode: 'closed', option: null });
    },
    [formState.mode]
  );

  const handleUrlAction = useCallback(async (action: string, option: AutocompleteOption) => {
    switch (action) {
      case 'edit':
        setFormState({ mode: 'edit', option });
        break;
      case 'reindex':
        setIsLoading(true);
        if (option.label && option.url) {
          await saveUrl({ name: option.label, url: option.url });
        }
        break;
      case 'open':
        if (option.url) openBrowserPage(option.url);
        break;
      case 'confirm-delete':
        setIsLoading(true);
        if (option.id) await deleteSavedUrl(option.id);
        break;
    }
  }, []);

  const renderContent = () => {
    if (formState.mode !== 'closed') {
      return (
        <UrlForm
          isEditing={formState.mode === 'edit'}
          initialData={formState.option || undefined}
          onSave={handleSave}
          onCancel={() => setFormState({ mode: 'closed', option: null })}
        />
      );
    }

    return (
      <ul className="space-y-1 p-1" ref={listRef}>
        {options.length === 0 && (
          <li className="py-2 text-center text-xs opacity-70">No results found</li>
        )}
        {options.map((option, index) => (
          <AutocompleteListItem
            key={option.id || index}
            option={option}
            index={index}
            isSelected={index === selectedOptionIndex}
            onSelect={onSelect}
            onAction={handleUrlAction}
          />
        ))}
        {showAddNewButton && (
          <li
            className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 transition-all duration-150 hover:bg-[var(--deputydev-active-selection-background)] hover:text-[--vscode-list-activeSelectionForeground]"
            onClick={() => setFormState({ mode: 'new', option: null })}
          >
            <div className="rounded-md p-1">
              <Plus className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <span className="text-sm font-medium">Save a new URL</span>
            </div>
          </li>
        )}
      </ul>
    );
  };

  return (
    <div
      className={`${options.length > 0 ? 'max-h-[300px]' : 'h-auto'} z-50 w-full overflow-y-auto rounded-md border border-[#3c3c3c] shadow-xl`}
      style={{ backgroundColor: safeBg }}
    >
      {isLoading && <CustomLoader />}
      {renderContent()}
    </div>
  );
};

export default CustomLoader; // Assuming CustomLoader might be exported for other uses. If not, this can be removed.
