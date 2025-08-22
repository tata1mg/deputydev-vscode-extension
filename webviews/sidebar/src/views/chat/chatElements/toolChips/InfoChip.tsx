import { TriangleAlert } from 'lucide-react';

const InfoChip: React.FC<{ info: string }> = ({ info }) => {
  return (
    <div className="mt-2 w-full rounded border border-gray-500/40 p-2">
      <div className="flex items-center gap-2 text-yellow-500">
        <TriangleAlert className="h-4 w-4 flex-shrink-0" />
        <span className="text-xs italic">{info}</span>
      </div>
    </div>
  );
};

export default InfoChip;
