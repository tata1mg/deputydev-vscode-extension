import { TriangleAlert } from 'lucide-react';

const InfoChip: React.FC<{ info: string }> = ({ info }) => {
  return (
    <div className="mt-2 w-full rounded border border-gray-500/40 px-2 py-2">
      <div className="flex items-center gap-2 text-yellow-600">
        <TriangleAlert className="h-4 w-4 flex-shrink-0" />
        <p className="text-sm italic">{info}</p>
      </div>
    </div>
  );
};

export default InfoChip;
