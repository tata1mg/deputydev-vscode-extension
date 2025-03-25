import { openBrowserPage } from "@/commandApi";
import { useChatStore } from "@/stores/chatStore";


export default function ForceUpgradeView() {
  const {forceUpgradeData} = useChatStore();
  return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
          <h1 className="text-xl font-bold mb-4">Update Required</h1>
          <p className="text-center mb-4 text-gray-500">
              You need to install the updated version of the DeputyDev to continue using the application.
          </p>
          <div>
            <button className="border border-gray-500/10 bg-gray-500/20 w-[100px]"
              onClick={() => forceUpgradeData.url && openBrowserPage(forceUpgradeData.url)}
            >
                Visit here
            </button>
          </div>
      </div>
  );
}