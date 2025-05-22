/* eslint-disable @typescript-eslint/no-explicit-any */
import { v4 as uuidv4 } from 'uuid';
import { useExtensionStore } from './stores/useExtensionStore';
import { useChatSettingStore, useChatStore } from './stores/chatStore';
import { useWorkspaceStore } from './stores/workspaceStore';
import { useRepoSelectorStore } from './stores/repoSelectorStore';
import {
  ChatMessage,
  Session,
  ViewType,
  ChatReferenceItem,
  ProfileUiDiv,
  ProgressBarData,
  ThemeKind,
  ChatToolUseMessage,
  Settings,
  URLListItem,
  MCPServer,
} from '@/types';
import { logToOutput, getSessions, sendWorkspaceRepoChange, getGlobalState } from './commandApi';
import { useSessionsStore } from './stores/sessionsStore';
import { useLoaderViewStore } from './stores/useLoaderViewStore';
import { useUserProfileStore } from './stores/useUserProfileStore';
import { useThemeStore } from './stores/useThemeStore';
import { url } from 'inspector';
import { useSettingsStore } from './stores/settingsStore';
import { useMcpStore } from './stores/mcpStore';

type Resolver = {
  resolve: (data: unknown) => void;
  reject: (error: unknown) => void;
  chunk?: (data: unknown) => void;
};

interface InlineChatReferenceData {
  keyword: string;
  path: string;
  chunk: {
    start_line: number;
    end_line: number;
    chunk_hash: string;
    file_hash: string;
    file_path: string;
    meta_info?: any;
  };
  value: string;
}

interface WorkspaceRepo {
  repoPath: string;
  repoName: string;
}

interface SetWorkspaceReposData {
  repos: WorkspaceRepo[];
  activeRepo: string | null;
}

type EventListener = (data: { id: string; command: string; data: unknown }) => void;

const vscode = acquireVsCodeApi();

const resolvers: Record<string, Resolver> = {};

const events: Record<string, EventListener[]> = {};

window.addEventListener('message', (event) => {
  const { id, command, data } = event.data;
  if (command === 'result') {
    const resolver = resolvers[id];
    resolver.resolve(data);
    delete resolvers[id];
    return;
  }

  if (command === 'chunk') {
    const resolver = resolvers[id];
    resolver.chunk?.(data);
    return;
  }

  const listeners = events[command];
  if (listeners) {
    listeners.forEach((listener) => listener({ id, command, data }));
  }
});

export function callCommand(command: string, data: unknown): Promise<any>;

export function callCommand(
  command: string,
  data: unknown,
  options: { stream: false }
): Promise<any>;

export function callCommand<T = any>(
  command: string,
  data: unknown,
  options: { stream: true }
): AsyncIterableIterator<T>;

export function callCommand(
  command: string,
  data: unknown,
  options?: { stream: boolean }
): Promise<any> | AsyncIterableIterator<any> {
  const id = uuidv4();

  if (command === 'get-workspace-state' || command === 'get-global-state') {
    // console.log("callCommand: waiting 0.5 seconds before sending workspace state request...");

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // console.log("callCommand: 0.5 seconds elapsed, now sending workspace state request...");

        // Create the resolver only when we actually send the request
        resolvers[id] = { resolve, reject };

        vscode.postMessage({ id, command, data });
      }, 500); // 5-second delay
    });
  } else {
    vscode.postMessage({ id, command, data });

    if (!options?.stream) {
      return new Promise((resolve, reject) => {
        resolvers[id] = { resolve, reject };
      });
    }
  }

  if (!options?.stream) {
    return new Promise((resolve, reject) => {
      resolvers[id] = { resolve, reject };
    });
  }

  // notice handler
  let chunkResolve: undefined | (() => void);
  // use array to void data loss
  const chunkData: any[] = [];

  let stop = false;
  const gen = (async function* () {
    while (true) {
      // wait for chunk
      await new Promise<void>((resolve) => {
        chunkResolve = resolve;
      });
      while (chunkData.length > 0) {
        yield chunkData.shift();
      }
      if (stop) {
        return;
      }
    }
  })();

  const chunk = (data: any) => {
    chunkData.push(data);
    if (chunkResolve) {
      chunkResolve();
      chunkResolve = undefined;
    }
  };

  const resolve = (data: any) => {
    chunkResolve?.();
    stop = true;
    gen.return(data);
  };

  // this cannot be catch by try catch in the outer for await loop.
  const reject = (error: any) => {
    gen.throw(error);
  };

  resolvers[id] = { resolve, reject, chunk };

  return gen;
}

