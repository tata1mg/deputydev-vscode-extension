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
  ThemeKind,
  ChatToolUseMessage,
  Settings,
  URLListItem,
  MCPServer,
  ChangedFile,
  IndexingProgressData,
  EmbeddingProgressData,
  NewReview,
  Review,
  UserAgent,
  AgentPayload,
} from '@/types';
import {
  logToOutput,
  sendWorkspaceRepoChange,
  getGlobalState,
  rejectAllChangesInSession,
  hitEmbedding,
  updateContextRepositories,
  newReview,
  startCodeReview,
  startCodeReviewPostProcess,
  fetchPastReviews,
  hitSnapshot,
} from './commandApi';
import { useSessionsStore } from './stores/sessionsStore';
import { LoaderPhase, useLoaderViewStore } from './stores/useLoaderViewStore';
import { useUserProfileStore } from './stores/useUserProfileStore';
import { useThemeStore } from './stores/useThemeStore';
import { useSettingsStore } from './stores/settingsStore';
import { useMcpStore } from './stores/mcpStore';
import { useActiveFileStore } from './stores/activeFileStore';
import { useChangedFilesStore } from './stores/changedFilesStore';
import { useIndexingStore } from './stores/indexingDataStore';
import { useForceUpgradeStore } from './stores/forceUpgradeStore';
import { useAuthStore } from './stores/authStore';
import { useCodeReviewSettingStore, useCodeReviewStore } from './stores/codeReviewStore';

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
    return new Promise((resolve, reject) => {
      setTimeout(() => {
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
  if (currentViewType !== 'chat') {
    useExtensionStore.setState({ viewType: 'chat' });
  } else {
    useChatSettingStore.setState({
      chatSource: 'new-chat',
    });
    useChatStore.getState().clearChat();
    callCommand('delete-session-id', null);
  }
  rejectAllChangesInSession(useChangedFilesStore.getState().filesChangedSessionId);
  useChangedFilesStore.setState({ changedFiles: [] });
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

  // Initialise context repositories with active repo
  const contextRepositories = useWorkspaceStore.getState().contextRepositories;
  const activeRepoName = repos.find((repo) => repo.repoPath === activeRepo)?.repoName;
  if (
    activeRepo &&
    activeRepoName &&
    !contextRepositories.some((repo) => repo.repoPath === activeRepo)
  ) {
    useWorkspaceStore.setState({
      contextRepositories: [
        ...contextRepositories,
        { repoPath: activeRepo, repoName: activeRepoName },
      ],
    });
  }

  updateContextRepositories({
    contextRepositories: useWorkspaceStore.getState().contextRepositories,
  });

  // Get current repos before updating
  const currentRepos = useWorkspaceStore.getState().workspaceRepos;
  const currentRepoPaths = new Set(currentRepos.map((repo) => repo.repoPath));

  // Find new repos that weren't there before
  const newRepos = repos.filter((repo) => !currentRepoPaths.has(repo.repoPath));

  // Update the stores
  useWorkspaceStore.getState().setWorkspaceRepos(repos, activeRepo);
  useIndexingStore.getState().initializeRepos(repos);

  const inProgressRepos = useIndexingStore
    .getState()
    .indexingProgressData.filter((repo) => repo.status === 'IN_PROGRESS');

  // Hit embedding for new repos
  if (newRepos.length > 0 && newRepos.length != repos.length && inProgressRepos.length == 0) {
    newRepos.forEach((newRepo) => {
      hitEmbedding(newRepo.repoPath);
    });
  }
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
    terminalOutputLimit: await getGlobalState({ key: 'terminal-output-limit' }),
    shellIntegrationTimeout: await getGlobalState({
      key: 'terminal-shell-limit',
    }),
    shellCommandTimeout: await getGlobalState({
      key: 'terminal-command-timeout',
    }),
    disableShellIntegration: await getGlobalState({
      key: 'disable-shell-integration',
    }),
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

addCommandEventListener('image-upload-progress', (event) => {
  const { data } = event as { data: { progress: number } };
  useChatStore.setState({ imageUploadProgress: data.progress as number });
});

addCommandEventListener('uploaded-image-key', (event) => {
  const { data } = event as { data: { key: string; get_url: string } };
  const currentS3Objects = useChatStore.getState().s3Objects;
  useChatStore.setState({ s3Objects: [...currentS3Objects, data] });
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
    // value is file name which we generate from response.path
    value: response.path.split('/').pop() || '',
    path: response.path,
    chunks: [response.chunk],
    noEdit: true,
  };
  useChatStore.setState({
    currentEditorReference: [...currentEditorReference, chatReferenceItem],
  });
  useChatSettingStore.setState({ chatSource: 'inline-chat' });
});

addCommandEventListener('indexing-progress', ({ data }) => {
  const response = data as IndexingProgressData;
  useIndexingStore.getState().updateOrAppendIndexingData(response);
  const indexingProgressData = useIndexingStore.getState().indexingProgressData;

  // sequential embedding
  // If current embedding is completed, find next idle repo and trigger embedding
  if (response.status === 'COMPLETED') {
    const nextIdleRepo = indexingProgressData.find(
      (item) => item.status === 'IDLE' && item.repo_path !== response.repo_path
    );

    if (nextIdleRepo) {
      hitEmbedding(nextIdleRepo.repo_path);
    }
  }
});

addCommandEventListener('embedding-progress', ({ data }) => {
  const response = data as EmbeddingProgressData;
  useIndexingStore.getState().updateOrAppendEmbeddingData(response);
});

addCommandEventListener('profile-ui-data', ({ data }) => {
  useUserProfileStore.setState({ profileUiData: data as ProfileUiDiv[] });
});

addCommandEventListener('force-upgrade-data', ({ data }) => {
  useForceUpgradeStore.setState({
    forceUpgradeData: data as { url: string; upgradeVersion: string; currentVersion: string },
  });
  useForceUpgradeStore.setState({ showForceUpgrade: true });
  useExtensionStore.setState({ viewType: 'force-upgrade' });
});

addCommandEventListener('loader-message', ({ data }) => {
  const loaderMessage = data as {
    showLoader: boolean;
    phase: LoaderPhase;
    progress: number;
  };
  useLoaderViewStore.setState({
    loaderViewState: loaderMessage.showLoader,
    phase: loaderMessage.phase,
    progress: loaderMessage.progress,
  });
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
  useChatStore.setState({ showSkeleton: true });
  const lastMessage = [...lastChatDataParsed.history]
    .reverse()
    .find(
      (msg) => msg.type === 'TOOL_USE_REQUEST' && msg.content?.tool_name === 'create_new_workspace'
    );
  const newRepoPath = useWorkspaceStore.getState().activeRepo;
  // Create the base message
  let baseMessage = `
    - Workspace Created Successfully, and now we are inside new Workspace${newRepoPath ? `, with directory: ${newRepoPath}` : ''}.
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
  sendChatMessage(
    'create new workspace payload',
    [],
    () => {},
    undefined,
    false,
    {},
    continuationPayload
  );
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
    const newRepoPath = useWorkspaceStore.getState().activeRepo;
    // Create the base message
    let baseMessage = `
    - Workspace Created Successfully, and now we are inside new Workspace${newRepoPath ? `, with directory: ${newRepoPath}` : ''}.
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
    sendChatMessage(
      'create new workspace payload',
      [],
      () => {},
      undefined,
      false,
      {},
      continuationPayload
    );
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

addCommandEventListener('file-diff-applied', ({ data }) => {
  const { fileName, filePath, repoPath, addedLines, removedLines, sessionId } = data as ChangedFile;

  useChangedFilesStore.setState((state) => {
    // Check if file with same path and repo already exists
    const existingFileIndex = state.changedFiles.findIndex(
      (file) => file.filePath === filePath && file.repoPath === repoPath
    );

    const newFile = {
      fileName,
      filePath,
      repoPath,
      addedLines,
      removedLines,
      sessionId,
      accepted: false,
    };

    if (existingFileIndex >= 0) {
      // Update existing file
      const updatedFiles = [...state.changedFiles];
      updatedFiles[existingFileIndex] = newFile;
      return { changedFiles: updatedFiles };
    } else {
      // Add new file
      return { changedFiles: [...state.changedFiles, newFile] };
    }
  });
  useChangedFilesStore.setState({ filesChangedSessionId: sessionId });
});

addCommandEventListener('all-file-changes-finalized', ({ data }) => {
  const { filePath, repoPath } = data as {
    filePath: string;
    repoPath: string;
  };

  useChangedFilesStore.setState((state) => {
    // Filter out the file that was accepted
    const updatedFiles = state.changedFiles.filter(
      (file) => !(file.filePath === filePath && file.repoPath === repoPath)
    );

    return { changedFiles: updatedFiles };
  });
});

addCommandEventListener('all-file-changes-rejected', ({ data }) => {
  const { filePath, repoPath } = data as {
    filePath: string;
    repoPath: string;
  };

  useChangedFilesStore.setState((state) => {
    // Filter out the file that was accepted
    const updatedFiles = state.changedFiles.filter(
      (file) => !(file.filePath === filePath && file.repoPath === repoPath)
    );

    return { changedFiles: updatedFiles };
  });
});

addCommandEventListener('all-session-changes-finalized', ({ data }) => {
  useChangedFilesStore.setState({ changedFiles: [] });
});

addCommandEventListener('all-session-changes-rejected', ({ data }) => {
  useChangedFilesStore.setState({ changedFiles: [] });
});

addCommandEventListener('fetched-mcp-servers', ({ data }) => {
  const servers = data as MCPServer[];
  const selectedServer = useMcpStore.getState().selectedServer;
  if (servers.length === 0) {
    useMcpStore.setState({ mcpServers: [] });
    useMcpStore.setState({ selectedServer: undefined });
  }
  if (servers && servers.length > 0) {
    useMcpStore.setState({ mcpServers: servers });
    if (selectedServer) {
      // Find the new state of the selected server from the fetched servers
      const newSelectedServer = servers.find((server) => server.name === selectedServer.name);
      if (newSelectedServer) {
        // Update the selected server with the new state
        useMcpStore.setState({ selectedServer: newSelectedServer });
      }
    }
  }
});

addCommandEventListener('terminal-process-completed', ({ data }) => {
  const { toolUseId, exitCode } = data as { toolUseId: string; exitCode: number };

  const history = useChatStore.getState().history;

  const updatedHistory = history.map((msg) => {
    if (
      (msg.type === 'TOOL_USE_REQUEST' || msg.type === 'TOOL_USE_REQUEST_BLOCK') &&
      msg.content.tool_use_id === toolUseId
    ) {
      return {
        ...msg,
        content: {
          ...msg.content,
          terminal: {
            ...msg.content.terminal,
            exit_code: exitCode,
          },
        },
      };
    }

    return msg;
  });

  useChatStore.setState({ history: updatedHistory as ChatMessage[] });
});

addCommandEventListener('set-cancel-button-status', ({ data }) => {
  useChatStore.setState({ setCancelButtonStatus: data as boolean });
});

addCommandEventListener('active-file-change', ({ data }) => {
  const activeFileChangeData = data as {
    fileUri: string | undefined;
    startLine?: number;
    endLine?: number;
  };
  const activeFileUri = activeFileChangeData.fileUri;
  const startLine = activeFileChangeData.startLine;
  const endLine = activeFileChangeData.endLine;
  if (activeFileUri) {
    useActiveFileStore.setState({ activeFileUri, startLine, endLine });
  } else {
    useActiveFileStore.setState({
      activeFileUri: undefined,
      startLine: undefined,
      endLine: undefined,
    });
  }
});

addCommandEventListener('auth-response', ({ data }) => {
  const response = data as string;
  if (response === 'AUTHENTICATED') {
    useAuthStore.setState({ isAuthenticated: true });
    useExtensionStore.setState({ viewType: 'chat' });
  } else if (response === 'NOT_VERIFIED') {
    useAuthStore.setState({ isAuthenticated: false });
    useExtensionStore.setState({ viewType: 'auth' });
  }
});

// Code Review
addCommandEventListener('new-review-created', ({ data }) => {
  console.log('New review data received:', data);
  console.log('setting new review in store');
  const newReview = data as NewReview;
  useCodeReviewStore.setState({ new_review: newReview });
  useCodeReviewStore.setState({ isFetchingChangedFiles: false });
  useCodeReviewStore.setState({ selectedTargetBranch: newReview.target_branch });
  console.log('New review from state*************', useCodeReviewStore.getState().new_review);
  fetchPastReviews({
    sourceBranch: useCodeReviewStore.getState().new_review.source_branch,
    repoId: useCodeReviewStore.getState().repoId,
  });
});

addCommandEventListener('search-branches-result', ({ data }) => {
  useCodeReviewStore.setState({ searchedBranches: data as string[] });
  console.log('Searched branches:', useCodeReviewStore.getState().searchedBranches);
});

addCommandEventListener('snapshot-result', ({ data }: any) => {
  console.log('Snapshot response received:', data);
  if (data && !data.is_error) {
    newReview({
      targetBranch: useCodeReviewStore.getState().selectedTargetBranch,
      reviewType: useCodeReviewStore.getState().activeReviewOption.value,
    });
  }
});

addCommandEventListener('past-reviews', ({ data }) => {
  const result = data as Review[];
  if (data) {
    useCodeReviewStore.setState({ pastReviews: result });
  }
  useCodeReviewStore.setState({ isFetchingPastReviews: false });

  console.log('Past reviews data received:', useCodeReviewStore.getState().pastReviews);
});

addCommandEventListener('user-agents', ({ data }) => {
  const userAgents = data as UserAgent[];

  if (userAgents && userAgents.length > 0) {
    useCodeReviewStore.setState({ userAgents: userAgents });
  }

  console.log('User agents data received:', useCodeReviewStore.getState().userAgents);
});

addCommandEventListener('REVIEW_PRE_PROCESS_STARTED', ({ data }) => {
  console.log('Review pre-process started:', data);
  const store = useCodeReviewStore.getState();

  // Add setup step
  store.updateOrAddStep({
    id: 'INITIAL_SETUP',
    label: 'Setting Up Review',
    status: 'IN_PROGRESS',
  });
});

addCommandEventListener('REVIEW_PRE_PROCESS_COMPLETED', ({ data }) => {
  const preProcessData = data as { review_id: number; session_id: number; repo_id: number };
  console.log('Review preprocess completed:', preProcessData);
  useCodeReviewStore.setState({ activeReviewId: preProcessData.review_id });
  useCodeReviewStore.setState({ activeReviewSessionId: preProcessData.session_id });
  useCodeReviewStore.setState({ repoId: preProcessData.repo_id });
  console.log('Active review ID set to:', useCodeReviewStore.getState().activeReviewId);

  // Update setup step to COMPLETED
  useCodeReviewStore.getState().updateStepStatus('INITIAL_SETUP', 'COMPLETED');

  // Start Review now
  const enabledAgents = useCodeReviewSettingStore.getState().enabledAgents;
  const activeReviewId = useCodeReviewStore.getState().activeReviewId;

  // Ensure we have a valid activeReviewId
  if (!activeReviewId) {
    console.error('No active review ID found');
    return;
  }

  // Create the agents payload list
  const agents: AgentPayload[] = enabledAgents.map((agent) => ({
    agent_id: agent.id,
    review_id: activeReviewId,
    type: 'query',
  }));

  // Start the code review with the agents payload list
  startCodeReview({
    review_id: activeReviewId,
    agents: agents,
  });
});

addCommandEventListener('REVIEW_PRE_PROCESS_FAILED', ({ data }) => {
  console.error('Review pre process failed with data:', data);
  useCodeReviewStore.getState().updateStepStatus('INITIAL_SETUP', 'FAILED');
});

addCommandEventListener('REVIEW_STARTED', ({ data }) => {
  console.log('Review started:', data);
  const store = useCodeReviewStore.getState();
  const enabledAgents = useCodeReviewSettingStore.getState().enabledAgents;

  // Add or update reviewing step with all enabled agents
  store.updateOrAddStep({
    id: 'REVIEWING',
    label: 'Reviewing files',
    status: 'IN_PROGRESS',
    agents: enabledAgents.map((agent) => ({
      id: agent.id,
      name: agent.displayName,
      status: 'IN_PROGRESS' as const,
    })),
  });
});

addCommandEventListener('AGENT_COMPLETE', ({ data }) => {
  const event = data as { agent_id: number; type: string; data: any };
  const agentId = event.agent_id;
  console.log('Agent completed:', event);

  // Update the specific agent's status to COMPLETED
  useCodeReviewStore.getState().updateAgentStatus('REVIEWING', agentId, 'COMPLETED');

  // Check if all enabled agents have completed or failed
  const { steps } = useCodeReviewStore.getState();
  const enabledAgents = useCodeReviewSettingStore.getState().enabledAgents;
  const reviewingStep = steps.find((step) => step.id === 'REVIEWING');

  if (reviewingStep?.agents) {
    // Get only the enabled agents' statuses
    const enabledAgentStatuses = reviewingStep.agents
      .filter((agent) => enabledAgents.some((ea) => ea.id === agent.id))
      .map((agent) => agent.status);

    // Check if all enabled agents are either COMPLETED or FAILED
    const allEnabledAgentsDone =
      enabledAgentStatuses.length > 0 &&
      enabledAgentStatuses.every((status) => status === 'COMPLETED' || status === 'FAILED');

    if (allEnabledAgentsDone) {
      useCodeReviewStore.getState().updateStepStatus('REVIEWING', 'COMPLETED');

      const failedAgents = reviewingStep.agents
        .filter((agent) => agent.status === 'FAILED')
        .map((agent) => ({
          id: agent.id,
          name: agent.name,
        }));

      if (failedAgents.length > 0) {
        useCodeReviewStore.getState().setFailedAgents(failedAgents);
        useCodeReviewStore.getState().setShowFailedAgentsDialog(true);
      }

      if (failedAgents.length === 0) {
        startCodeReviewPostProcess({ review_id: useCodeReviewStore.getState().activeReviewId });
      }
    }
  }
});

addCommandEventListener('AGENT_FAIL', ({ data }) => {
  const event = data as { agent_id: number; type: string; data: any };
  const agentId = event.agent_id;
  console.error('Agent failed:', event);

  // Update the specific agent's status to FAILED
  useCodeReviewStore.getState().updateAgentStatus('REVIEWING', agentId, 'FAILED');

  // Check if all enabled agents have completed or failed
  const { steps } = useCodeReviewStore.getState();
  const enabledAgents = useCodeReviewSettingStore.getState().enabledAgents;
  const reviewingStep = steps.find((step) => step.id === 'REVIEWING');

  if (reviewingStep?.agents) {
    // Get only the enabled agents' statuses
    const enabledAgentStatuses = reviewingStep.agents
      .filter((agent) => enabledAgents.some((ea) => ea.id === agent.id))
      .map((agent) => agent.status);

    // Check if all enabled agents are either COMPLETED or FAILED
    const allEnabledAgentsDone =
      enabledAgentStatuses.length > 0 &&
      enabledAgentStatuses.every((status) => status === 'COMPLETED' || status === 'FAILED');

    if (allEnabledAgentsDone) {
      const failedAgents = reviewingStep.agents
        .filter((agent) => agent.status === 'FAILED')
        .map((agent) => ({
          id: agent.id,
          name: agent.name,
        }));

      if (failedAgents.length > 0 && failedAgents.length != enabledAgents.length) {
        useCodeReviewStore.getState().setFailedAgents(failedAgents);
        useCodeReviewStore.getState().setShowFailedAgentsDialog(true);
        useCodeReviewStore.getState().updateStepStatus('REVIEWING', 'COMPLETED');
      }

      if (failedAgents.length > 0 && failedAgents.length === enabledAgents.length) {
        useCodeReviewStore.getState().updateStepStatus('REVIEWING', 'FAILED');
        useCodeReviewStore.setState({ reviewStatus: 'FAILED' });
        useCodeReviewStore.setState({ showReviewError: true });
        useCodeReviewStore.setState({
          reviewErrorMessage: 'All agents failed to review the code.',
        });
      }
    }
  }
});

addCommandEventListener('POST_PROCESS_START', ({ data }) => {
  console.log('Post process started:', data);
  const store = useCodeReviewStore.getState();

  // Add setup step
  store.updateOrAddStep({
    id: 'FINALIZING_REVIEW',
    label: 'Finalizing Review',
    status: 'IN_PROGRESS',
  });
});

addCommandEventListener('POST_PROCESS_COMPLETE', ({ data }) => {
  console.log('Post process completed:', data);
  useCodeReviewStore.getState().updateStepStatus('FINALIZING_REVIEW', 'COMPLETED');
  fetchPastReviews({
    sourceBranch: useCodeReviewStore.getState().new_review.source_branch,
    repoId: useCodeReviewStore.getState().repoId,
  });
  useCodeReviewStore.setState({ reviewStatus: 'COMPLETED' });
  console.log('Review completed successfully and hitting snapshot for active review option');
  hitSnapshot(
    useCodeReviewStore.getState().activeReviewOption.value,
    useCodeReviewStore.getState().selectedTargetBranch
  );
});

addCommandEventListener('POST_PROCESS_ERROR', ({ data }) => {
  console.error('Post process failed:', data);
  useCodeReviewStore.getState().updateStepStatus('FINALIZING_REVIEW', 'FAILED');
  useCodeReviewStore.setState({ reviewStatus: 'COMPLETED' });
});

addCommandEventListener('REVIEW_CANCELLED', ({ data }) => {
  console.log('Review cancelled:', data);

  const store = useCodeReviewStore.getState();

  // Update all in-progress steps and their agents to STOPPED
  store.setSteps(
    store.steps.map((step) => {
      // Skip already completed or failed steps
      if (step.status === 'COMPLETED' || step.status === 'FAILED') {
        return step;
      }

      // Update the step status to STOPPED
      const updatedStep = { ...step, status: 'STOPPED' as const };

      // Update all in-progress agents to STOPPED
      if (updatedStep.agents) {
        updatedStep.agents = updatedStep.agents.map((agent) =>
          agent.status === 'IN_PROGRESS' ? { ...agent, status: 'STOPPED' as const } : agent
        );
      }

      return updatedStep;
    })
  );

  // Update the overall review status
  useCodeReviewStore.setState({ reviewStatus: 'STOPPED' });
});

addCommandEventListener('user-agent-deleted', ({ data }) => {
  const agent_id = data as { agent_id: number };

  useCodeReviewSettingStore.setState({
    enabledAgents: useCodeReviewSettingStore
      .getState()
      .enabledAgents.filter((agent) => agent.id !== agent_id.agent_id),
  });
});

addCommandEventListener('fix-with-dd', ({ data }) => {
  console.log('Fix with DD response received:', data);
  const { fix_query } = data as { fix_query: string };
  useCodeReviewStore.setState({ commentFixQuery: fix_query });
  useExtensionStore.setState({ viewType: 'chat' });
  useChatSettingStore.setState({ chatType: 'write' });
});

addCommandEventListener('hit-new-review-after-file-event', () => {
  console.log('Hit new review after file event');
  newReview({
    targetBranch: useCodeReviewStore.getState().selectedTargetBranch,
    reviewType: useCodeReviewStore.getState().activeReviewOption.value,
  });
});

addCommandEventListener('comment-is-resolved', ({ data }) => {
  const commentId = data as number;
  console.log('Comment is resolved:', commentId);
  useCodeReviewStore.setState((state) => ({
    resolvedCommentIds: state.resolvedCommentIds.includes(commentId)
      ? state.resolvedCommentIds
      : [...state.resolvedCommentIds, commentId],
  }));
});

addCommandEventListener('comment-is-ignored', ({ data }) => {
  const commentId = data as number;
  console.log('Comment is ignored:', commentId);
  useCodeReviewStore.setState((state) => ({
    ignoredCommentIds: state.ignoredCommentIds.includes(commentId)
      ? state.ignoredCommentIds
      : [...state.ignoredCommentIds, commentId],
  }));
});
