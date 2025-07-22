import { ChatUI } from './chat';
import { PageTransition } from '@/components/PageTransition';

export function Chat() {
  return (
    <PageTransition key="chat" direction="left">
      <div className="pt-2" style={{ height: 'calc(100vh - 0.5rem)' }}>
        <ChatUI />
      </div>
    </PageTransition>
  );
}
