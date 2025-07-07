import { useThemeStore } from '@/stores/useThemeStore';
import {
  ChevronUp,
  ChevronDown,
  ArrowRight,
  GitBranch,
  Check,
  User,
  Users,
  Pen,
  ChevronRight as ChevronRightIcon,
  MessageSquare,
} from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type FileStatus = 'A' | 'D' | 'M' | 'R' | 'C' | 'U';

interface FileChange {
  id: string;
  name: string;
  path: string;
  status: FileStatus;
  changes: string;
  comments: number;
}

interface Comment {
  id: string;
  text: string;
  line: number;
}

interface FileWithComments {
  path: string;
  comments: number;
}

interface Review {
  id: string;
  title: string;
  date: string;
  files: FileWithComments[];
  fileComments: Record<string, Comment[]>; // This allows any string key with Comment[] values
}

const mockReviews: Review[] = [
  {
    id: '1',
    title: 'Review 1',
    date: '2025-07-05',
    files: [
      { path: 'src/components/Button.tsx', comments: 3 },
      { path: 'src/utils/helpers.ts', comments: 1 },
    ],
    fileComments: {
      'src/components/Button.tsx': [
        { id: 'c1', text: 'Consider extracting this into a separate component', line: 23 },
        { id: 'c2', text: 'Missing prop validation', line: 45 },
        { id: 'c3', text: 'This could be optimized', line: 67 },
      ],
      'src/utils/helpers.ts': [{ id: 'c4', text: 'Add error handling here', line: 12 }],
    },
  },
  {
    id: '2',
    title: 'Review 2',
    date: '2025-07-01',
    files: [{ path: 'src/App.tsx', comments: 2 }],
    fileComments: {
      'src/App.tsx': [
        { id: 'c5', text: 'Consider using context for state management', line: 10 },
        { id: 'c6', text: 'Add loading state', line: 25 },
      ],
    },
  },
];

