import { createNewWorkspace } from "@/commandApi";

export function CreateNewWorkspace({ content }: { content: string }) {
  const handleContinue = () => {
    createNewWorkspace();
    console.log("Continue clicked");
  };

  const handleCancel = () => {
    console.log("Cancel clicked");
  };

  return (
    <div className="w-full overflow-hidden rounded border border-gray-500/40 px-2 py-2 text-sm mt-2  shadow">
      <div className="text-xs space-y-1">
        <div className="font-medium text-sm text-white">
          Open an empty folder to continue
        </div>
        <div className="text-xs text-gray-300">
          DeputyDev requires an empty folder as a workspace to continue workspace creation.
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={handleCancel}
            className="px-3 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white font-medium"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