export function addCommandEventListener(command: string, listener: EventListener) {
  if (!events[command]) {
    events[command] = [];
  }
  events[command].push(listener);
}

const getLocaleTimeString = (dateString: string) => {
  const cleanedDateString = dateString.split('.')[0] + 'Z'; // Force UTC
  const date = new Date(cleanedDateString);
  const dateOptions: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  };

  const locale = navigator.language || 'en-US';
  const datePart = date.toLocaleDateString(locale, dateOptions);
  const timePart = date.toLocaleTimeString(locale, timeOptions);

  return `${datePart}, ${timePart.toUpperCase()}`;
};

export function removeCommandEventListener(command: string, listener: EventListener) {
  if (events[command]) {
    events[command] = events[command].filter((l) => l !== listener);
  }
}

addCommandEventListener('new-chat', async () => {
  const currentViewType = useExtensionStore.getState().viewType;
  const currentDefaultChatType = useSettingsStore.getState().chatType;
  const history = useChatStore.getState().history;
  if (history.length === 0) {
    useChatSettingStore.setState({
      chatType: currentDefaultChatType,
    });
  }
  if (currentViewType !== 'chat') {
    useExtensionStore.setState({ viewType: 'chat' });
  } else {
    useChatSettingStore.setState({
      chatSource: 'new-chat',
    });
    useChatSettingStore.setState({
      chatType: currentDefaultChatType,
    });
    useChatStore.getState().clearChat();
    callCommand('delete-session-id', null);
  }
});

addCommandEventListener('set-view-type', ({ data }) => {
  const currentViewType = useExtensionStore.getState().viewType;

  if (data === 'history' && currentViewType !== 'history') {
    useSessionsStore.getState().clearCurrentSessionsPage();
    useSessionsStore.getState().clearSessions();
    useSessionsStore.setState({ loadingPinnedSessions: true });
    useSessionsStore.setState({ loadingUnpinnedSessions: true });
  }
  useExtensionStore.setState({ viewType: data as ViewType });
});

addCommandEventListener('repo-selector-state', ({ data }) => {
  useRepoSelectorStore.getState().setRepoSelectorDisabled(data as boolean);
});

addCommandEventListener('repo-selector-state', ({ data }) => {
  useRepoSelectorStore.getState().setRepoSelectorDisabled(data as boolean);
});

addCommandEventListener('set-workspace-repos', ({ data }) => {
  logToOutput('info', `set-workspace-repos :: ${JSON.stringify(data)}`);
  const { repos, activeRepo } = data as SetWorkspaceReposData;

  logToOutput('info', `set-workspace-repos :: ${JSON.stringify(repos)}`);
  logToOutput('info', `set-workspace-repos :: ${JSON.stringify(activeRepo)}`);
  useWorkspaceStore.getState().setWorkspaceRepos(repos, activeRepo);
});

addCommandEventListener('sessions-history', ({ data }: any) => {
  useSessionsStore.setState({
    noUnpinnedSessions: data.unpinnedSessions.length === 0,
  });
  // Check if data is not empty before setting it
  useSessionsStore.getState().setHasMore(data.hasMore);
  if (
    data.unpinnedSessions &&
    Array.isArray(data.unpinnedSessions) &&
    data.unpinnedSessions.length > 0
  ) {
    useSessionsStore.setState({ loadingUnpinnedSessions: false });
    // Append new sessions to the existing ones
    useSessionsStore
      .getState()
      .setSessions((prevSessions) => [...prevSessions, ...(data.unpinnedSessions as Session[])]);
  }
});

addCommandEventListener('pinned-sessions', ({ data }: any) => {
  useSessionsStore.setState({ noPinnedSessions: data.length === 0 });
  // Check if data is not empty before setting it
  if (data && Array.isArray(data) && data.length > 0) {
    useSessionsStore.setState({ loadingPinnedSessions: false });
    // Append new sessions to the existing ones
    useSessionsStore.setState({
      pinnedSessions: data as Session[],
    });
  }
});

