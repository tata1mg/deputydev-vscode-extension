import './App.css';
import { useEffect, useState } from 'react';
import { sendWebviewFocusState, initiateBinary } from "@/commandApi";
import useExtensionStore from './stores/useExtensionStore';
import { Chat } from './views/chat';
import Setting from './views/setting';
import Loader from './views/loader';
import History from './views/history';
import Auth from './views/auth';

function App() {
  const extensionState = useExtensionStore();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  let view;

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const response = event.data || {};

      if (response === "AUTHENTICATED") {
        // call binary init command api
        initiateBinary();
        extensionState.setViewType("chat")
        setIsAuthenticated(true);
      }
    }

    function handleFocus() {
      sendWebviewFocusState(true);
    }

    // function handleBlur() {
    //   sendWebviewFocusState(false); // Send "blurred" state to VS Code
    // }

    window.addEventListener('message', handleMessage); // Listen for messages
    window.addEventListener('focus', handleFocus);
    // window.addEventListener('blur', handleBlur);


    return () => window.removeEventListener('message', handleMessage);
  }, [])

  switch (extensionState.viewType) {
    case 'auth':
      view = <Auth />
      break;
    case 'chat':
      // TODO: Bypassing auth for development
      // view =  isAuthenticated ? <Chat /> : <Auth />;
      view = <Chat />;
      break;
    case 'setting':
      view =  <Setting /> ;
      break;
    case 'loader':
      view = <Loader />;
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