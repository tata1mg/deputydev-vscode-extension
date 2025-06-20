import { openBrowserPage } from '@/commandApi';
import { useForceUpgradeStore } from '@/stores/forceUpgradeStore';

export default function ForceUpgradeView() {
  const { forceUpgradeData } = useForceUpgradeStore();

  return (
    <div className="flex h-screen flex-col items-center justify-center p-4">
      <h1 className="mb-4 text-xl font-bold">Update Required</h1>
      <p className="mb-4 text-center text-gray-500">
        You’re currently on version <strong>{forceUpgradeData.currentVersion}</strong>.<br />
        DeputyDev requires at least version <strong>{forceUpgradeData.upgradeVersion}</strong> to
        continue.
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
