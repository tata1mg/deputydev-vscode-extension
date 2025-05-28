import * as vscode from 'vscode';
import { createTwoFilesPatch } from 'diff';
import * as path from 'path';
import { UsageTrackingManager } from '../../usageTracking/UsageTrackingManager';
import { UsageTrackingRequest } from '../../types';
import { promises as fs } from 'fs';

// Type definitions for the file change state manager
type FileChangeState = {
  initialFileContent: string; // The initial content of the file before any changes. Used to revert to the original state.
  originalContent: string; // The original content based on the current udiff
  modifiedContent: string; // The modified content based on the current udiff
  currentUdiff: string; // The current udiff content
  stateMetadata: {
    usageTrackingSource: string;
    usageTrackingSessionId: number | null; // The session ID for tracking usage
  };
  writeMode: boolean; // Indicates if the file is in write mode
};

export class FileChangeStateManager {
  // This map keeps track of the state of each file being edited.
  private readonly fileChangeStateMap: Map<string, FileChangeState>;
  private initialized = false; // Indicates if the manager is initialized

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.LogOutputChannel,
    private readonly persistentStateFilePath: string,
  ) {
    this.outputChannel.info('FileChangeStateManager initialized');
    this.outputChannel.info('Persistent state file path:', this.persistentStateFilePath);
    this.fileChangeStateMap = new Map<string, FileChangeState>();
    if (this.persistentStateFilePath) {
      // Load the file change state from the persistent state file
      this.loadFileChangeStateFromDisk();
    }
  }

  // This method loads the file change state from the persistent state file.
  private loadFileChangeStateFromDisk = async (): Promise<void> => {
    try {
      const fileContent = await fs.readFile(this.persistentStateFilePath);
      const fileChangeState = JSON.parse(fileContent.toString());
      for (const [key, value] of Object.entries(fileChangeState)) {
        this.fileChangeStateMap.set(key, value as FileChangeState);
      }
      this.outputChannel.info(`Loaded file change state from disk: ${this.persistentStateFilePath}`);
    } catch (error) {
      this.outputChannel.error(`Error loading file change state from disk: ${error}`);
    } finally {
      this.initialized = true;
    }
  };

  // This method saves the file change state to the persistent state file.
  private saveFileChangeStateToDisk = async (): Promise<void> => {
    try {
      const fileChangeState = Object.fromEntries(this.fileChangeStateMap);
      await fs.writeFile(this.persistentStateFilePath, JSON.stringify(fileChangeState));
      this.outputChannel.info(`Saved file change state to disk: ${this.persistentStateFilePath}`);
    } catch (error) {
      this.outputChannel.error(`Error saving file change state to disk: ${error}`);
    }
  };

  private updateFileChangeState = async (stateUri: string, fileChangeState: FileChangeState): Promise<void> => {
    this.fileChangeStateMap.set(stateUri, fileChangeState);
    await this.saveFileChangeStateToDisk();
  };

  // This method parses the udiff string to extract the original and modified content.
  private readonly getOriginalAndModifiedContentFromUdiff = (
    udiff: string,
  ): {
    originalContent: string;
    modifiedContent: string;
  } => {
    // Parse the udiff to extract original and modified content
    // This is a placeholder implementation. You need to implement the actual parsing logic.

    this.outputChannel.debug(`Parsing udiff: ${udiff}`);

    // firslly, handle CLRF and LF
    const lineEol = udiff.includes('\r\n') ? '\r\n' : '\n';
    const udiffWithEol = udiff.replace(/\r?\n/g, lineEol);

    // Split the udiff into lines
    // The udiff format typically starts with a line that begins with "@@", which indicates the start of a diff chunk.
    // The lines that start with "-" indicate lines that were removed, and lines that start with "+" indicate lines that were added.
    // The rest of the lines are context lines.
    const lines = udiffWithEol.split(lineEol);
    let originalContent = '';
    let modifiedContent = '';

    for (const line of lines) {
      if (line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++')) {
        // Skip the header line, or file path lines
        continue;
      }
      if (line.startsWith('-')) {
        originalContent += line.substring(1) + lineEol;
      } else if (line.startsWith('+')) {
        modifiedContent += line.substring(1) + lineEol;
      } else {
        // Context lines are added to both original and modified content
        originalContent += line.substring(1) + lineEol;
        modifiedContent += line.substring(1) + lineEol;
      }
    }

    // Remove the last line ending from the original and modified content
    originalContent = originalContent.endsWith(lineEol)
      ? originalContent.substring(0, originalContent.length - lineEol.length)
      : originalContent;
    modifiedContent = modifiedContent.endsWith(lineEol)
      ? modifiedContent.substring(0, modifiedContent.length - lineEol.length)
      : modifiedContent;
    return {
      originalContent: originalContent,
      modifiedContent: modifiedContent,
    };
  };

  private readonly countAddedAndRemovedLines = (udiff: string): { added: number; removed: number } => {
    const lines = udiff.split(/\r?\n/);

    let added = 0;
    let removed = 0;

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        added++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        removed++;
      }
    }

    return { added, removed };
  };

  private readonly getUdiffDisplayFileFromUdiffPatch = (udiffPatch: string, originalContent: string): string => {
    // first, get the line endings
    const lineEol = originalContent.includes('\r\n') ? '\r\n' : '\n';
    const udiffWithEol = udiffPatch.replace(/\r?\n/g, lineEol);

    // now, split the original content into lines and udiff into lines
    const originalLines = originalContent.split(lineEol);
    const udiffLines = udiffWithEol.split(lineEol);

    // initialize a variable for final content lines
    const finalContentLines: string[] = [];

    // now, iterate over the udiff, and get @@ blocks, get the original file line number and store original file lines upto the line number.
    // then add the new lines from the udiff
    // repeat this process until the end of the udiff
    let currentLineInOriginalFile: number = 0;
    for (let patchLineNum = 0; patchLineNum < udiffLines.length; patchLineNum++) {
      const currentUdiffLineContent = udiffLines[patchLineNum];
      if (currentUdiffLineContent.startsWith('@@')) {
        // get the line number in old file
        const lineNumber = parseInt(currentUdiffLineContent.split(' ')[1].split(',')[0].substring(1));
        const skipLinesCountInOriginalFile = parseInt(currentUdiffLineContent.split(' ')[1].split(',')[1]);

        // iterate through lines in original file and keep adding until the lineNumber is reached.
        // add the lines with a ' ' prefix to the final content
        for (let i = currentLineInOriginalFile; i < lineNumber - 1; i++) {
          // -1 to account for 0 based index
          this.outputChannel.debug(`Adding line ${i} from original file: ${originalLines[i]}`);
          finalContentLines.push(` ${originalLines[i]}`);
        }

        // skip the lines in original file
        currentLineInOriginalFile = lineNumber + skipLinesCountInOriginalFile - 1; // -1 to account for 0 based index

        // add udiff content until next @@ or end of file
        let currentLineInUdiff = patchLineNum + 1;
        while (currentLineInUdiff < udiffLines.length - 1 && !udiffLines[currentLineInUdiff].startsWith('@@')) {
          // -1 to account for the end of file
          // this if is important to check if the line is not a non udiff line
          if (
            udiffLines[currentLineInUdiff].startsWith('+') ||
            udiffLines[currentLineInUdiff].startsWith(' ') ||
            udiffLines[currentLineInUdiff].startsWith('-')
          ) {
            this.outputChannel.debug(`Adding line ${currentLineInUdiff} from udiff: ${udiffLines[currentLineInUdiff]}`);
            finalContentLines.push(udiffLines[currentLineInUdiff]);
          }
          currentLineInUdiff++;
        }

        // skip patchLineNum to currentLineInUdiff
        patchLineNum = currentLineInUdiff - 1; // -1 to account for the loop increment
      }
    }

    // add the remaining lines in original file
    for (let i = currentLineInOriginalFile; i >= 0 && i < originalLines.length; i++) {
      // -1 to account for previous increment in the loop
      this.outputChannel.debug(`Adding remaining line ${i} from original file: ${originalLines[i]}`);
      finalContentLines.push(` ${originalLines[i]}`);
    }

    // return the final content with line endings
    return finalContentLines.join(lineEol);
  };

  public async computeDiffLineChanges(
    filePath: string, // relative path of the file from the repo
    repoPath: string, // absolute path of the repo
    newFileContent: string, // the updated file contents
    newFilePath: string, // (optional) new filename if renamed; otherwise same as filePath
  ): Promise<{
    addedLines: number;
    removedLines: number;
  }> {
    const uri = path.join(repoPath, filePath);
    const newUri = path.join(repoPath, newFilePath);

    // Determine base content: use on-disk or original saved version
    let baseContent: string;
    if (this.fileChangeStateMap.has(uri)) {
      // Always diff against the last applied version
      baseContent = this.fileChangeStateMap.get(uri)!.initialFileContent;
      this.outputChannel.debug(`found base content in fileChangeStateMap for ${uri}`);
    } else {
      // Fallback to reading original content from disk or version control
      this.outputChannel.debug(`reading base content from disk for ${uri}`);
      baseContent = await this.getOriginalContentToShowDiffOn(filePath, repoPath);
    }

    // Create diff between saved (base) and new content
    const udiffPatch = createTwoFilesPatch(uri, newUri, baseContent, newFileContent);
    const { added, removed } = this.countAddedAndRemovedLines(udiffPatch);

    this.outputChannel.info(`Lines added: ${added}, Lines removed: ${removed}`);
    this.outputChannel.debug(`Udiff patch:\n${udiffPatch}`);

    return {
      addedLines: added,
      removedLines: removed,
    };
  }

  // This method updates the fileChangeStateMap with the original and modified content from the udiff.
  // It checks if the fileChangeStateMap already has the URI. If not, it sets the initial file content and udiff in the fileChangeStateMap.
  // If it does, it updates the udiff in the fileChangeStateMap.
  // It returns the original and modified content extracted from the udiff.
  // TODO: Handle rename
  public updateFileStateInFileChangeStateMapPostDiffApply = async (
    filePath: string, // relative path of the file from the repo
    repoPath: string, // absolute path of the repo
    newFileContent: string,
    newFilePath: string,
    writeMode: boolean,
    stateMetadata: {
      usageTrackingSource: string;
      usageTrackingSessionId: number | null;
    },
    initialFileContent?: string, // initial file content is only provided when the file is opened for the first time
  ): Promise<{
    addedLines: number;
    removedLines: number;
    originalContent: string;
    modifiedContent: string;
  }> => {
    const uri = path.join(repoPath, filePath);
    const newUri = path.join(repoPath, newFilePath);
    const contentToViewDiffOn = await this.getOriginalContentToShowDiffOn(filePath, repoPath);
    // Determine  added/removed lines
    const { addedLines: added, removedLines: removed } = await this.computeDiffLineChanges(
      filePath,
      repoPath,
      newFileContent,
      filePath,
    );
    // get the udiff from the new file content. The udiff is always between the new file content and the original file content
    // ensure the line endings are consistent in new file content
    const newFileContentWithEol = newFileContent.replace(
      /\r?\n/g,
      contentToViewDiffOn.includes('\r\n') ? '\r\n' : '\n',
    );
    const udiffPatch = createTwoFilesPatch(uri, newUri, contentToViewDiffOn, newFileContentWithEol);
    this.outputChannel.info(`Lines added: ${added}, Lines removed: ${removed}`);
    this.outputChannel.debug(`Udiff patch: ${udiffPatch}`);

    const udiff = this.getUdiffDisplayFileFromUdiffPatch(udiffPatch, contentToViewDiffOn);

    // get original and modified content from the udiff
    const parsedUdiffContent = this.getOriginalAndModifiedContentFromUdiff(udiff);

    // Check if the fileChangeStateMap has the URI
    // if not, set the fileChangeState in fileChangeStateMap
    if (!this.fileChangeStateMap.has(uri)) {
      // if initialFileContent is not provided, throw an error
      if (initialFileContent === undefined) {
        throw new Error(`Initial file content is required for the first time setting the udiff for ${uri}`);
      }
      // Set the initial file content and udiff in the fileChangeStateMap
      await this.updateFileChangeState(uri, {
        initialFileContent: initialFileContent,
        originalContent: parsedUdiffContent.originalContent,
        modifiedContent: parsedUdiffContent.modifiedContent,
        currentUdiff: udiff,
        stateMetadata: {
          usageTrackingSource: 'inlineDiff',
          usageTrackingSessionId: 0,
        },
        writeMode: writeMode,
      });
    } else {
      // update the udiff in the fileChangeStateMap
      await this.updateFileChangeState(uri, {
        ...this.fileChangeStateMap.get(uri)!,
        currentUdiff: udiff,
        originalContent: parsedUdiffContent.originalContent,
        modifiedContent: parsedUdiffContent.modifiedContent,
        stateMetadata: stateMetadata,
      });
    }

    // return the original and modified content
    return {
      addedLines: added,
      removedLines: removed,
      originalContent: parsedUdiffContent.originalContent,
      modifiedContent: parsedUdiffContent.modifiedContent,
    };
  };

  private readonly getDiskFileContent = async (uri: string): Promise<string> => {
    const fileUri = vscode.Uri.file(uri);
    try {
      // if file is not on disk, return empty string
      try {
        await vscode.workspace.fs.stat(fileUri);
      } catch (error) {
        this.outputChannel.error(`File not found on disk: ${uri}`);
        return '';
      }
      // read the file content
      const fileContent = await vscode.workspace.fs.readFile(fileUri);
      return fileContent.toString();
    } catch (error) {
      this.outputChannel.error(`Error reading file: ${error}`);
      throw error;
    }
  };

  // This method retrieves current modified content of the file based on the URI.
  public getCurrentContentOnWhichChangesAreToBeApplied = async (
    filePath: string, // relative path of the file from the repo
    repoPath: string, // absolute path of the repo
  ): Promise<string> => {
    const uri = path.join(repoPath, filePath);
    const fileChangeState = this.fileChangeStateMap.get(uri);

    // if fileChangeState is not found, try to read the file content and return it
    if (!fileChangeState) {
      const fileContent = await this.getDiskFileContent(uri);
      return fileContent;
    }
    return fileChangeState.modifiedContent;
  };

  // This method retrieves the current original content of the file based on the URI.
  public getOriginalContentToShowDiffOn = async (
    filePath: string, // relative path of the file from the repo
    repoPath: string, // absolute path of the repo
  ): Promise<string> => {
    const uri = path.join(repoPath, filePath);
    const fileChangeState = this.fileChangeStateMap.get(uri);

    // if fileChangeState is not found, try to read the file content and return it
    if (!fileChangeState) {
      const fileContent = await this.getDiskFileContent(uri);
      return fileContent;
    }
    return fileChangeState.originalContent;
  };

  public getFileChangeState = async (filePath: string, repoPath: string): Promise<FileChangeState | undefined> => {
    // wait until the fileChangeStateMap is initialized by sleeping until it is initialized
    while (!this.initialized) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const uri = path.join(repoPath, filePath);
    return this.fileChangeStateMap.get(uri);
  };

  private readonly trackUsage = async (
    eventName: string,
    eventData: { lines: number },
    filePath: string,
    repoPath: string,
  ) => {
    // track usage for the event
    const uri = path.join(repoPath, filePath);
    const fileChangeState = this.fileChangeStateMap.get(uri);
    const usageTrackingManager = new UsageTrackingManager();

    if (fileChangeState?.stateMetadata.usageTrackingSessionId) {
      await usageTrackingManager.trackUsage({
        eventType: eventName,
        eventData: {
          ...eventData,
          source: fileChangeState?.stateMetadata.usageTrackingSource || 'unknown',
          file_path: filePath,
        },
        sessionId: fileChangeState?.stateMetadata.usageTrackingSessionId,
      });
    }
  };

  public acceptChangeAtLine = async (
    filePath: string, // relative path of the file from the repo
    repoPath: string, // absolute path of the repo
    line: number, // line number to accept the change
  ): Promise<string> => {
    // accept the code change at the line number, until either the end of file is reached or the diff block ends
    // to accept, just navidate to the line number in the udiff, and remove all the  -  lines and convert all the + lines to space lines until the current line is not - or + or end of file
    const fileChangeState = this.fileChangeStateMap.get(path.join(repoPath, filePath));

    this.outputChannel.info(`udiff line number: ${line}`);
    if (!fileChangeState) {
      throw new Error(`File change state not found for ${filePath}`);
    }
    const { originalContent, modifiedContent, currentUdiff } = fileChangeState;
    const currentUdiffLineEol = currentUdiff.includes('\r\n') ? '\r\n' : '\n';
    const currentUdiffLines = currentUdiff.split(currentUdiffLineEol);
    const newUdiffLines: string[] = [];
    const lineNumber = 0;
    let udiffLineNumber = 0;
    const lineEol = originalContent.includes('\r\n') ? '\r\n' : '\n';

    let acceptedLinesCount = 0;
    // iterate through the lines in the udiff
    while (udiffLineNumber < currentUdiffLines.length) {
      // if we find the line that starts the block we want to accept, we accept the change
      if (udiffLineNumber === line - 1) {
        // iterate through the lines in the udiff until the line is not - or + or end of file
        while (
          udiffLineNumber < currentUdiffLines.length &&
          (currentUdiffLines[udiffLineNumber].startsWith('+') || currentUdiffLines[udiffLineNumber].startsWith('-'))
        ) {
          const currentLine = currentUdiffLines[udiffLineNumber];
          if (currentLine.startsWith('+')) {
            // convert the line to space
            newUdiffLines.push(` ${currentLine.substring(1)}`);
          }
          acceptedLinesCount++;
          udiffLineNumber++;
        }
      } else {
        // we add the line as it is
        newUdiffLines.push(currentUdiffLines[udiffLineNumber]);
        udiffLineNumber++;
      }
    }

    // since same iterator is used, udiffLineNumber will be at the end of the file
    // now, get the new udiff
    const newUdiff = newUdiffLines.join(lineEol);

    // now, set the new udiff in the fileChangeStateMap
    const originalAndModifiedContent = this.getOriginalAndModifiedContentFromUdiff(newUdiff);
    await this.updateFileChangeState(path.join(repoPath, filePath), {
      ...fileChangeState,
      currentUdiff: newUdiff,
      originalContent: originalAndModifiedContent.originalContent,
      modifiedContent: originalAndModifiedContent.modifiedContent,
    });

    // track usage for the event
    await this.trackUsage('ACCEPTED', { lines: acceptedLinesCount }, filePath, repoPath);

    // return the new udiff
    return newUdiff;
  };

  public rejectChangeAtLine = async (
    filePath: string, // relative path of the file from the repo
    repoPath: string, // absolute path of the repo
    line: number, // line number to reject the change
  ): Promise<string> => {
    // reject the code change at the line number, until either the end of file is reached or the diff block ends
    // to reject, just navigate to the line number in the udiff, and remove all the + lines and convert all the - lines to space lines until the current line is not - or + or end of file
    const fileChangeState = this.fileChangeStateMap.get(path.join(repoPath, filePath));

    this.outputChannel.info(`udiff line number: ${line}`);
    if (!fileChangeState) {
      throw new Error(`File change state not found for ${filePath}`);
    }
    const { originalContent, modifiedContent, currentUdiff } = fileChangeState;
    const currentUdiffLineEol = currentUdiff.includes('\r\n') ? '\r\n' : '\n';
    const currentUdiffLines = currentUdiff.split(currentUdiffLineEol);
    const newUdiffLines: string[] = [];
    const lineNumber = 0;
    let udiffLineNumber = 0;
    const lineEol = originalContent.includes('\r\n') ? '\r\n' : '\n';

    // iterate through the lines in the udiff
    while (udiffLineNumber < currentUdiffLines.length) {
      // if we find the line that starts the block we want to accept, we accept the change
      if (udiffLineNumber === line - 1) {
        // iterate through the lines in the udiff until the line is not - or + or end of file
        while (
          udiffLineNumber < currentUdiffLines.length &&
          (currentUdiffLines[udiffLineNumber].startsWith('+') || currentUdiffLines[udiffLineNumber].startsWith('-'))
        ) {
          const currentLine = currentUdiffLines[udiffLineNumber];
          if (currentLine.startsWith('-')) {
            // convert the line to space
            newUdiffLines.push(` ${currentLine.substring(1)}`);
          }
          udiffLineNumber++;
        }
      } else {
        // we add the line as it is
        newUdiffLines.push(currentUdiffLines[udiffLineNumber]);
        udiffLineNumber++;
      }
    }

    // since same iterator is used, udiffLineNumber will be at the end of the file
    // now, get the new udiff
    const newUdiff = newUdiffLines.join(lineEol);

    // now, set the new udiff in the fileChangeStateMap
    const originalAndModifiedContent = this.getOriginalAndModifiedContentFromUdiff(newUdiff);
    await this.updateFileChangeState(path.join(repoPath, filePath), {
      ...fileChangeState,
      currentUdiff: newUdiff,
      originalContent: originalAndModifiedContent.originalContent,
      modifiedContent: originalAndModifiedContent.modifiedContent,
    });

    // return the new udiff
    return newUdiff;
  };

  public acceptAllChangesInFile = async (
    filePath: string, // relative path of the file from the repo
    repoPath: string, // absolute path of the repo
  ): Promise<string> => {
    // accept all changes in the file, until either the end of file is reached or the diff block ends
    // to accept, just navigate through the udiff and add all lines that are not removed
    const fileChangeState = this.fileChangeStateMap.get(path.join(repoPath, filePath));

    if (!fileChangeState) {
      throw new Error(`File change state not found for ${filePath}`);
    }
    const { originalContent, modifiedContent, currentUdiff } = fileChangeState;
    const currentUdiffLineEol = currentUdiff.includes('\r\n') ? '\r\n' : '\n';
    const currentUdiffLines = currentUdiff.split(currentUdiffLineEol);
    const newUdiffLines: string[] = [];
    const lineNumber = 0;
    let udiffLineNumber = 0;
    const lineEol = originalContent.includes('\r\n') ? '\r\n' : '\n';

    let acceptedLinesCount = 0;
    // iterate through the lines in the udiff
    while (udiffLineNumber < currentUdiffLines.length) {
      if (currentUdiffLines[udiffLineNumber].startsWith('+')) {
        // convert the line to space
        newUdiffLines.push(` ${currentUdiffLines[udiffLineNumber].substring(1)}`);
        acceptedLinesCount++;
        udiffLineNumber++;
      } else if (currentUdiffLines[udiffLineNumber].startsWith('-')) {
        // skip the line
        acceptedLinesCount++;
        udiffLineNumber++;
      } else {
        // we add the line as it is
        newUdiffLines.push(currentUdiffLines[udiffLineNumber]);
        udiffLineNumber++;
      }
    }

    // since same iterator is used, udiffLineNumber will be at the end of the file
    // now, get the new udiff
    const newUdiff = newUdiffLines.join(lineEol);

    // now, set the new udiff in the fileChangeStateMap
    const originalAndModifiedContent = this.getOriginalAndModifiedContentFromUdiff(newUdiff);
    await this.updateFileChangeState(path.join(repoPath, filePath), {
      ...fileChangeState,
      currentUdiff: newUdiff,
      originalContent: originalAndModifiedContent.originalContent,
      modifiedContent: originalAndModifiedContent.modifiedContent,
    });

    // track usage for the event
    await this.trackUsage('ACCEPTED', { lines: acceptedLinesCount }, filePath, repoPath);

    // return the new udiff
    return newUdiff;
  };

  public rejectAllChangesInFile = async (
    filePath: string, // relative path of the file from the repo
    repoPath: string, // absolute path of the repo
  ): Promise<string> => {
    // reject all changes in the file, until either the end of file is reached or the diff block ends
    // to reject, just navigate through the udiff and add all lines that are removed
    const fileChangeState = this.fileChangeStateMap.get(path.join(repoPath, filePath));

    if (!fileChangeState) {
      throw new Error(`File change state not found for ${filePath}`);
    }
    const { originalContent, modifiedContent, currentUdiff } = fileChangeState;
    const currentUdiffLineEol = currentUdiff.includes('\r\n') ? '\r\n' : '\n';
    const currentUdiffLines = currentUdiff.split(currentUdiffLineEol);
    const newUdiffLines: string[] = [];
    const lineNumber = 0;
    let udiffLineNumber = 0;
    const lineEol = originalContent.includes('\r\n') ? '\r\n' : '\n';

    // iterate through the lines in the udiff
    while (udiffLineNumber < currentUdiffLines.length) {
      if (currentUdiffLines[udiffLineNumber].startsWith('+')) {
        // skip the line
        udiffLineNumber++;
      } else if (currentUdiffLines[udiffLineNumber].startsWith('-')) {
        // convert the line to space
        newUdiffLines.push(` ${currentUdiffLines[udiffLineNumber].substring(1)}`);
        udiffLineNumber++;
      } else {
        // we add the line as it is
        newUdiffLines.push(currentUdiffLines[udiffLineNumber]);
        udiffLineNumber++;
      }
    }

    // since same iterator is used, udiffLineNumber will be at the end of the file
    // now, get the new udiff
    const newUdiff = newUdiffLines.join(lineEol);

    // now, set the new udiff in the fileChangeStateMap
    const originalAndModifiedContent = this.getOriginalAndModifiedContentFromUdiff(newUdiff);
    this.outputChannel.debug(`New udiff: ${newUdiff}`);
    this.outputChannel.debug(`Original content: ${originalAndModifiedContent.originalContent}`);
    this.outputChannel.debug(`Modified content: ${originalAndModifiedContent.modifiedContent}`);
    await this.updateFileChangeState(path.join(repoPath, filePath), {
      ...fileChangeState,
      currentUdiff: newUdiff,
      originalContent: originalAndModifiedContent.originalContent,
      modifiedContent: originalAndModifiedContent.modifiedContent,
    });

    // return the new udiff
    return newUdiff;
  };

  public changeUdiffContent = async (
    filePath: string, // relative path of the file from the repo
    repoPath: string, // absolute path of the repo
    newUdiff: string, // new udiff content
  ): Promise<string> => {
    const fileChangeState = this.fileChangeStateMap.get(path.join(repoPath, filePath));
    if (!fileChangeState) {
      throw new Error(`File change state not found for ${filePath}`);
    }
    // now, set the new udiff in the fileChangeStateMap
    const originalAndModifiedContent = this.getOriginalAndModifiedContentFromUdiff(newUdiff);
    await this.updateFileChangeState(path.join(repoPath, filePath), {
      ...fileChangeState,
      currentUdiff: newUdiff,
      originalContent: originalAndModifiedContent.originalContent,
      modifiedContent: originalAndModifiedContent.modifiedContent,
    });

    // return the new udiff
    return newUdiff;
  };

  public removeFileChangeState = (filePath: string, repoPath: string): void => {
    const uri = path.join(repoPath, filePath);
    this.fileChangeStateMap.delete(uri);
    this.saveFileChangeStateToDisk();
  };

  public clearAllFileChangeStates = (): void => {
    this.fileChangeStateMap.clear();
    this.saveFileChangeStateToDisk();
  };
}
