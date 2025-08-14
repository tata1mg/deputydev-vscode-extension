import { useEffect, useState } from 'react';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { ToolRunStatus } from '@/types';

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

export function ThinkingChip({ status }: { status: ToolRunStatus }) {
  const [dots, setDots] = useState('.');

  useEffect(() => {
    if (status !== 'pending') return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + '.' : '.'));
    }, 500);
    return () => clearInterval(interval);
  }, [status]);

  let displayText = '';
  let title = '';
  switch (status) {
    case 'pending':
      displayText = `Thinking${dots}`;
      title = 'Thinking...';
      break;
    case 'completed':
      displayText = 'Thinking complete';
      title = 'Thinking Complete';
      break;
    case 'error':
      displayText = 'Thinking failed';
      title = 'Error during thinking';
      break;
    case 'aborted':
      displayText = 'Thinking aborted';
      title = 'Thinking Aborted';
      break;
    default:
      displayText = 'Thinking...';
      title = 'Thinking...';
  }

  return (
    <div
      className="mt-2 flex w-full items-center gap-2 rounded border-[1px] border-gray-500/40 px-2 py-2 text-sm"
      title={title}
    >
      <StatusIcon status={status} />
      <span>{displayText}</span>
    </div>
  );
}
