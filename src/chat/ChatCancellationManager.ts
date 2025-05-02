// ChatCancellationManager.ts
interface CancellableTask {
  abortController: AbortController;
  asyncIterator?: AsyncIterableIterator<any>; // ✅ Less strict than AsyncGenerator
}

const activeApiChatTasks = new Set<CancellableTask>();

export function registerApiChatTask(task: CancellableTask) {
  activeApiChatTasks.add(task);
}

export function unregisterApiChatTask(task: CancellableTask) {
  activeApiChatTasks.delete(task);
}

export function cancelAllApiChats() {
  activeApiChatTasks.forEach((task) => {
    task.abortController.abort();
    if (task.asyncIterator && typeof task.asyncIterator.return === 'function') {
      task.asyncIterator.return(undefined); // ✅ Fix: provide argument
    }
  });
  activeApiChatTasks.clear();
}
