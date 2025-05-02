import { openBrowserPage } from '@/commandApi';
import { useChatStore } from '@/stores/chatStore';

export default function ForceUpgradeView() {
  const { forceUpgradeData } = useChatStore();
  return (
    <div className="flex h-screen flex-col items-center justify-center p-4">
      <h1 className="mb-4 text-xl font-bold">Update Required</h1>
      <p className="mb-4 text-center text-gray-500">
        You need to install the updated version of the DeputyDev to continue using the application.
      </p>
      <div>
        <button
          className="text-md h-8 w-[100px] rounded border border-gray-500/10 bg-gray-500/20"
          onClick={() => forceUpgradeData.url && openBrowserPage(forceUpgradeData.url)}
        >
          Visit here
        </button>
      </div>
    </div>
  );
}