export default function CodeReview() {
  const { themeKind } = useThemeStore();
  const [showFilesToReview, setShowFilesToReview] = useState(true);
  const [showReviewOptions, setShowReviewOptions] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
  const [activeFilter, setActiveFilter] = useState('reviews');
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const sourceBranch = 'feature/new-feature';
  const targetBranch = 'main';

  const files: FileChange[] = [
    {
      id: '1',
      name: 'auth.service.ts',
      path: 'src/services/auth.service.ts',
      status: 'M',
      changes: '+124 -45',
      comments: 3,
    },
    {
      id: '2',
      name: 'user.controller.ts',
      path: 'src/controllers/user.controller.ts',
      status: 'M',
      changes: '+32 -12',
      comments: 2,
    },
    {
      id: '3',
      name: 'auth.middleware.ts',
      path: 'src/middleware/auth.middleware.ts',
      status: 'A',
      changes: '+89 -0',
      comments: 0,
    },
    {
      id: '4',
      name: 'types.ts',
      path: 'src/types/auth.types.ts',
      status: 'A',
      changes: '+45 -0',
      comments: 1,
    },
  ];

  const getStatusColor = (status: FileStatus) => {
    switch (status) {
      case 'A':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'D':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'M':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
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

  return (
    <PageTransition direction="right">
      <div className="relative flex h-full flex-col dark:bg-gray-900">
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
        <div className="p-2">
          {/* Branch Info */}
          <div className="mt-2 flex items-center justify-center">
            <div
              className="flex items-center rounded-md border border-[var(--vscode-editorWidget-border)] p-2"
              style={{
                backgroundColor: 'var(--vscode-editor-background)',
              }}
            >
              <GitBranch className="mr-1.5 h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span className="font-mono text-sm">{sourceBranch}</span>
            </div>
            <ArrowRight className="mx-2 h-4 w-4 text-gray-400" />
            <div
              className="flex items-center rounded-md border border-[var(--vscode-editorWidget-border)] p-2"
              style={{
                backgroundColor: 'var(--vscode-editor-background)',
              }}
            >
              <GitBranch className="mr-1.5 h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              <span className="font-mono text-sm">{targetBranch}</span>
              <Pen className="ml-1.5 h-3.5 w-3.5 cursor-pointer text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]" />
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
              className="flex cursor-pointer items-center justify-between border-b border-[var(--vscode-editorWidget-border)] p-3"
              onClick={() => setShowFilesToReview(!showFilesToReview)}
              whileHover={{ backgroundColor: 'var(--vscode-list-hoverBackground)' }}
              initial={false}
            >
              <div className="flex items-center gap-2">
                <motion.span transition={{ duration: 0.2 }}>
                  {showFilesToReview ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </motion.span>
                <h2 className="font-medium">Files changed ({files.length})</h2>
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
                  <div className="divide-y divide-[var(--vscode-editorWidget-border)]">
                    {files.map((file) => (
                      <motion.div
                        key={file.id}
                        className="cursor-pointer p-3 hover:bg-[var(--vscode-list-hoverBackground)]"
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
                              <div className="truncate font-medium">{file.name}</div>
                              <div className="truncate text-xs text-[var(--vscode-descriptionForeground)]">
                                {file.path}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4 text-sm">
                            <span className="font-mono text-xs text-[var(--vscode-descriptionForeground)]">
                              {file.changes}
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

          {/* Review Button */}
          <div className="relative">
            <div className="flex w-full items-center justify-between rounded-md border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] px-4 py-2">
              <div className="flex items-center gap-2">
                <span>Review All Changes</span>
                <div className="flex items-center gap-1">
                  <ChevronDown
                    className={`h-4 w-4 text-[var(--vscode-foreground)] transition-transform ${showReviewOptions ? 'rotate-180' : ''}`}
                    onClick={() => {
                      setShowReviewOptions(!showReviewOptions);
                      setShowAgents(false);
                    }}
                  />
                  <div className="h-5 w-px bg-[var(--vscode-editorWidget-border)]"></div>
                </div>
              </div>
              <button
                className="flex cursor-pointer items-center gap-2"
                onClick={() => {
                  setShowAgents(!showAgents);
                  setShowReviewOptions(false);
                }}
              >
                <span>Select Agents</span>
                <Users className="h-4 w-4 text-[var(--vscode-foreground)]" />
              </button>
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
                      {['Review Uncommitted', 'Review Committed', 'Review All Changes'].map(
                        (option) => (
                          <div
                            key={option}
                            className="cursor-pointer p-2 hover:bg-[var(--vscode-list-hoverBackground)]"
                          >
                            {option}
                          </div>
                        )
                      )}
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
                          className="flex w-full cursor-pointer items-center gap-2 p-2 hover:bg-[var(--vscode-list-hoverBackground)]"
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

          {/* Reviews Panel */}
          <div className="mt-2 flex h-full flex-col">
            {/* Filter Tabs */}
            <div
              className="flex w-full rounded-t-lg border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)]"
              style={{
                boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
              }}
            >
              {['reviews', 'agent', 'tags'].map((filter) => (
                <button
                  key={filter}
                  className={`relative flex-1 px-4 py-2 text-center text-sm font-medium transition-colors duration-200 ${
                    activeFilter === filter
                      ? 'text-[var(--vscode-textLink-foreground)]'
                      : 'text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]'
                  }`}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  {activeFilter === filter && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--vscode-textLink-foreground)]"
                      layoutId="activeTab"
                      transition={{
                        type: 'spring',
                        bounce: 0.2,
                        duration: 0.6,
                      }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Reviews List */}
            <div
              className="flex-1 overflow-auto rounded-b-lg border border-t-0 border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)]"
              style={{
                boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
              }}
            >
              {mockReviews.map((review) => (
                <div
                  key={review.id}
                  className="m-2 rounded border border-[var(--vscode-editorWidget-border)] transition-colors hover:border-[var(--vscode-focusBorder)]"
                >
                  {/* Review Header */}
                  <div
                    className="flex cursor-pointer items-center justify-between rounded bg-[var(--vscode-editor-background)] p-3 hover:bg-[var(--vscode-list-hoverBackground)]"
                    onClick={() => toggleReview(review.id)}
                  >
                    <div className="flex items-center">
                      <motion.div
                        animate={{ rotate: expandedReview === review.id ? 0 : -180 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronRightIcon size={16} />
                      </motion.div>
                      <span className="ml-2 font-medium">{review.title}</span>
                      <span className="ml-2 text-xs text-[var(--vscode-descriptionForeground)]">
                        {review.date}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--vscode-descriptionForeground)]">
                      {review.files.length} files •{' '}
                      {review.files.reduce((sum, file) => sum + file.comments, 0)} comments
                    </div>
                  </div>

                  {/* Files List */}
                  <AnimatePresence>
                    {expandedReview === review.id && (
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
                        className="overflow-hidden border-t border-[var(--vscode-editorWidget-border)]"
                      >
                        {review.files.map((file) => (
                          <div key={file.path} className="pl-6">
                            <div
                              className="flex cursor-pointer items-center justify-between p-3 hover:bg-[var(--vscode-list-hoverBackground)]"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFile(file.path);
                              }}
                            >
                              <div className="flex items-center">
                                <motion.div
                                  animate={{ rotate: expandedFile === file.path ? 0 : -90 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <ChevronRightIcon size={14} />
                                </motion.div>
                                <span className="ml-2 text-sm">{file.path}</span>
                              </div>
                              <div className="flex items-center text-xs text-[var(--vscode-descriptionForeground)]">
                                <MessageSquare size={12} className="mr-1" />
                                {file.comments}
                              </div>
                            </div>

                            {/* Comments List */}
                            <AnimatePresence>
                              {expandedFile === file.path && (
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
                                  {(review.fileComments as Record<string, Comment[]>)[
                                    file.path
                                  ]?.map((comment) => (
                                    <div
                                      key={comment.id}
                                      className="border-t border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] py-3 pl-6 pr-3 text-sm"
                                    >
                                      <div className="mb-1 text-xs text-[var(--vscode-descriptionForeground)]">
                                        Line {comment.line}
                                      </div>
                                      <div>{comment.text}</div>
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
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
