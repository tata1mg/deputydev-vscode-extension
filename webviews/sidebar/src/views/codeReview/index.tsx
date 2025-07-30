import { useThemeStore } from '@/stores/useThemeStore';
import {
  ChevronDown,
  GitBranch,
  Check,
  Pen,
  BotMessageSquare,
  ArrowLeft,
  ChevronRight,
  Info,
  LoaderCircle,
  Plus,
} from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  getUserAgents,
  newReview,
  openFileDiff,
  performCrudOnUserAgent,
  searchBranches,
  cancelReview,
} from '@/commandApi';
import { useCodeReviewSettingStore, useCodeReviewStore } from '@/stores/codeReviewStore';
import { useClickAway } from 'react-use';
import { PastReviews } from './PastReviews';
import { Review } from './review';
import { ReviewModal } from './ReviewModal';
import { Tooltip } from 'react-tooltip';
import { ViewSwitcher } from '@/components/ViewSwitcher';

const dropdownVariants: Variants = {
  hidden: {
    opacity: 0,
    height: 0,
    transition: {
      opacity: { duration: 0.15 },
      height: { duration: 0.2, ease: 'easeInOut' },
    },
  },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: {
      opacity: { duration: 0.2 },
      height: { duration: 0.25, ease: 'easeInOut' },
    },
  },
};

