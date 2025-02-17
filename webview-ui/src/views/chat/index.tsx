// import ChatMessageList from './chatMessageList';
// import ChatTextArea from './chatTextArea';
// react-syntax-highlighter 's highlight.js version is not same as package.json
// here we just use style code.
// import './codeTheme.scss';
import { CodeActionPanel } from './codeActionPanel';
import { ChatUI } from './chat';
export function Chat() {
  return (
    <div className='pt-2' style={{ height: "calc(100vh - 0.5rem)" }}>
      <ChatUI />
      {/* <ChatMessageList /> */}
      {/* <ChatTextArea /> */}
    </div>
  );
}
