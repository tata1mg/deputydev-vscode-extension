import './App.css';
import { useEffect, useState } from 'react';
// import { vscode } from './utilities/vscode';
import useExtensionStore from './stores/useExtensionStore';
import { Chat } from './views/chat';
import Setting from './views/setting';
import Welcome from './views/welcome';
import History from './views/history';

function App() {
  const extensionState = useExtensionStore();
  // call getGlobalState to get the global state
  
  let view;

  switch (extensionState.viewType) {
    case 'chat':
      view = <Chat />;
      break;
    case 'setting':
      view = <Setting />;
      break;
    case 'welcome':
      view = <Welcome />;
      break;
    case 'history':
      view = <History />;
      break;
    default:
      view = null;
  }
// use background color tailwind white

  return <> <div className=' '>  {view}</div></>;
}

export default App;