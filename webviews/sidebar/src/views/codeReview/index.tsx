import { useThemeStore } from '@/stores/useThemeStore';
import { ChevronDown, GitBranch, Check, Pen, UserCog, ArrowLeft, ChevronRight } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  fetchPastReviews,
  hitSnapshot,
  newReview,
  openFileDiff,
  searchBranches,
} from '@/commandApi';
import { useCodeReviewStore } from '@/stores/codeReviewStore';
import { useClickAway } from 'react-use';
import { PastReviews } from './PastReviews';

export default function CodeReview() {
  const { themeKind } = useThemeStore();
  const {
    new_review,
    reviewOptions,
    activeReviewOption,
    searchedBranches,
    selectedTargetBranch,
    pastReviews,
  } = useCodeReviewStore();
  const [showFilesToReview, setShowFilesToReview] = useState(true);
  const [showReviewOptions, setShowReviewOptions] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('d');
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const dropDownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const branchSelectorRef = useRef<HTMLDivElement>(null);
  const [enabledAgents, setEnabledAgents] = useState<string[]>([]);

  useEffect(() => {
    handleNewReview();
  }, []);

  useEffect(() => {
    fetchPastReviews({ sourceBranch: '' });
  }, []);

  const toggleAgent = (agent: string) => {
    setEnabledAgents((prev) =>
      prev.includes(agent) ? prev.filter((a) => a !== agent) : [...prev, agent]
    );
  };

  const handleNewReview = () => {
    console.log(
      'Triggering new review with branch:',
      useCodeReviewStore.getState().selectedTargetBranch
    );
    newReview({
      targetBranch: useCodeReviewStore.getState().selectedTargetBranch,
      reviewType: useCodeReviewStore.getState().activeReviewOption.value,
    });
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
    console.log('Trigger after branch selection');
    handleNewReview(); // Trigger new review with selected branch
  };

  return (
    <PageTransition direction="right">
      <div className="relative flex h-full flex-col gap-2 dark:bg-gray-900">
        {/* Header */}
        <div className="flex-grow">
          <div className="mt-10">
            <img src={deputyDevLogo} alt="DeputyDev Logo" className="h-10 w-auto px-4 opacity-90" />
          </div>
          <div className="mt-2 px-4 fade-in">
            <div className="flex items-center gap-2">
              <p className="mb-2 text-lg text-gray-400">You are ready to review your code.</p>
              <Check className="mb-1 animate-pulse text-sm text-green-500" />
            </div>
          </div>
        </div>

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
                      className="absolute z-50 mt-1 w-full rounded-md border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] shadow-lg"
                      style={{ maxHeight: '200px', overflowY: 'auto' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {searchedBranches && searchedBranches.length > 0 ? (
                        searchedBranches.map((result, index) => (
                          <div
                            key={index}
                            className="cursor-pointer overflow-hidden p-2 hover:bg-[var(--vscode-list-hoverBackground)]"
                            onClick={() => handleBranchSelect(result)}
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
                            {searchQuery ? 'No branches found' : 'Start typing to search branches'}
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
                                  <span className='text-green-600'>+{file.line_changes.added}</span>
                                  <span className='text-red-600'>-{file.line_changes.removed}</span>
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* Review Button */}
        <div ref={dropDownRef} className="relative px-4">
          <div className="flex gap-2">
            <div className="relative flex w-full items-center rounded-md border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] p-2">
              <span
                className="flex-1 cursor-pointer text-center"
                onClick={() => {
                  hitSnapshot(activeReviewOption.value);
                }}
              >
                {activeReviewOption.displayName}
              </span>
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
            <div className="flex items-center rounded-md border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] p-2">
              <button
                className="flex cursor-pointer items-center justify-between"
                onClick={() => {
                  setShowAgents(!showAgents);
                  setShowReviewOptions(false);
                }}
              >
                <UserCog className="h-4 w-4 cursor-pointer text-[var(--vscode-foreground)] transition-transform" />
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
          <AnimatePresence>
            {showAgents && (
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
                <div className="mt-1 rounded-md border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)]">
                  <div className="max-h-48 overflow-y-auto">
                    {['Security', 'Error', 'Suggestion'].map((agent) => (
                      <div
                        key={agent}
                        className="flex w-full cursor-pointer items-center justify-between p-2 text-left text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
                      >
                        <span className="truncate">{agent}</span>
                        <div className="flex items-center gap-2">
                          <div
                            className="mr-2 flex items-center space-x-2"
                            data-tooltip-id="mcp-tooltips"
                            data-tooltip-content="Enable/Disable Server"
                            data-tooltip-place="top-start"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAgent(agent);
                              }}
                              className={`relative h-4 w-8 rounded-full transition-colors duration-300 ${
                                enabledAgents.includes(agent) ? 'bg-green-500' : 'bg-gray-300'
                              }`}
                            >
                              <div
                                className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-md transition-transform duration-300 ${
                                  enabledAgents.includes(agent) ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Reviews History */}
        {pastReviews && pastReviews.length > 0 && <PastReviews />}
      </div>
    </PageTransition>
  );
}
