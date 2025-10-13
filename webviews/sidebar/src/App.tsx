import './App.css';
import { useEffect } from 'react';
import { webviewInitialized } from '@/commandApi';
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
import CodeReview from './views/codeReview';
import { resetChatState } from './utils/resetChatState';

function App() {
  // Retrieve state from the extension store
  const extensionState = useExtensionStore();

  // Retrieve authentication state and setter from the auth store
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Retrieve force upgrade state and setter from the force upgrade store
  const showForceUpgrade = useForceUpgradeStore((state) => state.showForceUpgrade);

  // Variable to hold the view to be rendered
  let view;

  useEffect(() => {
    // Send a message to the extension host when the webview is initialized
    webviewInitialized();
    setTimeout(() => {
      resetChatState();
    }, 1500);
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
    case 'code-review':
      view = showForceUpgrade ? <ForceUpgradeView /> : isAuthenticated ? <CodeReview /> : <Auth />;
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

  return (
    <>
      <div>{view}</div>
    </>
  );
}

export default App;
