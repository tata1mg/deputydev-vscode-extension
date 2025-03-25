import './App.css';
import { useEffect, useState } from 'react';
import { sendWebviewFocusState } from "@/commandApi";
import useExtensionStore from './stores/useExtensionStore';
import { Chat } from './views/chat';
import Setting from './views/setting';
import Loader from './views/loader';
import History from './views/history';
import Auth from './views/auth';
import { useAuthStore } from './stores/authStore';
import Profile from './views/profile';
import Error from './views/error';
import ForceUpgradeView from './views/forceUpgradeView';

function App() {
  const extensionState = useExtensionStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setIsAuthenticated = useAuthStore((state) => state.setAuthenticated);

  let view;

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const response = event.data || {};

      if (response === "AUTHENTICATED") {
        // call binary init command api
        setIsAuthenticated(true);
        // initiateBinary();
        extensionState.setViewType("chat")
      }
    }

    function handleFocus() {
      sendWebviewFocusState(true);
    }


    window.addEventListener('message', handleMessage); // Listen for messages
    // window.addEventListener('focus', handleFocus);


    return () => window.removeEventListener('message', handleMessage);
  }, [])

  switch (extensionState.viewType) {
    case 'auth':
      view = <Auth />
      break;
    case 'chat':
      // TODO: Bypassing auth for development
      // view =  <Chat />;
      view = isAuthenticated ? <Chat /> : <Auth />;
      break;
    case 'profile':
      view = isAuthenticated ? <Profile /> : <Auth />;
      break;
    case 'setting':
      view = isAuthenticated ? <Setting /> : <Auth />;
      // view = <Setting />;
      break;
    case 'loader':
      view =  <Loader />;
      break;
    case 'history':
      view = isAuthenticated ? <History /> : <Auth />;
      break;
    case 'error':
      view = <Error />
      break;
    case 'force-upgrade':
      view = <ForceUpgradeView />
      break;
    default:
      view = null;
  }
  // use background color tailwind white

  return <> <div className=' '>  {view}</div></>;
}

export default App;