addCommandEventListener('keyword-search-response', ({ data }) => {
  const AutoSearchResponse = (data as any[]).map((item) => {
    return {
      icon: item.type,
      label: item.value,
      value: item.value,
      description: item.path,
      chunks: item.chunks ? item.chunks : null,
    };
  });
  logToOutput('info', `AutoSearchResponse :: ${JSON.stringify(AutoSearchResponse)}`);
  useChatStore.setState({ ChatAutocompleteOptions: AutoSearchResponse });
  if (!Array.isArray(data)) {
    return;
  }
});

addCommandEventListener('initialize-settings-response', async ({ data }) => {
  const settings = data as Settings;
  useSettingsStore.setState({
    isYoloModeOn: settings.terminal_settings.enable_yolo_mode,
    commandsToDeny: settings.terminal_settings.command_deny_list,
    chatType: settings.default_mode,
    terminalOutputLimit: await getGlobalState({ key: 'terminal-output-limit' }),
    shellIntegrationTimeout: await getGlobalState({
      key: 'terminal-shell-limit',
    }),
    shellCommandTimeout: await getGlobalState({
      key: 'terminal-command-timeout',
    }),
  });
  useChatSettingStore.setState({
    chatType: settings.default_mode,
  });
});

addCommandEventListener('keyword-type-search-response', ({ data }) => {
  const AutoSearchResponse = (data as any[]).map((item) => {
    return {
      icon: item.type,
      label: item.value,
      value: item.value,
      description: item.path,
      chunks: item.chunks ? item.chunks : null,
    };
  });
  logToOutput('info', `AutoSearchResponse :: ${JSON.stringify(AutoSearchResponse)}`);
  useChatStore.setState({ ChatAutocompleteOptions: AutoSearchResponse });
  if (!Array.isArray(data)) {
    return;
  }
});

addCommandEventListener('get-saved-urls-response', ({ data }) => {
  const AutoSearchResponse = (data as any[]).map((item) => {
    return {
      id: item.id,
      url: item.url,
      icon: 'url',
      label: item.name,
      value: item.name,
      description: `Indexed on ${getLocaleTimeString(item.last_indexed)}`,
      chunks: item.chunks ? item.chunks : null,
    };
  });
  logToOutput('info', `AutoSearchResponse :: ${JSON.stringify(AutoSearchResponse)}`);
  useChatStore.setState({ ChatAutocompleteOptions: AutoSearchResponse });
});

addCommandEventListener('get-saved-urls-response-settings', ({ data }) => {
  useSettingsStore.setState({ urls: data as URLListItem[] });
});

addCommandEventListener('session-chats-history', ({ data }) => {
  useExtensionStore.setState({ viewType: 'chat' });
  useChatStore.setState({ history: data as ChatMessage[] });
});

addCommandEventListener('enhanced-user-query', ({ data }: any) => {
  if (data && data.enhancedUserQuery && !data.error) {
    useChatStore.setState({
      enhancedUserQuery: data.enhancedUserQuery as string,
    });
  } else {
    useChatStore.setState({ enhancingUserQuery: false });
  }
});

addCommandEventListener('inline-chat-data', ({ data }) => {
  const response = data as InlineChatReferenceData;
  const currentEditorReference = useChatStore.getState().currentEditorReference;
  const lengthOfCurrentEditorReference = currentEditorReference.length;
  const chatReferenceItem: ChatReferenceItem = {
    index: lengthOfCurrentEditorReference,
    type: 'code_snippet',
    keyword: response.keyword,
    path: response.path,
    chunks: [response.chunk],
    noEdit: true,
  };
  useChatStore.setState({
    currentEditorReference: [...currentEditorReference, chatReferenceItem],
  });
  useChatSettingStore.setState({ chatSource: 'inline-chat' });
  // console.dir(useChatStore.getState().currentEditorReference, { depth: null });
});

addCommandEventListener('progress-bar', ({ data }) => {
  const progressBarData = data as ProgressBarData;
  const incomingProgressBarRepo = progressBarData.repo;
  const currentProgressBars = useChatStore.getState().progressBars;
  // Check if the repo is present in the currentProgressBars array
  const isRepoPresent = currentProgressBars.some((bar) => bar.repo === incomingProgressBarRepo);
  if (!isRepoPresent) {
    // If the repo is not present, add it to the array
    useChatStore.setState({
      progressBars: [...currentProgressBars, progressBarData],
    });
  } else {
    // If the repo is present, update the progress
    useChatStore.setState({
      progressBars: currentProgressBars.map((bar) =>
        bar.repo === incomingProgressBarRepo
          ? { ...progressBarData } // Replace the existing bar with progressBarData
          : bar
      ),
    });
  }
});

