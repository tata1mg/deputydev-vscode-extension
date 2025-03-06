import React, { useEffect, useState } from 'react';
import { CheckCircle, Loader2, XCircle, Search } from 'lucide-react';

/**
 * Represents the status of an analysis or search item.
 */
export type AnalysisStatus = 'in-progress' | 'done' | 'error' | 'idle';

/**
 * Props common to both analyzed code and searched codebase.
 */
interface CommonProps {
  fileName?: string;
  status: AnalysisStatus;
  onClick?: () => void;
  autoFetchChunks?: boolean;
}


/**
 * Props for the ThinkingChip component.
 */
interface ThinkingChipProps {
  completed?: boolean;
}


/**
 * Status Icon Component - Prevents duplication of status icon logic.
 */
const StatusIcon: React.FC<{ status: AnalysisStatus }> = ({ status }) => {
  switch (status) {
    case 'in-progress':
      return <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />;
    case 'done':
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return null;
  }
};

/**
 * Component for Analyzed Code Item.
 */
export function AnalyzedCodeItem({ fileName, status, onClick, autoFetchChunks = false }: CommonProps) {
  const [chunks, setChunks] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (autoFetchChunks && status === 'in-progress' && fileName) {
      fetch('/api/find-chunks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
      })
        .then((res) => res.json())
        .then((data) => setChunks(data.chunks || []))
        .catch((err) => setErrorMessage(err.message));
    }
  }, [status, autoFetchChunks, fileName]);

  return (
    <div
      className="inline-flex items-center gap-2 px-2 py-2 border border-neutral-600 rounded w-full text-white text-sm cursor-pointer"
      onClick={onClick}
      title="Analyzed Code Item"
    >
      <StatusIcon status={status} />
      <span>{fileName ? `Analyzed: ${fileName}` : 'Analyzed Code Item'}</span>
      {errorMessage && <span className="ml-2 text-red-400 text-xs">Error</span>}
    </div>
  );
}


/**
 * Component for Searched Codebase.
 * Displays status and file count based on props from history.
 */
export function SearchedCodebase({ status, fileCount }: { 
  status: 'in-progress' | 'completed' | 'error'; 
  fileCount?: number; 
}) {
  let displayText = 'Searched codebase';
  if (status === 'in-progress') {
    displayText = 'Searching codebase...';
  } else if (status === 'error') {
    displayText = 'Error searching codebase';
  }

  return (
    <div
      className="flex justify-between items-center bg-neutral-800 px-2 py-2 border border-neutral-600 rounded w-full text-white text-sm"
      title="Searched Codebase"
    >
      <div className="flex items-center gap-2">
        {status === 'in-progress' ? (
          <StatusIcon status={status} />
        ) : (
          <Search className="w-4 h-4 text-white" />
        )}
        <span className="text-white">{displayText}</span>
      </div>
      <div className="text-gray-300">
        {fileCount !== undefined ? `${fileCount} results` : ''}
      </div>
    </div>
  );
}



/**
 * Function component for ThinkingChip - Displays a chip representing a thinking state.
 */


export function ThinkingChip({ completed }: ThinkingChipProps) {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    if (completed) return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + "." : "."));
    }, 500);
    return () => clearInterval(interval);
  }, [completed]);

  return (
    <div

      className="flex items-center gap-2 px-2 py-2 border border-neutral-600 rounded w-full text-white text-sm"
      title={completed ? "Completed" : "Thinking..."}
    >
      {!completed ? (
        <>
          <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
          <span>Thinking{dots}</span>
        </>
      ) : (
        <>
          <CheckCircle className="w-4 h-4 text-green-400" />
          <span>Completed</span>
        </>
      )}
    </div>
  );
}
