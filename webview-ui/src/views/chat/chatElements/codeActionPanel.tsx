import { SnippetReference } from "./CodeBlockStyle";

import {
  writeFile
} from '@/commandApi';


export interface CodeActionPanelProps {
  language: string;
  filepath?: string;
  is_diff?: boolean;
  content: string;
  inline: boolean;
  diff?: string | null; // ✅ added
  added_lines?: number | null; // ✅ updated to match payload
  removed_lines?: number | null; // ✅ added
}





export function CodeActionPanel({
  language,
  filepath,
  is_diff,
  content,
  inline,
  diff,
  added_lines,
  removed_lines,
}: CodeActionPanelProps) {
  const combined = { language, filepath, is_diff, content, inline };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    alert('Code copied to clipboard!');
  };

  const handleApply = (filePath: string, diff: string) => {
    console.log('Apply clicked:', diff);
    writeFile({ filePath: filePath, raw_diff: diff });
    alert('Apply diff logic to be implemented.');
  };
  
  

  const handleInsert = () => {
    console.log('Insert clicked:', content);
    alert('Insert logic to be implemented.');
  };

  const snippet = {
    language,
    path: filepath,
    is_diff,
    content
  };

  const isApplyDisabled = !diff;

  // Extract the filename from the full path
  const filename = filepath ? filepath.split('/').pop() : '';

  return (
    <div className="bg-gray-900 border border-gray-500 rounded-md w-full overflow-hidden">
      <div className="flex justify-between items-center bg-neutral-700 px-3 py-1 border-gray-500 border-b h-8 text-neutral-300 text-xs">
        {is_diff && filepath ? (
          <span>
            Edit: <span className="font-medium">{filename}</span>{' '}
            <span className="text-green-400">+{added_lines || 0}</span>{' '}
            <span className="text-red-400">-{removed_lines || 0}</span>
          </span>
        ) : (
          <span>{language || 'plaintext'}</span>
        )}

        <div className="flex gap-2">
          <button
            className="text-neutral-300 hover:text-white text-xs active:scale-90 transition-transform duration-150"
            onClick={handleCopy}
          >
            Copy
          </button>

          {is_diff ? (
            <button
              className={`text-neutral-300 hover:text-white text-xs active:scale-90 transition-transform duration-150 ${
                isApplyDisabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => {
                if (filepath && diff) {
                  handleApply(filepath, diff);
                } else {
                  alert('File path or diff is missing!');
                }
              }}              
              disabled={isApplyDisabled}
            >
              Apply
            </button>
          ) :  null

          // (
          //   <button
          //     className="text-neutral-300 hover:text-white text-xs active:scale-90 transition-transform duration-150"
          //     onClick={handleInsert}
          //   >
          //     Insert
          //   </button>
          // )

          
          }
        </div>
      </div>
      <SnippetReference snippet={combined} />
    </div>
  );
}
