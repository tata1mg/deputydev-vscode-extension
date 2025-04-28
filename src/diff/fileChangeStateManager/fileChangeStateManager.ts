import * as vscode from "vscode";
import { createTwoFilesPatch } from "diff";
import path = require("path");

// Type definitions for the file change state manager
type FileChangeState = {
  initialFileContent: string; // The initial content of the file before any changes. Used to revert to the original state.
  originalContent: string; // The original content based on the current udiff
  modifiedContent: string; // The modified content based on the current udiff
  currentUdiff: string; // The current udiff content
}

export class FileChangeStateManager {
  // This map keeps track of the state of each file being edited.
  private readonly fileChangeStateMap: Map<string, FileChangeState>;


  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.LogOutputChannel
  ) {
    this.fileChangeStateMap = new Map<string, FileChangeState>();
  }

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
    const lineEol = udiff.includes("\r\n") ? "\r\n" : "\n";
    const udiffWithEol = udiff.replace(/\r?\n/g, lineEol);

    // Split the udiff into lines
    // The udiff format typically starts with a line that begins with "@@", which indicates the start of a diff chunk.
    // The lines that start with "-" indicate lines that were removed, and lines that start with "+" indicate lines that were added.
    // The rest of the lines are context lines.
    const lines = udiffWithEol.split(lineEol);
    let originalContent = "";
    let modifiedContent = "";

    for (const line of lines) {
      if (line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++")) {
        // Skip the header line, or file path lines
        continue;
      }
      if (line.startsWith("-")) {
        originalContent += line.substring(1) + lineEol;
      } else if (line.startsWith("+")) {
        modifiedContent += line.substring(1) + lineEol;
      } else {
        // Context lines are added to both original and modified content
        originalContent += line + lineEol;
        modifiedContent += line + lineEol;
      }
    }
    return {
      originalContent: originalContent,
      modifiedContent: modifiedContent
    };
  };

  private readonly getUdiffDisplayFileFromUdiffPatch = (udiffPatch: string, originalContent: string): string => {
    // first, get the line endings
    const lineEol = originalContent.includes("\r\n") ? "\r\n" : "\n";
    const udiffWithEol = udiffPatch.replace(/\r?\n/g, lineEol);

    // now, split the original content into lines and udiff into lines
    const originalLines = originalContent.split(lineEol);
    const udiffLines = udiffWithEol.split(lineEol);

    // initialize a variable for final content lines
    let finalContentLines: string[] = [];


    // now, iterate over the udiff, and get @@ blocks, get the original file line number and store original file lines upto the line number.
    // then add the new lines from the udiff
    // repeat this process until the end of the udiff
    let currentLineInOriginalFile: number = 0;
    for (let patchLineNum = 0; patchLineNum < udiffLines.length; patchLineNum++) {
      const currentUdiffLineContent = udiffLines[patchLineNum];
      if (currentUdiffLineContent.startsWith("@@")) {
        // get the line number in old file
        const lineNumber = parseInt(currentUdiffLineContent.split(" ")[1].split(",")[0].substring(1));
        const skipLinesCountInOriginalFile = parseInt(currentUdiffLineContent.split(" ")[1].split(",")[1]);

        // iterate through lines in original file and keep adding until the lineNumber is reached.
        // add the lines with a ' ' prefix to the final content
        for (let i = currentLineInOriginalFile; i < lineNumber - 1; i++) { // -1 to account for 0 based index
          finalContentLines.push(` ${originalLines[i]}`);
        }

        // skip the lines in original file
        currentLineInOriginalFile = lineNumber + skipLinesCountInOriginalFile - 1; // -1 to account for 0 based index

        // add udiff content until next @@ or end of file
        let currentLineInUdiff = patchLineNum + 1;
        while (currentLineInUdiff < udiffLines.length - 1 && !udiffLines[currentLineInUdiff].startsWith("@@")) { // -1 to account for the end of file
          finalContentLines.push(udiffLines[currentLineInUdiff]);
          currentLineInUdiff++;
        }

        // skip patchLineNum to currentLineInUdiff
        patchLineNum = currentLineInUdiff - 1; // -1 to account for the loop increment
      } 
    }

    // add the remaining lines in original file
    for (let i = currentLineInOriginalFile; i < originalLines.length; i++) { // -1 to account for previous increment in the loop
      finalContentLines.push(` ${originalLines[i]}`);
    }

    // return the final content with line endings
    return finalContentLines.join(lineEol)
  }

  // This method updates the fileChangeStateMap with the original and modified content from the udiff.
  // It checks if the fileChangeStateMap already has the URI. If not, it sets the initial file content and udiff in the fileChangeStateMap.
  // If it does, it updates the udiff in the fileChangeStateMap.
  // It returns the original and modified content extracted from the udiff.
  // TODO: Handle rename
  public updateFileStateInFileChangeStateMap = async (
    filePath: string, // relative path of the file from the repo
    repoPath: string, // absolute path of the repo
    newFileContent: string,
    newFilePath: string,
    initialFileContent?: string, // initial file content is only provided when the file is opened for the first time
  ): Promise<{
    originalContent: string;
    modifiedContent: string;
  }> => {
    const uri = path.join(repoPath, filePath);
    const newUri = path.join(repoPath, newFilePath);
    const contentToViewDiffOn = await this.getOriginalContentToShowDiffOn(filePath, repoPath);
    // get the udiff from the new file content. The udiff is always between the new file content and the original file content
    const udiffPatch = createTwoFilesPatch(uri, newUri, contentToViewDiffOn, newFileContent);
    this.outputChannel.debug(`Udiff patch: ${udiffPatch}`);

    const udiff = this.getUdiffDisplayFileFromUdiffPatch(udiffPatch, contentToViewDiffOn);

    // get original and modified content from the udiff
    const parsedUdiffContent =
      this.getOriginalAndModifiedContentFromUdiff(udiff);

    // Check if the fileChangeStateMap has the URI
    // if not, set the fileChangeState in fileChangeStateMap
    if (!this.fileChangeStateMap.has(uri)) {
      // if initialFileContent is not provided, throw an error
      if (!initialFileContent) {
        throw new Error(
          `Initial file content is required for the first time setting the udiff for ${uri}`
        );
      }
      // Set the initial file content and udiff in the fileChangeStateMap
      this.fileChangeStateMap.set(uri, {
        initialFileContent: initialFileContent,
        originalContent: parsedUdiffContent.originalContent,
        modifiedContent: parsedUdiffContent.modifiedContent,
        currentUdiff: udiff,
      });
    } else {
      // update the udiff in the fileChangeStateMap
      this.fileChangeStateMap.set(uri, {
        ...this.fileChangeStateMap.get(uri)!,
        currentUdiff: udiff,
        originalContent: parsedUdiffContent.originalContent,
        modifiedContent: parsedUdiffContent.modifiedContent,
      });
    }

    // return the original and modified content
    return {
      originalContent: parsedUdiffContent.originalContent,
      modifiedContent: parsedUdiffContent.modifiedContent,
    };
  }

  private readonly getDiskFileContent = async (uri: string): Promise<string> => {
    const fileUri = vscode.Uri.file(uri);
    try {
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
  }

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
  }

  public getFileChangeState = (filePath: string, repoPath: string): FileChangeState | undefined => {
    const uri = path.join(repoPath, filePath);
    return this.fileChangeStateMap.get(uri);
  }
}