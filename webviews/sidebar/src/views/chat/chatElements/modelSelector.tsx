import { getWorkspaceState } from '@/commandApi';
import { useLLMModelStore } from '@/stores/llmModelStore';
import { LLMModels, ReasoningLevel } from '@/types';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import _ from 'lodash';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Model + Reasoning selector — submenu opens/closes with 50ms delay
 * - Clicking a reasoning-capable model row only OPENS the submenu (never selects the model)
 * - Clicking a non-reasoning model selects it immediately
 * - Hover switching is instant (with delay applied)
 * - Submenu is fixed-position, pinned to the RIGHT of the hovered row; never flips (may overflow)
 * - While hovering the submenu, the owning row keeps a persistent highlight (even if not active)
 * - Active model row still has its own distinct highlight
 * - No keyboard nav
 */

type RowId = string | number;

const SUBMENU_WIDTH = 90; // px
const SUBMENU_OPEN_DELAY = 100;
const SUBMENU_CLOSE_DELAY = 200;

const ModelSelector: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [submenuForModelId, setSubmenuForModelId] = useState<RowId | null>(null);
  const [hoverTimer, setHoverTimer] = useState<number | null>(null);

  // NEW: keep the owner element and its live bounding rect
  const [submenuOwnerEl, setSubmenuOwnerEl] = useState<HTMLElement | null>(null);
  const [submenuRect, setSubmenuRect] = useState<DOMRect | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);

  const {
    llmModels,
    setActiveModel,
    setLLMModels,
    activeModel,
    getActiveReasoning,
    setActiveReasoning,
  } = useLLMModelStore();

  // Group models by provider for rendering
  const modelsByProvider = useMemo(() => {
    return llmModels.reduce<Record<string, typeof llmModels>>((acc, model) => {
      if (!acc[model.provider]) acc[model.provider] = [];
      acc[model.provider].push(model);
      return acc;
    }, {});
  }, [llmModels]);

  const selectedModel = activeModel;
  const selectedReasoning = getActiveReasoning();

  // Fetch models once from workspace state
  useEffect(() => {
    (async () => {
      try {
        const essentialConfig = await getWorkspaceState({ key: 'essentialConfigData' });
        const models = (essentialConfig?.['LLM_MODELS'] ?? []) as LLMModels[];
        if (Array.isArray(models) && models.length) {
          setLLMModels(models);
        }
      } catch {
        /* non-blocking */
      }
    })();
  }, [setLLMModels]);

  const modelHasReasoning = (m: LLMModels) =>
    Boolean(m?.reasoning && m.reasoning.supported?.length);

  const shouldKeepOpen = (nextTarget: EventTarget | null, owner?: HTMLElement | null) => {
    const el = nextTarget as Node | null;
    if (!el) return false;

    const toSubmenu = !!submenuRef.current?.contains(el);
    const toOwner = !!owner?.contains(el);

    // Keep open only when moving to the submenu or back to the owner row
    return toSubmenu || toOwner;
  };

  const clearHoverTimer = () => {
    if (hoverTimer) {
      window.clearTimeout(hoverTimer);
      setHoverTimer(null);
    }
  };

  const openSubmenu = (modelId: RowId, anchorEl?: HTMLElement) => {
    clearHoverTimer();

    if (anchorEl) {
      setSubmenuOwnerEl(anchorEl);
      setSubmenuRect(anchorEl.getBoundingClientRect());
    }

    // If switching owners, collapse immediately so the previous row highlight/submenu doesn't linger
    if (submenuForModelId !== null && submenuForModelId !== modelId) {
      setSubmenuForModelId(null);
    }

    const id = window.setTimeout(() => setSubmenuForModelId(modelId), SUBMENU_OPEN_DELAY);
    setHoverTimer(id);
  };

  const closeSubmenu = () => {
    clearHoverTimer();
    const id = window.setTimeout(() => {
      setSubmenuForModelId(null);
      setSubmenuOwnerEl(null);
      setSubmenuRect(null);
    }, SUBMENU_CLOSE_DELAY);
    setHoverTimer(id);
  };

  // Close menus on outside click
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node | null;

      const inDropdown = dropdownRef.current?.contains(target ?? null);
      const inSubmenu = submenuRef.current?.contains(target ?? null);

      if (!inDropdown && !inSubmenu) {
        setIsOpen(false);
        closeSubmenu();
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const handleSelectModelOnly = (model: LLMModels) => {
    // For non-reasoning models only
    setActiveModel(model.name);
    setIsOpen(false);
    closeSubmenu();
  };

  const handleSelectModelAndReasoning = (model: LLMModels, level: ReasoningLevel) => {
    setActiveModel(model.name);
    setActiveReasoning(level);
    setIsOpen(false);
    closeSubmenu();
  };

  // Recompute submenu position when open, on scroll/resize and while hovering
  useEffect(() => {
    if (!submenuOwnerEl || !submenuForModelId) return;

    const recompute = () => {
      if (!submenuOwnerEl?.isConnected) return;
      setSubmenuRect(submenuOwnerEl.getBoundingClientRect());
    };

    const onScrollCapture = () => recompute();

    window.addEventListener('resize', recompute);
    document.addEventListener('scroll', onScrollCapture, true);

    // internal menu scroller
    const scroller = menuRef.current?.querySelector('[data-menu-scroller]') as HTMLElement | null;
    scroller?.addEventListener('scroll', recompute);

    // also update once after mount to avoid first-frame drift
    recompute();

    return () => {
      window.removeEventListener('resize', recompute);
      document.removeEventListener('scroll', onScrollCapture, true);
      scroller?.removeEventListener('scroll', recompute);
    };
  }, [submenuOwnerEl, submenuForModelId]);

  const getSubmenuStyle = () => {
    if (!submenuRect) return undefined;
    const gap = 6;
    const left = submenuRect.right + gap;

    // measure current submenu height for precise clamping
    const measuredH = submenuRef.current?.offsetHeight ?? 300;
    const minPad = 8;
    const top = Math.min(
      Math.max(minPad, submenuRect.top),
      Math.max(minPad, window.innerHeight - minPad - measuredH)
    );

    return {
      position: 'fixed' as const,
      top,
      left,
      width: SUBMENU_WIDTH,
      maxHeight: 320,
      overflowY: 'auto' as const,
    };
  };

  const renderModelRow = (model: LLMModels) => {
    const isActive = selectedModel?.name === model.name;
    const hasReason = modelHasReasoning(model);
    const id = model.id as RowId;
    const isOwnerOpen = submenuForModelId === id;

    let rowStateClass = '';
    if (isActive) {
      rowStateClass =
        'bg-[var(--vscode-list-activeSelectionBackground)] text-[--vscode-list-activeSelectionForeground]';
    } else if (isOwnerOpen) {
      rowStateClass =
        'bg-[var(--vscode-list-hoverBackground)] text-[--vscode-list-hoverForeground]';
    } else {
      rowStateClass =
        'hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[--vscode-list-hoverForeground]';
    }

    return (
      <div key={id} className="relative">
        <div
          data-model-id={id}
          className={`flex cursor-pointer select-none items-center justify-between rounded px-2 py-1 text-xs ${rowStateClass}`}
          onMouseEnter={(e) => {
            if (hasReason) openSubmenu(id, e.currentTarget as HTMLElement);
          }}
          onMouseLeave={(e) => {
            if (!hasReason) return;
            if (shouldKeepOpen(e.relatedTarget, e.currentTarget as HTMLElement)) return;
            closeSubmenu();
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (hasReason) {
              openSubmenu(id, e.currentTarget as HTMLElement);
            } else {
              handleSelectModelOnly(model);
            }
          }}
        >
          <span className="flex-1 truncate pr-2">{model.display_name}</span>
          {hasReason ? (
            <ChevronRight className="h-3 w-3 opacity-70" />
          ) : (
            isActive && <Check className="h-3 w-3" />
          )}
        </div>

        <AnimatePresence>
          {submenuForModelId === id && hasReason && (
            <motion.div
              ref={submenuRef}
              key={`submenu-${id}`}
              initial={{ opacity: 0, x: 6, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 6, scale: 0.98 }}
              transition={{ duration: 0.05 }}
              className="z-[60] rounded-md border border-[--vscode-commandCenter-inactiveBorder] bg-[--vscode-dropdown-background] shadow-lg"
              style={getSubmenuStyle()}
              onMouseEnter={() => {
                // Cancel any pending close from the owner row as soon as we enter
                clearHoverTimer();
              }}
              onMouseLeave={(e) => {
                if (shouldKeepOpen(e.relatedTarget, submenuOwnerEl)) return;
                closeSubmenu();
              }}
            >
              <div className="px-2 pb-1 pt-1 text-[0.65rem] font-semibold uppercase text-gray-500">
                Reasoning
              </div>
              <div className="py-1">
                {(model.reasoning!.supported as ReasoningLevel[]).map((level) => {
                  const isSelected =
                    selectedModel?.name === model.name && selectedReasoning === level;
                  return (
                    <div
                      key={level}
                      className={`flex cursor-pointer select-none items-center justify-between rounded px-2 py-1 text-xs ${
                        isSelected
                          ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[--vscode-list-activeSelectionForeground]'
                          : 'hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[--vscode-list-hoverForeground]'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectModelAndReasoning(model, level);
                      }}
                    >
                      <span className="truncate">{_.capitalize(level as string)}</span>
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="flex items-center gap-0">
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="inline-flex w-auto min-w-[60px] items-center gap-1 rounded-full px-2 py-0.5 text-xs hover:bg-[var(--deputydev-input-background)]"
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          <span className="max-w-[160px] truncate text-xs">
            {selectedModel?.display_name || 'Select Model'}
            {selectedModel?.reasoning && selectedReasoning
              ? ` · ${_.capitalize(selectedReasoning as string)}`
              : ''}
          </span>
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={menuRef}
              key="main-menu"
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{
                type: 'spring',
                damping: 20,
                stiffness: 200,
                mass: 0.4,
                duration: 0.15,
              }}
              className="absolute bottom-full left-0 right-0 z-50 mx-auto mb-1 w-[160px] origin-bottom rounded-md border border-[--vscode-commandCenter-inactiveBorder] bg-[--vscode-dropdown-background] shadow-lg"
              role="menu"
            >
              <div className="max-h-72 overflow-y-auto py-1 pr-1" data-menu-scroller>
                {llmModels.length > 0 ? (
                  Object.entries(modelsByProvider).map(([provider, models]) => (
                    <div key={provider} className="pb-2">
                      <div className="px-2 pb-1 pt-1 text-[0.65rem] font-semibold uppercase text-gray-500">
                        {provider}
                      </div>
                      {models.map((model) => renderModelRow(model))}
                    </div>
                  ))
                ) : (
                  <div className="px-2 py-2 text-xs text-gray-400">No models available</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ModelSelector;
