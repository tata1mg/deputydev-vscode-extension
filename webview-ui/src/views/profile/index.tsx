import { signOut, getGlobalState, openBrowserPage } from "@/commandApi";
import { useChatStore } from "@/stores/chatStore";
import { useEffect, useState } from "react";
import { UserRoundPen, BookOpenText, LogOut, Pen, Lightbulb, ChevronDown, ChevronRight, Bug } from "lucide-react";

export default function Profile() {
  const { userData } = useChatStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const fetchUserData = async () => {
    const userData = await getGlobalState({ key: "userData" });
    useChatStore.setState({ userData: userData });
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const handleUsageClick = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const handleRequestFeatureClick = () => {
    openBrowserPage("https://forms.gle/Abd1FJJVf3J2daLP7");
  }

  const handleReportBugClick = () => {
    openBrowserPage("https://forms.gle/s2Youjzo63YU9k7s9");
  }

  const handleSignOut = () => {
    signOut();
  }

  return (
    <div className="px-4 flex flex-col gap-2 mt-2">
      <button
        className={`flex w-full transform justify-between rounded-tr rounded-tl border border-gray-500/10 bg-gray-500/20 p-2 text-sm opacity-70 transition-transform hover:scale-105 hover:cursor-pointer hover:opacity-100`}
        onClick={() => {/* Handle Email button click */ }}
      >
        <div className="flex gap-2">
          <UserRoundPen />
          <span>{userData.email}</span>
        </div>
        <ChevronRight />
      </button>
      <div className="h-full">
        <button
          className={`flex w-full transform justify-between rounded-tr rounded-tl border border-gray-500/10 bg-gray-500/20 p-2 text-sm opacity-70 transition-transform hover:scale-105 hover:cursor-pointer hover:opacity-100`}
          onClick={handleUsageClick}
        >
          <div className="flex gap-2">
            <Pen />
            <span>Usage</span>
          </div>
          {dropdownOpen ? (<ChevronDown />) : (<ChevronRight />)}
        </button>
        <div className={`dropdown ${dropdownOpen ? 'open' : ''}`}>
          {dropdownOpen && (
            <div className="p-2 bg-gray-500/20 rounded-bl rounded-br">
              <p className="text-md">Current Plan</p>
              <div className="mt-2 flex justify-between mb-2">
                <div className="text-sm text-gray-400 text-left">{userData.email}</div>
                <div className="text-sm border bg-gray-500 rounded-lg p-1">Exclusive</div>
              </div>
              <p className="text-md">Premium Requests</p>
              <div className="flex flex-col gap-2 mt-2">
                <div className="w-full h-2 bg-green-500 rounded" />
                <div className="text-sm text-gray-400 text-right">2.3k of unlimited</div>
              </div>
            </div>
          )}
        </div>
      </div>
      <button
        className={`flex w-full transform justify-between rounded-tr rounded-tl border border-gray-500/10 bg-gray-500/20 p-2 text-sm opacity-70 transition-transform hover:scale-105 hover:cursor-pointer hover:opacity-100`}
        onClick={() => {/* Handle Docs button click */ }}
      >
        <div className="flex gap-2">
          <BookOpenText />
          <span>Docs</span>
        </div>
        <ChevronRight />
      </button>
      <button
        className={`flex w-full transform justify-between rounded-tr rounded-tl border border-gray-500/10 bg-gray-500/20 p-2 text-sm opacity-70 transition-transform hover:scale-105 hover:cursor-pointer hover:opacity-100`}
        onClick={handleRequestFeatureClick}
      >
        <div className="flex gap-2">
          <Lightbulb />
          <span>Feature Request</span>
        </div>
        <ChevronRight />
      </button>
      <button
        className={`flex w-full transform justify-between rounded-tr rounded-tl border border-gray-500/10 bg-gray-500/20 p-2 text-sm opacity-70 transition-transform hover:scale-105 hover:cursor-pointer hover:opacity-100`}
        onClick={handleReportBugClick}
      >
        <div className="flex gap-2">
          <Bug />
          <span>Report a Bug</span>
        </div>
        <ChevronRight />
      </button>
      <button
        className={`flex w-full transform justify-between rounded-tr rounded-tl border border-gray-500/10 bg-gray-500/20 p-2 text-sm opacity-70 transition-transform hover:scale-105 hover:cursor-pointer hover:opacity-100`}
        onClick={handleSignOut}
      >
        <div className="flex gap-2">
          <LogOut />
          <span>Sign out</span>
        </div>
      </button>
    </div>
  );
}