import { useThemeStore } from '@/stores/useThemeStore';
import { TriangleAlert } from 'lucide-react';

interface InfoChipProps {
  info: string;
}

const InfoChip: React.FC<InfoChipProps> = ({ info }) => {
  const { themeKind } = useThemeStore();

  const isLight = ['light', 'high-contrast-light'].includes(themeKind);

  return (
    <div
      className={`mt-2 flex flex-col items-start gap-1.5 rounded-md px-3 py-2 ${
        isLight ? 'bg-yellow-200/60' : 'bg-yellow-800/40'
      }`}
    >
      <div className={`flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-yellow-500'}`}>
        <TriangleAlert className="h-4 w-4 flex-shrink-0" />
        <p className="text-sm font-medium">Model Changed</p>
      </div>
      <div className="text-xs">{info}</div>
    </div>
  );
};

export default InfoChip;
