import './App.css';
import { useEffect } from 'react';
import { sendWebviewFocusState, webviewInitialized } from '@/commandApi';
import useExtensionStore from './stores/useExtensionStore';
import { Chat } from './views/chat';
import Setting from './views/setting';
import Loader from './views/loader';
import History from './views/history';
import Auth from './views/auth';
import FaqPage from './views/faq';
import DeputyDevHelpPage from './views/help';
import { useAuthStore } from './stores/authStore';
import Profile from './views/profile';
import Error from './views/error';
import ForceUpgradeView from './views/forceUpgradeView';
import { useForceUpgradeStore } from './stores/forceUpgradeStore';

function App() {
  const extensionState = useExtensionStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setIsAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const showForceUpgrade = useForceUpgradeStore((state) => state.showForceUpgrade);
  const setShowForceUpgrade = useForceUpgradeStore((state) => state.setShowForceUpgrade);

  let view;

  useEffect(() => {
    // Send a message to the extension host when the webview is initialized
    webviewInitialized();
    function handleMessage(event: MessageEvent) {
      const response = event.data || {};

      if (response === 'force-upgrade-needed') {
        extensionState.setViewType('force-upgrade');
        setShowForceUpgrade(true);
      }

      if (response === 'AUTHENTICATED') {
        setIsAuthenticated(true);
        extensionState.setViewType('chat');
      }

      if (response === 'NOT_VERIFIED') {
        setIsAuthenticated(false);
        extensionState.setViewType('auth');
      }
    }

    function handleFocus() {
      sendWebviewFocusState(true);
    }

    window.addEventListener('message', handleMessage); // Listen for messages
    // window.addEventListener('focus', handleFocus);

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  switch (extensionState.viewType) {
    case 'force-upgrade':
      view = <ForceUpgradeView />;
      break;
    case 'auth':
      view = showForceUpgrade ? <ForceUpgradeView /> : <Auth />;
      break;
    case 'chat':
      view = showForceUpgrade ? <ForceUpgradeView /> : isAuthenticated ? <Chat /> : <Auth />;
      break;
    case 'profile':
      view = showForceUpgrade ? <ForceUpgradeView /> : isAuthenticated ? <Profile /> : <Auth />;
      break;
    case 'setting':
      view = showForceUpgrade ? <ForceUpgradeView /> : isAuthenticated ? <Setting /> : <Auth />;
      break;
    case 'loader':
      view = <Loader />;
      break;
    case 'history':
      view = showForceUpgrade ? <ForceUpgradeView /> : isAuthenticated ? <History /> : <Auth />;
      break;
    case 'error':
      view = showForceUpgrade ? <ForceUpgradeView /> : <Error />;
      break;
    case 'help':
      view = showForceUpgrade ? <ForceUpgradeView /> : <DeputyDevHelpPage />;
      break;
    case 'faq':
      view = showForceUpgrade ? <ForceUpgradeView /> : <FaqPage />;
      break;
    default:
      view = null;
  }
  // use background color tailwind white

  return (
    <>
      {' '}
      <div className=" "> {view}</div>
    </>
  );
}

export default App;
