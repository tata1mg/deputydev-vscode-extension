import { signOut, getGlobalState, openBrowserPage, getProfileUiData } from "@/commandApi";
import { useChatStore } from "@/stores/chatStore";
import { useEffect, useState } from "react";
import { UserRoundPen, BookOpenText, LogOut, Pen, Lightbulb, ChevronDown, ChevronRight, ChevronLeft, Bug } from "lucide-react";
import useExtensionStore from "@/stores/useExtensionStore";

export default function Profile() {
  const extensionState = useExtensionStore();
  const { userData, profileUiData } = useChatStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const fetchUserData = async () => {
    const userData = await getGlobalState({ key: "userData" });
    useChatStore.setState({ userData: userData });
  };

  const fetchProfileUidata = async () => {
    getProfileUiData();
  }

  useEffect(() => {
    fetchUserData();
    fetchProfileUidata();
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

  const handleRedditClick = () => {
    openBrowserPage("https://www.reddit.com/r/DeputyDev/");
  }

  const handleSignOut = () => {
    signOut();
  }

  const handleBack = () => {
    extensionState.setViewType("chat");
  }

  return (
    <div>
      <button className="mt-2 w-[70px] ml-4 px-2 hover:bg-gray-500/20 rounded h-[30px] flex gap-2 items-center"
        onClick={handleBack}
      >
        <ChevronLeft />
        <span>Back</span>
      </button>
      <div className="px-4 flex flex-col gap-2 mt-2">
        <button
          className={`flex w-full transform justify-between rounded-tr rounded-tl border border-gray-500/10 bg-gray-500/20 p-2 text-sm opacity-70 transition-transform hover:scale-105 hover:cursor-pointer hover:opacity-100`}
          onClick={() => {/* Handle Email button click */ }}
        >
          <div className="flex gap-2">
            <UserRoundPen />
            <span>{userData.email}</span>
          </div>
        </button>
        {profileUiData.length > 0 && <div>
          {profileUiData.map((item, index) => {
            if (item.type === "Expand") {
              return (
                <div key={index}>
                  <button
                    className={`flex w-full transform justify-between rounded-tr rounded-tl border border-gray-500/10 bg-gray-500/20 p-2 text-sm opacity-70 transition-transform hover:scale-105 hover:cursor-pointer hover:opacity-100`}
                    onClick={handleUsageClick}
                  >
                    <div className="flex gap-2">
                      <img src={item.icon} alt={item.label} className="w-6 h-6" />
                      <span>{item.label}</span>
                    </div>
                    {dropdownOpen ? (<ChevronDown />) : (<ChevronRight />)}
                  </button>
                  {dropdownOpen && (
                    <div className="p-2 bg-gray-500/20 rounded-bl rounded-br" dangerouslySetInnerHTML={{ __html: item.data || "" }} />
                  )}
                </div>
              );
            } else if (item.type === "Hyperlink") {
              return (
                <button
                  key={index}
                  className={`flex w-full transform justify-between rounded-tr rounded-tl border border-gray-500/10 bg-gray-500/20 p-2 text-sm opacity-70 transition-transform hover:scale-105 hover:cursor-pointer hover:opacity-100`}
                  onClick={() => item.url && openBrowserPage(item.url)}
                >
                  <div className="flex gap-2">
                    <img src={item.icon} alt={item.label} className="w-6 h-6" />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight />
                </button>
              );
            }
            return null;
          })}
        </div>
        }
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
    </div>
  );
}