addCommandEventListener('profile-ui-data', ({ data }) => {
  useUserProfileStore.setState({ profileUiData: data as ProfileUiDiv[] });
});

addCommandEventListener('force-upgrade-data', ({ data }) => {
  useChatStore.setState({
    forceUpgradeData: data as { url: string; upgradeVersion: string },
  });
  useExtensionStore.setState({ viewType: 'force-upgrade' });
});

addCommandEventListener('loader-message', ({ data }) => {
  const loaderMessage = data as boolean;
  useLoaderViewStore.setState({ loaderViewState: loaderMessage });
});

addCommandEventListener('theme-change', ({ data }) => {
  const theme = data as ThemeKind;
  useThemeStore.setState({ themeKind: theme });
});

addCommandEventListener('send-client-version', ({ data }) => {
  useExtensionStore.setState({ clientVersion: data as string });
});

addCommandEventListener('last-chat-data', ({ data }) => {
  const lastChatData = data as string;
  const lastChatDataParsed = JSON.parse(lastChatData).state;
  useChatStore.setState({
    history: lastChatDataParsed.history as ChatMessage[],
  });
  useChatStore.setState({ isLoading: true });
  useChatStore.setState({
    showSessionsBox: lastChatDataParsed.showSessionsBox,
  });
  useChatStore.setState({
    showAllSessions: lastChatDataParsed.showAllSessions,
  });
  useChatStore.setState({ showSkeleton: true });
  const rawTime = lastChatDataParsed.lastMessageSentTime;
  const parsedTime = rawTime ? new Date(rawTime) : null;

  useChatStore.setState({ lastMessageSentTime: parsedTime });
  const lastMessage = [...lastChatDataParsed.history]
    .reverse()
    .find(
      (msg) => msg.type === 'TOOL_USE_REQUEST' && msg.content?.tool_name === 'create_new_workspace'
    );

  // Create the base message
  let baseMessage = `
    - Workspace Created Successfully, and now we are inside new Workspace.
    - Inside <thinking> tags, Analyze the user's requirements, define project structure, essential files, and dependencies.
    - If additional setup steps or library installations are required (eg. setting up nextjs, react, python, tailwind, etc), invoke the "execute_command" tool.
    - If the user asked to create a new app like nextjs, react, tailiwind , python, etc then your first step should be to install those libraries and check if they are installed successfully and check folder strucutre with tool.
    - Make sure you don't mess up the structure of the codebase, utlize file_path_searcher tool to check the added files if you have any confusions.
    - If you are modifying existing or already created file and you don't have context then utilize file reader, etc tool.
    - Leverage other available tools as needed to complete scaffolding.
  `;

  // Add the conditional instructions based on chat type
  if (useChatSettingStore.getState().chatType === 'write') {
    baseMessage += `
    - If file-creation steps are needed in a follow-up, use the "replace_in_file" tool to make changes to existing files or "write_in_file" tool to create new files.
    - Do not use execute_command tool to create files, instead use "write_in_file" or "replace_in_file" tool.
    `;
  } else {
    baseMessage += `
    - If file-creation steps are needed in a follow-up, send code blocks with udiff inside and make sure you make that <is_diff> true.
    - Do not use execute_command tool to create files, instead send code blocks with udiff MapPinPlusInside.
    `;
  }
  const continuationPayload = {
    write_mode: useChatSettingStore.getState().chatType === 'write',
    is_tool_response: true,
    tool_use_response: {
      tool_name: lastMessage.content.tool_name,
      tool_use_id: lastMessage.content.tool_use_id,
      response: {
        message: baseMessage,
      },
    },
  };
  const { sendChatMessage } = useChatStore.getState();
  sendChatMessage('create new workspace payload', [], () => {}, false, {}, continuationPayload);
});

