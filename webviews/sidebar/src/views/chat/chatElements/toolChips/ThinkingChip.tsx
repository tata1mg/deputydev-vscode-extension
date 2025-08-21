import { useEffect, useState } from 'react';
import { ToolRunStatus } from '@/types';
import { CheckCircle, Loader2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { useThemeStore } from '@/stores/useThemeStore';
import { dracula, duotoneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

export const StatusIcon: React.FC<{ status: ToolRunStatus }> = ({ status }) => {
  switch (status) {
    case 'pending':
      return <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />;
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-400" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-400" />;
    case 'aborted':
      return <XCircle className="h-4 w-4" />;
    default:
      return null;
  }
};

export function ThinkingChip({
  status,
  thinkingText,
}: {
  status: ToolRunStatus;
  thinkingText: string;
}) {
  const [dots, setDots] = useState('.');
  const [showDropDown, setShowDropDown] = useState(false);
  const { themeKind } = useThemeStore();
  const highlighterStyle =
    themeKind === 'light' || themeKind === 'high-contrast-light' ? duotoneLight : dracula;

  useEffect(() => {
    if (status !== 'pending') return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + '.' : '.'));
    }, 500);
    return () => clearInterval(interval);
  }, [status]);

  let displayText = '';
  switch (status) {
    case 'pending':
      displayText = `Thinking${dots}`;
      break;
    case 'completed':
      displayText = 'Thinking Complete';
      break;
    case 'error':
      displayText = 'Thinking Failed';
      break;
    case 'aborted':
      displayText = 'Thinking Aborted';
      break;
    default:
      displayText = 'Thinking...';
  }

  const handleDropDown = () => {
    setShowDropDown(!showDropDown);
  };

  return (
    <div className="mt-2 w-full rounded border border-gray-500/40 px-2 py-2 text-sm">
      <div className="flex w-full flex-col gap-2">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon status={status} />
            <span className="text-xs font-bold">{displayText}</span>
          </div>

          {/* Don't remove commented currently, will be used for future dropdown functionality */}
          {/* <button className="cursor-pointer" onClick={() => handleDropDown()}>
            {!showDropDown ? <ChevronDown /> : <ChevronUp />}
          </button> */}
        </div>

        {/* Show request and response details */}
        {showDropDown && thinkingText && (
          <div className="relative overflow-x-hidden rounded bg-gray-500/10 p-2">
            <div className="word-break: max-h-[200px] w-full overflow-y-auto">
              <SyntaxHighlighter
                language="json"
                style={highlighterStyle}
                customStyle={{
                  fontSize: 'var(--vscode-font-size)',
                  fontWeight: 'var(--vscode-font-weight)',
                  fontFamily: 'var(--vscode-editor-font-family)',
                  backgroundColor: 'var(--vscode-editor-background)',
                  margin: 0,
                  padding: '1rem',
                  maxHeight: '200px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  wordWrap: 'break-word',
                  maxWidth: '100%',
                  overflowX: 'hidden',
                  overflowY: 'auto',
                  overflowWrap: 'break-word',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
                wrapLines={true}
                wrapLongLines={true}
                lineProps={{ style: { wordBreak: 'break-word', whiteSpace: 'pre-wrap' } }}
              >
                {thinkingText}
              </SyntaxHighlighter>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
