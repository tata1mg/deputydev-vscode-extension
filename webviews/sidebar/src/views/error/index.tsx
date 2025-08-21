import * as React from 'react';
import { reloadWindow } from '@/commandApi';
import { RefreshCw } from 'lucide-react';

export default function Error() {
  const [isReloading, setIsReloading] = React.useState(false);

  const handleReload = () => {
    setIsReloading(true);
    reloadWindow(); // Triggers VS Code “Reload Window”
    // Fallback in case reload isn’t instant
    setTimeout(() => setIsReloading(false), 2000);
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-[480px] rounded-2xl border border-black/5 bg-[var(--vscode-editor-background)] p-6 shadow-xl">
        <div className="mb-3 text-center text-xl font-bold">Oops! Something went wrong</div>
        <p className="mb-1 text-center text-sm text-gray-400">Authentication failed !!!</p>
        <p className="mb-6 text-center text-sm text-gray-500">
          Please reload the editor and try again.
        </p>

        <div className="flex items-center justify-center">
          <button
            onClick={handleReload}
            disabled={isReloading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--vscode-button-background)] px-4 text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-60"
            aria-label="Reload VS Code"
          >
            <RefreshCw className={`h-4 w-4 ${isReloading ? 'animate-spin' : ''}`} />
            <span>{isReloading ? 'Reloading…' : 'Reload VS Code'}</span>
          </button>
        </div>
      </div>

      <div className="mt-6 text-center text-xs text-gray-500">
        DeputyDev is powered by AI. It can make mistakes. Please double check all output.
      </div>
    </div>
  );
}