addCommandEventListener('update-workspace-tool-status', ({ data }) => {
  const { tool_use_id, status } = data as {
    tool_use_id: string;
    status: string;
  };
  const currentHistory = useChatStore.getState().history;
  // if toolId matches with any of the history, then update the status
  const updatedHistory = currentHistory.map((msg) => {
    if (msg.type === 'TOOL_USE_REQUEST' && msg.content.tool_use_id === tool_use_id) {
      return {
        ...msg,
        content: {
          ...msg.content,
          status: 'completed',
        },
      };
    }
    return msg;
  });
  useChatStore.setState({ history: updatedHistory as ChatMessage[] });
});

addCommandEventListener('update-workspace-dd', () => {
  // Get list of current workspace repositories and update active repo to last or latest workspace
  const workspaceRepos = useWorkspaceStore.getState().workspaceRepos;
  if (workspaceRepos.length > 0) {
    const lastWorkspaceRepo = workspaceRepos[workspaceRepos.length - 1];
    const repoPath = lastWorkspaceRepo.repoPath;
    if (repoPath) {
      useWorkspaceStore.setState({ activeRepo: repoPath });
    } else {
      logToOutput('error', 'repoPath is null or undefined.');
    }
    sendWorkspaceRepoChange({ repoPath });
    useChatStore.setState({ isLoading: true });
    useChatStore.setState({ showSkeleton: true });
    const currentHistory = useChatStore.getState().history;
    const lastToolMessage = [...currentHistory]
      .reverse()
      .find(
        (msg) =>
          msg.type === 'TOOL_USE_REQUEST' && msg.content?.tool_name === 'create_new_workspace'
      ) as ChatToolUseMessage;

    if (!lastToolMessage) {
      logToOutput('error', 'No TOOL_USE_REQUEST message found for creating a new workspace.');
      return;
    }

    // Create the base message
    let baseMessage = `
    - Workspace Created Successfully, and now we are inside new Workspace.
    - Inside <thinking> tags, Analyze the user's requirements, define project structure, essential files, and dependencies.
    - If additional setup steps or library installations are required (eg. setting up nextjs, react, python, tailwind, etc), invoke the "execute_command" tool.
    - If the user asked to create a new app like nextjs, react, tailiwind , python, etc then your first step should be to install those libraries and check if they are installed successfully and check folder strucutre with tool.
    - Make sure you don't mess up the structure of the codebase, utlize file_path_searcher tool to check the added files if you have any confusions.
    - If you are modifying existing or already created file and you don't have context then utilize file reader, etc tool.
    - Leverage other available tools as needed to complete scaffolding.
  `;

    // Add the conditional instructions based on chat type
    if (useChatSettingStore.getState().chatType === 'write') {
      baseMessage += `
    - If file-creation steps are needed in a follow-up, use the "replace_in_file" tool to make changes to existing files or "write_in_file" tool to create new files.
    - Do not use execute_command tool to create files, instead use "write_in_file" or "replace_in_file" tool.
    `;
    } else {
      baseMessage += `
    - If file-creation steps are needed in a follow-up, send code blocks with udiff inside and make sure you make that <is_diff> true.
    - Do not use execute_command tool to create files, instead send code blocks with udiff MapPinPlusInside.
    `;
    }
    const continuationPayload = {
      write_mode: useChatSettingStore.getState().chatType === 'write',
      is_tool_response: true,
      tool_use_response: {
        tool_name: lastToolMessage.content.tool_name,
        tool_use_id: lastToolMessage.content.tool_use_id,
        response: {
          message: baseMessage,
        },
      },
    };
    const { sendChatMessage } = useChatStore.getState();
    sendChatMessage('create new workspace payload', [], () => {}, false, {}, continuationPayload);
  } else {
    logToOutput(
      'error',
      `No workspace repositories available to update. Current workspaceRepos: ${JSON.stringify(workspaceRepos)}`
    );
  }
});

addCommandEventListener('terminal-output-to-chat', ({ data }) => {
  const terminalOutput = data as { terminalOutput: string };
  const currentUserInput = useChatStore.getState().userInput;
  useChatStore.setState({
    userInput: currentUserInput + terminalOutput.terminalOutput,
  });
});

addCommandEventListener('fetched-mcp-servers', ({ data }) => {
  const servers = data as MCPServer[];
  console.log('***********servers***********', servers);
  if (servers && servers.length > 0) {
    useMcpStore.setState({ mcpServers: servers });
  }
  console.log(useMcpStore.getState().mcpServers);
});