export default function CodeReview() {
  const { themeKind } = useThemeStore();
  const {
    new_review,
    reviewOptions,
    activeReviewOption,
    searchedBranches,
    selectedTargetBranch,
    userAgents,
    isFetchingChangedFiles,
  } = useCodeReviewStore();
  const { enabledAgents } = useCodeReviewSettingStore();
  const [showFilesToReview, setShowFilesToReview] = useState(true);
  const [showReviewOptions, setShowReviewOptions] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('d');
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const dropDownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const branchSelectorRef = useRef<HTMLDivElement>(null);
  const [expandedAgentId, setExpandedAgentId] = useState<number | null>(null);
  const [isAgentExpanded, setIsAgentExpanded] = useState(false);
  const [showCreateAgentForm, setShowCreateAgentForm] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getNoChangesFoundText = () => {
    switch (activeReviewOption.value) {
      case 'ALL':
        return 'No files found for review';
      case 'COMMITTED_ONLY':
        return 'No committed changes found for review';
      case 'UNCOMMITTED_ONLY':
        return 'No uncommitted changes found for review';
    }
  };

  useEffect(() => {
    getUserAgents();
  }, []);

  const handleStartReview = () => {
    useCodeReviewStore.setState({ showReviewProcess: true, reviewStatus: 'RUNNING' });
  };

  useEffect(() => {
    handleNewReview();
  }, []);

  const toggleAgent = (agentId: number, agentName: string) => {
    useCodeReviewSettingStore.setState((state) => {
      const isEnabled = state.enabledAgents.some((a) => a.id === agentId);
      const updatedAgents = isEnabled
        ? state.enabledAgents.filter((a) => a.id !== agentId)
        : [...state.enabledAgents, { id: agentId, displayName: agentName }];

      return { enabledAgents: updatedAgents };
    });
  };

  const handleNewReview = () => {
    useCodeReviewStore.setState({ isFetchingChangedFiles: true });
    newReview({
      targetBranch: useCodeReviewStore.getState().selectedTargetBranch,
      reviewType: useCodeReviewStore.getState().activeReviewOption.value,
    });
  };

  const handleResetReview = () => {
    useCodeReviewStore.setState({
      showReviewProcess: false,
      reviewStatus: 'IDLE',
      steps: [],
      reviewErrorMessage: '',
      showReviewError: false,
    });
    setShowFilesToReview(true);
  };

  useClickAway(dropDownRef, () => {
    if (showReviewOptions) {
      setShowReviewOptions(false);
    }
    if (showAgents) {
      setShowAgents(false);
    }
  });

  useClickAway(branchSelectorRef, () => {
    if (isEditing || showBranchDropdown) {
      setIsEditing(false);
      setShowBranchDropdown(false);
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'A':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'D':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'M':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'R':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const deputyDevLogo =
    themeKind === 'light' || themeKind === 'high-contrast-light'
      ? 'https://onemg.gumlet.io/dd_logo_dark_name_14_04.png'
      : 'https://onemg.gumlet.io/dd_logo_with_name_10_04.png';

  const handleSearchBranches = async (keyword: string) => {
    searchBranches(keyword);
  };

  const handleBranchSelect = (branch: string) => {
    useCodeReviewStore.setState({
      selectedTargetBranch: branch,
      searchedBranches: [], // Clear search results after selection
    });
    setSearchQuery(''); // Clear search query
    setShowBranchDropdown(false);
    setIsEditing(false);
    handleNewReview(); // Trigger new review with selected branch
  };

  const toggleAgentExpansion = (agentId: number) => {
    if (expandedAgentId === agentId) {
      setExpandedAgentId(null);
      setIsAgentExpanded(false);
    } else {
      setExpandedAgentId(agentId);
      setShowCreateAgentForm(false);
      setIsAgentExpanded(true);
    }
  };

  const toggleCreateAgentForm = () => {
    if (showCreateAgentForm) {
      setShowCreateAgentForm(false);
    } else {
      setExpandedAgentId(null);
      setShowCreateAgentForm(true);
      setIsAgentExpanded(true);
    }
  };

  const handleUpdateCustomAgent = (agentId: number, agentName: string, agentPrompt: string) => {
    performCrudOnUserAgent('UPDATE', agentId, agentName, agentPrompt);
    setExpandedAgentId(null);
    setIsAgentExpanded(false);
  };

  const handleUpdatePredefinedAgent = (agentId: number, agentPrompt: string) => {
    performCrudOnUserAgent('UPDATE', agentId, undefined, agentPrompt);
    setExpandedAgentId(null);
    setIsAgentExpanded(false);
  };

  const handleDelete = (agentId: number) => {
    performCrudOnUserAgent('DELETE', agentId);
    setExpandedAgentId(null);
    setIsAgentExpanded(false);
  };

  const handleCreateAgent = (agentName: string, agentPrompt: string) => {
    // Handle create agent logic here
    performCrudOnUserAgent('CREATE', undefined, agentName, agentPrompt);
    setShowCreateAgentForm(false);
  };

  return (
    <div className="relative flex h-full flex-col gap-2 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-grow">
        <div className="sticky top-0 z-50 border-b border-transparent bg-inherit">
          <div className="mt-10">
            <img src={deputyDevLogo} alt="DeputyDev Logo" className="h-12 w-auto px-4 opacity-90" />
          </div>
          <div className="mt-4 px-4 pb-4">
            <div className="flex flex-col items-start gap-2">
              <ViewSwitcher />
              <div className="flex items-center gap-2">
                <p className="text-lg opacity-80">Ready for review? So are we.</p>
                <Check className="text-sm text-green-500" />
              </div>
              <p className="text-md opacity-80">DeputyDev checks your code with precision.</p>
            </div>
          </div>
        </div>
      </div>

      <PageTransition key="review" direction="right">
        <div>
          {/* New Review */}
          {new_review && (
            <div>
              {/* Branch Info */}
              <div className="p-2">
                <div className="flex w-full items-center justify-between gap-2 px-2">
                  {/* Target Branch */}
                  <div className="relative min-w-0 flex-1" ref={branchSelectorRef}>
                    <div
                      className="flex w-full items-center justify-between overflow-hidden rounded-md border border-[var(--vscode-editorWidget-border)] p-2"
                      style={{
                        backgroundColor: 'var(--vscode-editor-background)',
                      }}
                    >
                      <div
                        className="flex w-full items-center gap-2 overflow-hidden"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isEditing) {
                            setSearchQuery(selectedTargetBranch || new_review.target_branch);
                            setIsEditing(true);
                            setShowBranchDropdown(true);
                            setTimeout(() => inputRef.current?.focus(), 0);
                          }
                        }}
                      >
                        <GitBranch className="h-3.5 w-3.5 flex-shrink-0 text-purple-600 dark:text-purple-400" />
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            type="text"
                            className="min-w-0 flex-1 overflow-ellipsis bg-transparent font-mono text-sm outline-none"
                            style={{
                              outline: 'none',
                              textOverflow: 'ellipsis',
                            }}
                            value={searchQuery}
                            onChange={(e) => {
                              const value = e.target.value;
                              setSearchQuery(value);
                              handleSearchBranches(value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && searchedBranches.length > 0) {
                                handleBranchSelect(searchedBranches[0]);
                              } else if (e.key === 'Escape') {
                                setIsEditing(false);
                                setShowBranchDropdown(false);
                              }
                            }}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="w-full truncate font-mono text-sm">
                            {selectedTargetBranch || new_review.target_branch}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchQuery(selectedTargetBranch || new_review.target_branch);
                          setIsEditing(!isEditing);
                          setShowBranchDropdown(!showBranchDropdown);
                          if (!isEditing && inputRef.current) {
                            setTimeout(() => inputRef.current?.focus(), 0);
                          }
                        }}
                        className="ml-2 flex flex-shrink-0 items-center justify-center"
                      >
                        <Pen className="h-3.5 w-3.5 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]" />
                      </button>
                    </div>

                    {/* Dropdown for search results */}
                    {showBranchDropdown && (
                      <div
                        className="absolute z-50 mt-1 w-[150%] rounded-md border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] shadow-lg"
                        style={{ maxHeight: '200px', overflowY: 'auto' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {searchedBranches && searchedBranches.length > 0 ? (
                          searchedBranches.map((result, index) => (
                            <div
                              key={index}
                              className="cursor-pointer overflow-hidden p-2 hover:bg-[var(--vscode-list-hoverBackground)]"
                              onClick={() => handleBranchSelect(result)}
                              data-tooltip-id="code-review-tooltips"
                              data-tooltip-content={result}
                              data-tooltip-place="top-start"
                              data-tooltip-class-name="z-50 max-w-[80%]"
                              data-tooltip-effect="solid"
                            >
                              <div className="flex items-center gap-2">
                                <GitBranch className="h-3.5 w-3.5 flex-shrink-0 text-purple-600 dark:text-purple-400" />
                                <span className="w-full truncate font-mono text-sm">{result}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center justify-center p-4">
                            <p className="text-xs text-[var(--vscode-descriptionForeground)]">
                              {searchQuery
                                ? 'No branches found'
                                : 'Start typing to search branches'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <ArrowLeft className="min-h-4 min-w-4 flex-shrink-0 text-gray-400" />

                  {/* Source Branch */}
                  <div className="min-w-0 flex-1">
                    <div
                      className="flex w-full items-center gap-2 overflow-hidden rounded-md border border-[var(--vscode-editorWidget-border)] p-2"
                      style={{
                        backgroundColor: 'var(--vscode-editor-background)',
                      }}
                    >
                      <GitBranch className="h-3.5 w-3.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                      <span className="truncate font-mono text-sm">{new_review.source_branch}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="flex flex-col gap-2 px-4 py-2">
                {/* Files Section */}
                <div
                  className="overflow-hidden rounded-lg border border-[var(--vscode-editorWidget-border)] shadow-sm"
                  style={{
                    backgroundColor: 'var(--vscode-editor-background)',
                  }}
                >
                  <motion.div
                    className={`flex cursor-pointer items-center justify-between p-3 ${showFilesToReview && 'border-b border-[var(--vscode-editorWidget-border)]'}`}
                    onClick={() => setShowFilesToReview(!showFilesToReview)}
                    whileHover={{ backgroundColor: 'var(--vscode-list-hoverBackground)' }}
                    initial={false}
                  >
                    <div className="flex items-center gap-2">
                      <motion.div
                        animate={{ rotate: showFilesToReview ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </motion.div>
                      <h2 className="font-medium">
                        Files changed ({new_review?.file_wise_changes?.length})
                      </h2>
                    </div>
                  </motion.div>

                  <AnimatePresence>
                    {showFilesToReview && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{
                          opacity: 1,
                          height: 'auto',
                          transition: {
                            opacity: { duration: 0.2 },
                            height: { duration: 0.3, ease: 'easeInOut' },
                          },
                        }}
                        exit={{
                          opacity: 0,
                          height: 0,
                          transition: {
                            opacity: { duration: 0.15 },
                            height: { duration: 0.25, ease: 'easeInOut' },
                          },
                        }}
                        className="overflow-hidden"
                      >
                        {/* Loading State */}
                        {isFetchingChangedFiles && (
                          <div className="flex min-h-0 flex-1 flex-col">
                            <div className="p-5">
                              <div className="flex items-center justify-center space-x-2">
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                                <span className="font-mono text-xs italic">
                                  Analyzing Changes...
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* No files changed */}
                        {!isFetchingChangedFiles && new_review?.file_wise_changes?.length === 0 && (
                          <div className="flex min-h-0 flex-1 flex-col">
                            <div className="p-5">
                              <div className="flex items-center justify-center">
                                <span className="font-mono text-xs italic">
                                  {getNoChangesFoundText()}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {!isFetchingChangedFiles && new_review?.file_wise_changes?.length !== 0 && (
                          <div className="flex min-h-0 flex-1 flex-col">
                            <div className="max-h-[260px] divide-y divide-[var(--vscode-editorWidget-border)] overflow-y-auto">
                              {new_review?.file_wise_changes?.map((file) => (
                                <motion.div
                                  key={file.file_path}
                                  className="cursor-pointer p-3 hover:bg-[var(--vscode-list-hoverBackground)]"
                                  onClick={() =>
                                    openFileDiff({
                                      udiff: file.diff,
                                      filePath: file.file_path,
                                      fileName: file.file_name,
                                    })
                                  }
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{
                                    opacity: 1,
                                    x: 0,
                                    transition: {
                                      duration: 0.2,
                                      ease: 'easeOut',
                                    },
                                  }}
                                  exit={{
                                    opacity: 0,
                                    x: -10,
                                    transition: {
                                      duration: 0.15,
                                      ease: 'easeIn',
                                    },
                                  }}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex min-w-0 items-center">
                                      <span
                                        className={`mr-2 rounded px-1.5 py-0.5 font-mono text-xs ${getStatusColor(file.status)}`}
                                      >
                                        {file.status}
                                      </span>
                                      <div className="truncate">
                                        <div className="truncate font-medium">{file.file_name}</div>
                                        <div className="truncate text-xs text-[var(--vscode-descriptionForeground)]">
                                          {file.file_path}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center text-xs text-[var(--vscode-descriptionForeground)]">
                                      <span className="flex gap-2 font-mono text-xs">
                                        <span className="text-green-600">
                                          +{file.line_changes.added}
                                        </span>
                                        <span className="text-red-600">
                                          -{file.line_changes.removed}
                                        </span>
                                      </span>
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}

          {useCodeReviewStore.getState().showReviewProcess && <Review />}

          <ReviewModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onStartReview={() => {
              setIsModalOpen(false);
              setShowFilesToReview(false);
              handleStartReview();
            }}
          />

          {useCodeReviewStore.getState().showReviewError && (
            <div className="mb-2 flex w-full items-center justify-center px-4">
              <div className="text-center">
                <span className="text-xs italic text-red-500">
                  {useCodeReviewStore.getState().reviewErrorMessage ||
                    'An error occurred during the review process.'}
                </span>
              </div>
            </div>
          )}

          {useCodeReviewStore.getState().new_review.fail_message &&
            !useCodeReviewStore.getState().new_review.eligible_for_review && (
              <div className="mb-2 flex w-full items-center justify-center px-4">
                <div className="text-center">
                  <span className="text-xs italic text-yellow-500">
                    {useCodeReviewStore.getState().new_review.fail_message}
                  </span>
                </div>
              </div>
            )}

          {/* Review Button */}
          <div ref={dropDownRef} className="relative px-4">
            <div className="flex gap-2">
              <div className="relative flex w-full items-center rounded-md border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] p-2">
                {useCodeReviewStore.getState().reviewStatus === 'IDLE' && (
                  <button
                    className={`flex-1 text-center ${
                      useCodeReviewStore.getState().new_review?.file_wise_changes?.length === 0 ||
                      !useCodeReviewStore.getState().new_review.eligible_for_review
                        ? 'cursor-not-allowed'
                        : 'cursor-pointer'
                    } `}
                    disabled={
                      useCodeReviewStore.getState().new_review?.file_wise_changes?.length === 0 ||
                      !useCodeReviewStore.getState().new_review.eligible_for_review
                    }
                    onClick={() => {
                      setIsModalOpen(true);
                    }}
                  >
                    {activeReviewOption.displayName}
                  </button>
                )}

                {useCodeReviewStore.getState().reviewStatus === 'IDLE' && (
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-px bg-[var(--vscode-editorWidget-border)]" />
                    <div
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowReviewOptions(!showReviewOptions);
                        setShowAgents(false);
                      }}
                    >
                      <ChevronDown
                        className={`h-4 w-4 text-[var(--vscode-foreground)] transition-transform ${showReviewOptions ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>
                )}

                {useCodeReviewStore.getState().reviewStatus === 'RUNNING' && (
                  <span
                    className="flex-1 cursor-pointer text-center text-red-700"
                    onClick={() => {
                      cancelReview();
                    }}
                  >
                    Stop Review
                  </span>
                )}

                {(useCodeReviewStore.getState().reviewStatus === 'COMPLETED' ||
                  useCodeReviewStore.getState().reviewStatus === 'STOPPED' ||
                  useCodeReviewStore.getState().reviewStatus === 'FAILED') && (
                  <span
                    className="flex-1 cursor-pointer text-center"
                    onClick={() => {
                      handleResetReview();
                    }}
                  >
                    New Review
                  </span>
                )}
              </div>
              <div className="flex cursor-pointer items-center rounded-md border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] p-2">
                <button
                  className="flex items-center gap-2"
                  onClick={() => {
                    setShowAgents(!showAgents);
                    setShowReviewOptions(false);
                  }}
                >
                  <BotMessageSquare className="h-4 w-4 text-[var(--vscode-foreground)]" />
                  <span className="text-[var(--vscode-foreground)]">Agents</span>
                </button>
              </div>
            </div>

            {/* Review Options Dropdown */}
            <AnimatePresence>
              {showReviewOptions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{
                    opacity: 1,
                    height: 'auto',
                    transition: {
                      opacity: { duration: 0.2 },
                      height: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
                    },
                  }}
                  exit={{
                    opacity: 0,
                    height: 0,
                    transition: {
                      opacity: { duration: 0.15 },
                      height: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
                    },
                  }}
                  className="overflow-hidden"
                >
                  <div className="mt-1 rounded-md border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)]">
                    <div className="max-h-48 overflow-y-auto">
                      {reviewOptions.map((option) => (
                        <div
                          key={option.value}
                          className="cursor-pointer p-2 text-left text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
                          onClick={() => {
                            useCodeReviewStore.setState({ activeReviewOption: option });
                            handleNewReview();
                            setShowReviewOptions(false);
                          }}
                        >
                          {option.displayName}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Agents Selection Dropdown */}
            <AnimatePresence mode="wait">
              {showAgents && userAgents.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{
                    opacity: 1,
                    height: 'auto',
                    transition: {
                      opacity: { duration: 0.2 },
                      height: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
                    },
                  }}
                  exit={{
                    opacity: 0,
                    height: 0,
                    transition: {
                      opacity: { duration: 0.15 },
                      height: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
                    },
                  }}
                  className="overflow-hidden"
                >
                  <div
                    className={`mt-1 rounded-md border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] ${
                      isAgentExpanded || showCreateAgentForm ? 'max-h-[700px]' : 'max-h-80'
                    }`}
                  >
                    <div
                      className={`${
                        isAgentExpanded || showCreateAgentForm ? 'max-h-[680px]' : 'max-h-80'
                      } ${isAgentExpanded ? 'overflow-y-auto' : 'overflow-hidden'}`}
                    >
                      {/* Predefined Agents */}
                      <div className="sticky top-0 z-10 border-b border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] px-2 pb-1 pt-4 text-sm font-semibold text-[var(--vscode-foreground)]">
                        DeputyDev Agents
                      </div>
                      <div
                        className={`${isAgentExpanded ? 'h-auto' : 'max-h-[90px]'} overflow-y-auto`}
                      >
                        {userAgents.filter((agent) => !agent.is_custom_agent).length === 0 && (
                          <div className="p-2 text-xs text-[var(--vscode-descriptionForeground)]">
                            No DeputyDev agents available.
                          </div>
                        )}
                        {userAgents
                          .filter((agent) => !agent.is_custom_agent)
                          .map((agent) => (
                            <div key={agent.id} className="w-full">
                              <div
                                className="flex w-full cursor-pointer items-center justify-between p-2 text-left text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
                                onClick={() => toggleAgentExpansion(agent.id)}
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <BotMessageSquare className="h-4 w-4 flex-shrink-0" />
                                  <span className="flex-1 truncate">{agent.display_name}</span>
                                  <Info
                                    className="mr-2 h-4 w-4 flex-shrink-0 opacity-30 hover:opacity-60"
                                    data-tooltip-id="code-review-tooltips"
                                    data-tooltip-content={agent.objective}
                                    data-tooltip-place="top-start"
                                    data-tooltip-class-name="z-50 max-w-[80%]"
                                    data-tooltip-effect="solid"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleAgent(agent.id, agent.display_name);
                                      }}
                                      className={`relative h-4 w-8 rounded-full transition-colors duration-300 ${
                                        enabledAgents.some(
                                          (enabledAgent) => enabledAgent.id === agent.id
                                        )
                                          ? 'bg-green-500'
                                          : 'bg-gray-300'
                                      }`}
                                    >
                                      <div
                                        className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-md transition-transform duration-300 ${
                                          enabledAgents.some(
                                            (enabledAgent) => enabledAgent.id === agent.id
                                          )
                                            ? 'translate-x-4'
                                            : 'translate-x-0'
                                        }`}
                                      />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Predefined Agent Dropdown */}
                              <AnimatePresence mode="wait">
                                {expandedAgentId === agent.id && (
                                  <motion.div
                                    key={`predefined-${agent.id}`}
                                    className="overflow-hidden border-t border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)]"
                                    variants={dropdownVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="hidden"
                                    transition={{ duration: 0.2 }}
                                  >
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        const formData = new FormData(e.currentTarget);
                                        const agentPrompt = formData.get('agentPrompt') as string;
                                        handleUpdatePredefinedAgent(agent.id, agentPrompt);
                                      }}
                                      className="px-4 py-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="mb-3">
                                        <label className="mb-1 block text-xs text-[var(--vscode-descriptionForeground)]">
                                          Agent Prompt
                                        </label>
                                        <textarea
                                          name="agentPrompt"
                                          className="w-full rounded border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-input-background)] p-2 text-xs text-[var(--vscode-input-foreground)]"
                                          rows={3}
                                          defaultValue={agent.custom_prompt || ''}
                                          onClick={(e) => e.stopPropagation()}
                                          placeholder={
                                            agent.custom_prompt ? '' : 'Enter agent prompt...'
                                          }
                                          required
                                        />
                                      </div>
                                      <div className="flex justify-end space-x-2">
                                        <button
                                          type="button"
                                          className="rounded bg-[var(--vscode-button-secondaryBackground)] px-3 py-1 text-xs text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedAgentId(null);
                                            setIsAgentExpanded(false);
                                          }}
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="submit"
                                          className="rounded bg-[var(--vscode-button-background)] px-3 py-1 text-xs text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
                                        >
                                          Save
                                        </button>
                                      </div>
                                    </form>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ))}
                      </div>

                      {/* Custom Agents */}
                      <div className="sticky top-0 z-10 border-b border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] px-2 pb-1 pt-4 text-sm font-semibold text-[var(--vscode-foreground)]">
                        Custom Agents
                      </div>
                      <div
                        className={`${isAgentExpanded ? 'h-auto' : 'max-h-[90px]'} overflow-y-auto`}
                      >
                        {userAgents.filter((agent) => agent.is_custom_agent).length === 0 && (
                          <div className="p-2 text-xs text-[var(--vscode-descriptionForeground)]">
                            No custom agents available. You can create one.
                          </div>
                        )}
                        {userAgents
                          .filter((agent) => agent.is_custom_agent)
                          .map((agent) => (
                            <div key={agent.id} className="w-full">
                              <div
                                className="flex w-full cursor-pointer items-center justify-between p-2 text-left text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
                                onClick={() => toggleAgentExpansion(agent.id)}
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <BotMessageSquare className="h-4 w-4 flex-shrink-0" />
                                  <span className="flex-1 truncate">{agent.display_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleAgent(agent.id, agent.display_name);
                                      }}
                                      className={`relative h-4 w-8 rounded-full transition-colors duration-300 ${
                                        enabledAgents.some(
                                          (enabledAgent) => enabledAgent.id === agent.id
                                        )
                                          ? 'bg-green-500'
                                          : 'bg-gray-300'
                                      }`}
                                    >
                                      <div
                                        className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-md transition-transform duration-300 ${
                                          enabledAgents.some(
                                            (enabledAgent) => enabledAgent.id === agent.id
                                          )
                                            ? 'translate-x-4'
                                            : 'translate-x-0'
                                        }`}
                                      />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Custom Agent Dropdown */}
                              <AnimatePresence mode="wait">
                                {expandedAgentId === agent.id && (
                                  <motion.div
                                    key={`custom-${agent.id}`}
                                    className="overflow-hidden border-t border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)]"
                                    variants={dropdownVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="hidden"
                                    transition={{ duration: 0.2 }}
                                  >
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        const formData = new FormData(e.currentTarget);
                                        const agentName = formData.get('agentName') as string;
                                        const agentPrompt = formData.get('agentPrompt') as string;
                                        handleUpdateCustomAgent(agent.id, agentName, agentPrompt);
                                      }}
                                      className="px-4 py-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="mb-3">
                                        <label className="mb-1 block text-xs text-[var(--vscode-descriptionForeground)]">
                                          Agent Name
                                        </label>
                                        <input
                                          name="agentName"
                                          type="text"
                                          className="mb-3 w-full rounded border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-input-background)] p-2 text-xs text-[var(--vscode-input-foreground)]"
                                          defaultValue={agent.display_name || ''}
                                          onClick={(e) => e.stopPropagation()}
                                          placeholder={
                                            agent.display_name ? '' : 'Enter agent name...'
                                          }
                                          required
                                        />
                                      </div>
                                      <div className="mb-3">
                                        <label className="mb-1 block text-xs text-[var(--vscode-descriptionForeground)]">
                                          Agent Prompt
                                        </label>
                                        <textarea
                                          name="agentPrompt"
                                          className="w-full rounded border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-input-background)] p-2 text-xs text-[var(--vscode-input-foreground)]"
                                          rows={3}
                                          defaultValue={agent.custom_prompt || ''}
                                          onClick={(e) => e.stopPropagation()}
                                          placeholder={
                                            agent.custom_prompt ? '' : 'Enter agent prompt...'
                                          }
                                          required
                                        />
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(agent.id);
                                          }}
                                          className="hover:bg-[var(--vscode-errorForeground)]/90 rounded bg-[var(--vscode-errorForeground)] px-3 py-1 text-xs text-white"
                                        >
                                          Delete
                                        </button>
                                        <div className="flex space-x-2">
                                          <button
                                            type="button"
                                            className="rounded bg-[var(--vscode-button-secondaryBackground)] px-3 py-1 text-xs text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setExpandedAgentId(null);
                                              setIsAgentExpanded(false);
                                            }}
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="submit"
                                            className="rounded bg-[var(--vscode-button-background)] px-3 py-1 text-xs text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
                                          >
                                            Save
                                          </button>
                                        </div>
                                      </div>
                                    </form>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ))}
                      </div>
                      {/* Create Custom Agent Button */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          const agentName = formData.get('agentName') as string;
                          const agentPrompt = formData.get('agentPrompt') as string;
                          handleCreateAgent(agentName, agentPrompt);
                        }}
                        className="mt-2 p-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Your existing button to toggle the form */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCreateAgentForm();
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--vscode-button-secondaryBackground)] px-3 py-2 text-xs text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Create Custom Agent
                        </button>

                        {/* Form content */}
                        <AnimatePresence>
                          {showCreateAgentForm && (
                            <motion.div
                              key="create-agent-form"
                              className="overflow-hidden bg-[var(--vscode-editor-background)]"
                              variants={dropdownVariants}
                              initial="hidden"
                              animate="visible"
                              exit="hidden"
                              transition={{ duration: 0.2 }}
                            >
                              <div className="px-2 py-2">
                                <div className="mb-3">
                                  <label className="mb-1 block text-xs text-[var(--vscode-descriptionForeground)]">
                                    Agent Name
                                  </label>
                                  <input
                                    name="agentName"
                                    type="text"
                                    required
                                    className="mb-3 w-full rounded border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-input-background)] p-2 text-xs text-[var(--vscode-input-foreground)]"
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder="Enter agent name..."
                                  />
                                </div>
                                <div className="mb-3">
                                  <label className="mb-1 block text-xs text-[var(--vscode-descriptionForeground)]">
                                    Agent Prompt
                                  </label>
                                  <textarea
                                    name="agentPrompt"
                                    className="w-full rounded border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-input-background)] p-2 text-xs text-[var(--vscode-input-foreground)]"
                                    rows={3}
                                    required
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder="Enter agent prompt..."
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="flex-1" />
                                  <div className="flex space-x-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowCreateAgentForm(false);
                                        const form = e.currentTarget.closest('form');
                                        if (form) {
                                          form.reset();
                                        }
                                      }}
                                      className="rounded bg-[var(--vscode-button-secondaryBackground)] px-3 py-1 text-xs text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="submit"
                                      className="rounded bg-[var(--vscode-button-background)] px-3 py-1 text-xs text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
                                    >
                                      Create
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </form>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Reviews History */}
          <PastReviews />
          <Tooltip id="code-review-tooltips" />
        </div>
      </PageTransition>
    </div>
  );
}
