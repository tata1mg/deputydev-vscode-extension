import React, { useEffect, useState } from 'react';
import {FileText, CheckCircle, Loader2, XCircle, Search } from 'lucide-react';
import { Tooltip } from "react-tooltip";
// import "react-tooltip/dist/react-tooltip.css"; // Import CSS for styling
import { openFile } from "@/commandApi";
import { reduce } from 'lodash';
/**
 * 
 * Represents the status of chips
 */
export type Status = 'pending' | 'completed' | 'error';

/**
 * Props common to both analyzed code and searched codebase.
 */
// interface CommonProps {
//   fileName?: string;
//   status: Status;
//   onClick?: () => void;
//   autoFetchChunks?: boolean;
// }


/**
 * Props for the ThinkingChip component.
 */
interface ThinkingChipProps {
  completed?: boolean;
}


/**
 * Status Icon Component - Prevents duplication of status icon logic.
 */
const StatusIcon: React.FC<{ status: Status }> = ({ status }) => {
  switch (status) {
    case 'pending':
      return <Loader2 className=" w-4 h-4 text-yellow-400 animate-spin" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'error':
      return <XCircle className="  w-4 h-4 text-red-400" />;
    default:
      return null;
  }
};

/**
 * Component for Analyzed Code Item.
 */

// export function AnalyzedCodeItem({ fileName, status, onClick, autoFetchChunks = false }: CommonProps) {
//   const [chunks, setChunks] = useState<string[]>([]);
//   const [errorMessage, setErrorMessage] = useState('');

//   useEffect(() => {
//     if (autoFetchChunks && status === 'pending' && fileName) {
//       fetch('/api/find-chunks', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ fileName }),
//       })
//         .then((res) => res.json())
//         .then((data) => setChunks(data.chunks || []))
//         .catch((err) => setErrorMessage(err.message));
//     }
//   }, [status, autoFetchChunks, fileName]);

//   return (
//     <div
//       className="inline-flex items-center w-full gap-2 px-2 py-2 text-sm text-white border rounded cursor-pointer border-neutral-600"
//       onClick={onClick}
//       title="Analyzed Code Item"
//     >
//       <StatusIcon status={status} />
//       <span>{fileName ? `Analyzed: ${fileName}` : 'Analyzed Code Item'}</span>
//       {errorMessage && <span className="ml-2 text-xs text-red-400">Error</span>}
//     </div>
//   );
// }


/**
 * Component for Searched Codebase.
 * Displays status and file count based on props from history.
 */


export function SearchedCodebase({ status, fileCount }: { 
  status: Status;
  fileCount?: number; 
}) {
  let displayText = 'Searched codebase';
  if (status === 'pending') {
    displayText = 'Searching codebase...';
  } else if (status === 'error') {
    displayText = 'Error searching codebase';
  }

  return (
    <div
      className="flex items-center justify-between w-full px-2 py-2 text-sm rounded border-[1px] border-gray-500/40"
      title="Searched Codebase"
    >
      <div className="flex items-center gap-2">
        {status === 'pending' ? (
          <StatusIcon status={status} />
        ) : (
          <Search className="w-4 h-4 " />
        )}
        <span className="">{displayText}</span>
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

      className="flex items-center w-full gap-2 px-2 py-2 text-sm rounded border-[1px] border-gray-500/40"
      title={completed ? "Thinking Complete" : "Thinking..."}
    >
      {!completed ? (
        <>
          <StatusIcon status="pending" />
          <span>Thinking{dots}</span>
        </>
      ) : (
        <>
        <StatusIcon status="completed" />
        <span>Thinking complete</span>
        </>
      )}
    </div>
  );
}






/**
 * Component for file edited 
 * Displays file name and and lines changed
 */




export function FileEditedChip({ filepath ,added_lines  ,removed_lines, status}: { 
  filepath?: string;
  added_lines?: number | null;
  removed_lines?: number | null;
  status: Status;
}) {
  const filename = filepath ? filepath.split('/').pop() : '';


  let statusText;
  let statusColor = "";
  if (status === "pending") {
    statusText = "Editing";
  } else if (status === "completed") {
    statusText = "Edited";
  } else {
    statusText = "Error editing";
    statusColor = "text-red-400";
  }

  return (
    <div
      className="flex justify-between items-center  px-1 py-1.5 rounded border-[1px] border-gray-500/40 w-full  text-sm"
      title="File Edited"
    >
      <div className="flex items-center gap-2">
        <StatusIcon status={status} />
        <span className={statusColor}>{statusText}</span>
      {/* File Name Button */}
      {filepath && (
          <>
            <button 
              className=" px-1 py-0.5 rounded border-[1px] bg-neutral-600/5 border-gray-500/40  hover:text-white hover:bg-neutral-600 transition text-xs"
              onClick={() => openFile(filepath)}
              data-tooltip-id="filepath-tooltip"
              data-tooltip-content={filepath}
            >
              {filename}
            </button>
            <Tooltip id="filepath-tooltip" />
          </>
        )}
      </div>

      {/* Added & Removed Lines (only if status is not "error") */}
      {status !== "error" && (
        <div className="flex items-center gap-2 text-xs">
          {added_lines !== null && added_lines !== undefined && added_lines > 0 && (
            <span className="text-green-400">+{added_lines}</span>
          )}
          {removed_lines !== null && removed_lines !== undefined && removed_lines > 0 && (
            <span className="text-red-400">-{removed_lines}</span>
          )}
        </div>
      )}
    </div>
  );
}