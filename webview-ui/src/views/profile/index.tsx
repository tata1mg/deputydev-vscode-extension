import {
  signOut,
  getGlobalState,
  openBrowserPage,
  getProfileUiData,
  showUserLogs,
  fetchClientVersion,
} from "@/commandApi";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import useExtensionStore from "@/stores/useExtensionStore";
import { useAuthStore } from "@/stores/authStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";

export default function Profile() {
  const extensionState = useExtensionStore();
  
  const { userData, profileUiData } = useUserProfileStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const fetchUserData = async () => {
    const userData = await getGlobalState({ key: "userData" });
    useUserProfileStore.setState({ userData: userData });
  };

  const fetchProfileUidata = async () => {
    getProfileUiData();
  };

  useEffect(() => {
    fetchUserData();
    fetchProfileUidata();
    fetchClientVersion();
  }, []);

  const handleUsageClick = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const handleSignOut = () => {
    useAuthStore.setState({isAuthenticated: false})
    signOut();
  };

  const handleShowLogs = () => {
    showUserLogs();
  };

  const handleBack = () => {
    extensionState.setViewType("chat");
  };

  const opensetting = () => {
    extensionState.setViewType("setting");
  }

  return (
    <div className="flex h-screen flex-col justify-between">
      <div>
        <button
          className="ml-4 mt-2 flex h-[30px] w-[70px] items-center gap-2 rounded px-2 hover:bg-gray-500/20"
          onClick={handleBack}
        >
          <ChevronLeft />
          <span>Back</span>
        </button>
        {profileUiData.length > 0 ? (
          <div>
            <div className="mt-2 flex flex-col px-4">
              <button
                className={`mt-2 flex w-full transform justify-between rounded-tl rounded-tr border border-gray-500/10 bg-gray-500/20 p-2 text-sm opacity-70 transition-transform hover:scale-105 hover:cursor-pointer hover:opacity-100`}
              >
                <div className="flex gap-2">
                  <img
                    src="https://onemg.gumlet.io/dd_profile_24_03.png"
                    alt="profile"
                    className="h-6 w-6"
                  />
                  <span>{userData.email}</span>
                </div>
              </button>
              <div>
                {profileUiData.map((item, index) => {
                  if (item.type === "Expand") {
                    return (
                      <div key={index}>
                        <button
                          className={`mt-2 flex w-full transform justify-between rounded-tl rounded-tr border border-gray-500/10 bg-gray-500/20 p-2 text-sm opacity-70 transition-transform hover:scale-105 hover:cursor-pointer hover:opacity-100`}
                          onClick={handleUsageClick}
                        >
                          <div className="flex gap-2">
                            <img
                              src={item.icon}
                              alt={item.label}
                              className="h-6 w-6"
                            />
                            <span>{item.label}</span>
                          </div>
                          {dropdownOpen ? <ChevronDown /> : <ChevronRight />}
                        </button>
                        {dropdownOpen && (
                          <div
                            className="rounded-bl rounded-br bg-gray-500/20 p-2"
                            dangerouslySetInnerHTML={{
                              __html: item.data || "",
                            }}
                          />
                        )}
                      </div>
                    );
                  } else if (item.type === "Hyperlink") {
                    return (
                      <button
                        key={index}
                        className={`mt-2 flex w-full transform justify-between rounded-tl rounded-tr border border-gray-500/10 bg-gray-500/20 p-2 text-sm opacity-70 transition-transform hover:scale-105 hover:cursor-pointer hover:opacity-100`}
                        onClick={() => item.url && openBrowserPage(item.url)}
                      >
                        <div className="flex gap-2">
                          <img
                            src={item.icon}
                            alt={item.label}
                            className="h-6 w-6"
                          />
                          <span>{item.label}</span>
                        </div>
                        <ChevronRight />
                      </button>
                    );
                  }
                  return null;
                })}
              </div>
              {/* <button
                className={`mt-2 flex w-full transform justify-between rounded-tl rounded-tr border border-gray-500/10 bg-gray-500/20 p-2 text-sm opacity-70 transition-transform hover:scale-105 hover:cursor-pointer hover:opacity-100`}
                onClick={opensetting}
              >
                <div className="flex gap-2">
                  <img
                    src="https://onemg.gumlet.io/dd_stat_logo_26_03.png"
                    alt="show logs"
                    className="h-6 w-6"
                  />
                  <span>Settings</span>
                </div>
              </button> */}
             
              <button
                className={`mt-2 flex w-full transform justify-between rounded-tl rounded-tr border border-gray-500/10 bg-gray-500/20 p-2 text-sm opacity-70 transition-transform hover:scale-105 hover:cursor-pointer hover:opacity-100`}
                onClick={handleSignOut}
              >
                <div className="flex gap-2">
                  <img
                    src="https://onemg.gumlet.io/dd_signout_24_03.png"
                    alt="signout"
                    className="h-6 w-6"
                  />
                  <span>Sign out</span>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex animate-pulse flex-col gap-2 px-4">
            <div className="h-10 w-full rounded bg-gray-500"></div>
            <div className="h-10 w-full rounded bg-gray-500"></div>
            <div className="h-10 w-full rounded bg-gray-500"></div>
            <div className="h-10 w-full rounded bg-gray-500"></div>
            <div className="h-10 w-full rounded bg-gray-500"></div>
            <div className="h-10 w-full rounded bg-gray-500"></div>
            <div className="h-10 w-full rounded bg-gray-500"></div>
            <div className="h-10 w-full rounded bg-gray-500"></div>
          </div>
        )}
      </div>
      <div className="px-4 pb-2 text-center text-xs text-gray-500">
        Version {extensionState.clientVersion}
      </div>
    </div>
  );
}
