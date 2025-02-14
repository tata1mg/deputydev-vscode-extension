import './App.css';
import { useEffect, useState } from 'react';
// import { vscode } from './utilities/vscode';
import useExtensionStore from './stores/useExtensionStore';
import { Chat } from './views/chat';
import Setting from './views/setting';
import Welcome from './views/welcome';
import History from './views/history';
import Auth from './views/auth';

function App() {
  const extensionState = useExtensionStore();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  let view;

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const response = event.data || {};
      console.log("message", response)

      if (response === "AUTHENTICATED") {
        extensionState.setViewType("chat")
        setIsAuthenticated(true);
      }
    }

    window.addEventListener('message', handleMessage); // Listen for messages
    return () => window.removeEventListener('message', handleMessage);
  }, [])

  switch (extensionState.viewType) {
    case 'auth':
      view = <Auth />
      break;
    case 'chat':
      view = isAuthenticated ? <Chat /> : <Auth />;
      break;
    case 'setting':
      view = isAuthenticated ? <Setting /> : <Auth />;
      break;
    case 'welcome':
      view = <Welcome />;
      break;
    case 'history':
      view = isAuthenticated ? <History /> : <Auth />;
      break;
    default:
      view = null;
  }
  // use background color tailwind white

  return <> <div className=' '>  {view}</div></>;
}

export default App;