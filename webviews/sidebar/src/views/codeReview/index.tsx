import { useThemeStore } from '@/stores/useThemeStore';
import {
  ChevronUp,
  ChevronDown,
  GitBranch,
  Check,
  Pen,
  ChevronLeftIcon,
  User,
  MessageSquare,
  Funnel,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { newReview, openFileDiff, searchBranches } from '@/commandApi';
import { useCodeReviewStore } from '@/stores/codeReviewStore';
import { useClickAway } from 'react-use';
import { Review, CodeReviewComment } from '@/types';

const mockReviews: Review[] = [
  {
    id: 2,
    repo_id: 1,
    user_team_id: 1,
    loc: 0,
    reviewed_files: [],
    execution_time_seconds: null,
    status: 'done',
    fail_message: null,
    review_datetime: null,
    comments: [
      {
        id: 1,
        review_id: 1,
        comment: 'Consider extracting this into a separate component',
        agent_id: 1,
        is_deleted: false,
        file_path: 'src/components/Button.tsx',
        line_hash: 'abc123',
        line_number: 23,
        tag: 'suggestion',
        is_valid: true,
        created_at: '2025-07-05T10:00:00Z',
        updated_at: '2025-07-05T10:00:00Z',
      },
      {
        id: 2,
        review_id: 1,
        comment: 'Consider extracting this into a separate component',
        agent_id: 1,
        is_deleted: false,
        file_path: 'src/components/Button.tsx',
        line_hash: 'abc123',
        line_number: 23,
        tag: 'suggestion',
        is_valid: true,
        created_at: '2025-07-05T10:00:00Z',
        updated_at: '2025-07-05T10:00:00Z',
      },
      {
        id: 3,
        review_id: 1,
        comment: 'Consider extracting this into a separate component',
        agent_id: 1,
        is_deleted: false,
        file_path: 'src/components/Button.tsx',
        line_hash: 'abc123',
        line_number: 23,
        tag: 'suggestion',
        is_valid: true,
        created_at: '2025-07-05T10:00:00Z',
        updated_at: '2025-07-05T10:00:00Z',
      },
      // Add more comments as needed
    ],
    is_deleted: false,
    deletion_datetime: null,
    meta_info: null,
    diff_s3_url: null,
    created_at: '2025-07-05T10:00:00Z',
    updated_at: '2025-07-05T10:00:00Z',
  },
  {
    id: 1,
    repo_id: 1,
    user_team_id: 1,
    loc: 0,
    reviewed_files: [],
    execution_time_seconds: null,
    status: 'done',
    fail_message: null,
    review_datetime: null,
    comments: [
      {
        id: 1,
        review_id: 1,
        comment: 'Consider extracting this into a separate component',
        agent_id: 1,
        is_deleted: false,
        file_path: 'src/components/Button.tsx',
        line_hash: 'abc123',
        line_number: 23,
        tag: 'suggestion',
        is_valid: true,
        created_at: '2025-07-05T10:00:00Z',
        updated_at: '2025-07-05T10:00:00Z',
      },
      {
        id: 2,
        review_id: 1,
        comment: 'Consider extracting this into a separate component',
        agent_id: 1,
        is_deleted: false,
        file_path: 'src/components/Button.tsx',
        line_hash: 'abc123',
        line_number: 23,
        tag: 'suggestion',
        is_valid: true,
        created_at: '2025-07-05T10:00:00Z',
        updated_at: '2025-07-05T10:00:00Z',
      },
      // Add more comments as needed
    ],
    is_deleted: false,
    deletion_datetime: null,
    meta_info: null,
    diff_s3_url: null,
    created_at: '2025-07-05T10:00:00Z',
    updated_at: '2025-07-05T10:00:00Z',
  },
  // Add more reviews as needed
];

export default function CodeReview() {
  const { themeKind } = useThemeStore();
  const { new_review, reviewOptions, activeReviewOption, searchedBranches, selectedTargetBranch } =
    useCodeReviewStore();
  const [showFilesToReview, setShowFilesToReview] = useState(true);
  const [showReviewOptions, setShowReviewOptions] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
  const [activeFilter, setActiveFilter] = useState('reviews');
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('d');
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const dropDownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const branchSelectorRef = useRef<HTMLDivElement>(null);

  const handleDiff = () => {
    openFileDiff();
  };

  useEffect(() => {
    handleNewReview();
  }, []);

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

  const toggleReview = (reviewId: string) => {
    setExpandedReview(expandedReview === reviewId ? null : reviewId);
    setExpandedFile(null);
  };

  const toggleFile = (filePath: string) => {
    setExpandedFile(expandedFile === filePath ? null : filePath);
  };

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
                            onClick={() => handleDiff()}
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
                              <div className="flex items-center space-x-4 text-sm">
                                <span className="flex gap-2 font-mono text-xs text-[var(--vscode-descriptionForeground)]">
                                  <span>+{file.line_changes.added}</span>
                                  <span>-{file.line_changes.removed}</span>
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
            <div className="flex w-full items-center justify-between rounded-md border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] p-2">
              <span>{activeReviewOption.displayName}</span>
              <div className="flex items-center gap-1">
                <ChevronDown
                  className={`h-4 w-4 cursor-pointer text-[var(--vscode-foreground)] transition-transform ${showReviewOptions ? 'rotate-180' : ''}`}
                  onClick={() => {
                    setShowReviewOptions(!showReviewOptions);
                    setShowAgents(false);
                  }}
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
                <User className="h-4 w-4 cursor-pointer text-[var(--vscode-foreground)] transition-transform" />
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
                        className="flex w-full cursor-pointer items-center gap-2 p-2 text-left text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
                      >
                        <span className="truncate">{agent}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Reviews History */}
        <div className="mt-2 flex h-full flex-col px-4">
          <div
            className="flex w-full rounded-t-lg border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)]"
            style={{
              boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
            }}
          >
            <div className="flex w-full items-center justify-between px-4 py-2">
              <div className="relative flex-1 text-sm font-medium">Past Reviews</div>
              <Funnel className="h-4 w-4" />
            </div>
          </div>

          <div
            className="flex-1 overflow-auto rounded-b-lg border border-t-0 border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)]"
            style={{
              boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
            }}
          >
            {mockReviews.map((review) => {
              // Group comments by file path
              const filesWithComments = review.comments.reduce<Record<string, CodeReviewComment[]>>(
                (acc, comment) => {
                  if (!acc[comment.file_path]) {
                    acc[comment.file_path] = [];
                  }
                  acc[comment.file_path].push(comment);
                  return acc;
                },
                {}
              );

              const fileCount = Object.keys(filesWithComments).length;
              const commentCount = review.comments.length;
              const reviewDate = new Date(review.created_at).toLocaleDateString();

              return (
                <div key={review.id} className="m-1 text-sm">
                  <div
                    className="flex cursor-pointer items-center justify-between rounded p-2 hover:bg-[var(--vscode-list-hoverBackground)]"
                    onClick={() => toggleReview(review.id.toString())}
                  >
                    <div className="flex items-center">
                      <motion.div
                        animate={{ rotate: expandedReview === review.id.toString() ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronRight size={14} />
                      </motion.div>
                      <span className="ml-1.5 font-medium">Review #{review.id}</span>
                      <span className="ml-1.5 text-xs text-[var(--vscode-descriptionForeground)]">
                        {reviewDate}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--vscode-descriptionForeground)]">
                      {fileCount} files • {commentCount} comments
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedReview === review.id.toString() && (
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
                        className="overflow-hidden border-t border-[var(--vscode-editorWidget-border)] text-xs"
                      >
                        {Object.entries(filesWithComments).map(([filePath, comments]) => (
                          <div key={filePath} className="pl-4">
                            <div
                              className="flex cursor-pointer items-center justify-between p-1.5 hover:bg-[var(--vscode-list-hoverBackground)]"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFile(filePath);
                              }}
                            >
                              <div className="flex items-center">
                                <motion.div
                                  animate={{ rotate: expandedFile === filePath ? 90 : 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <ChevronRight size={12} />
                                </motion.div>
                                <span className="ml-1.5 truncate">{filePath}</span>
                              </div>
                              <div className="flex items-center text-xs text-[var(--vscode-descriptionForeground)]">
                                <MessageSquare size={10} className="mr-0.5" />
                                {comments.length}
                              </div>
                            </div>

                            <AnimatePresence>
                              {expandedFile === filePath && (
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
                                  {comments.map((comment) => (
                                    <div
                                      key={comment.id}
                                      className="border-t border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] py-1.5 pl-6 pr-2 text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
                                    >
                                      <div className="text-[11px] text-[var(--vscode-descriptionForeground)]">
                                        Line {comment.line_number} • {comment.tag}
                                      </div>
                                      <div className="leading-tight">{comment.comment}</div>
                                    </div>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
