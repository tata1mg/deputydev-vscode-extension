import { useThemeStore } from '@/stores/useThemeStore';
import { TriangleAlert } from 'lucide-react';

export function TerminalNoShellIntegration() {
  const { themeKind } = useThemeStore();

  return (
    <div
      className={`mt-2 flex flex-col items-start gap-1.5 rounded-md ${['light', 'high-contrast-light'].includes(themeKind) ? 'bg-yellow-200/60' : 'bg-yellow-800/40'} px-3 py-2`}
    >
      <div
        className={`flex items-center ${['light', 'high-contrast-light'].includes(themeKind) ? 'text-gray-900' : 'text-yellow-500'} gap-2`}
      >
        <TriangleAlert className="h-4 w-4" />
        <p className="text-sm font-medium">Shell Integration Unavailable</p>
      </div>
      <div className="text-xs">
        DeputyDev won't be able to view the command's output. Future terminal commands will use the
        fallback terminal provider.
      </div>
    </div>
  );
}
