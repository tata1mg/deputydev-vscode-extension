export interface GetUsagesArgs {
  symbolName: string;
  filePaths?: string[];
}

export interface ResolveModuleArgs {
  /**
   * File that contains the import. Can be:
   *  - absolute path
   */
  filePath: string;
  importName: string;
}
/** For symbol bodies we could locate. */
export interface EnrichedDefinition {
  filePath: string; // absolute
  selectionLine: number; // line of the symbol token
  fullRange: { start: number; end: number }; // inclusive
  code?: string; // truncated if large
  kind?: string;
  truncated?: boolean;
  omittedLineCount?: number;
}

/** For module files where we can’t get a specific symbol body. */
export interface ModulePreview {
  filePath: string; // absolute
  repoPath?: string;
  repoRelPath?: string;
  head?: string; // first N lines
  tail?: string; // last N lines
  totalLines?: number;
  truncated?: boolean;
}

export interface ResolveModuleResult {
  /** Resolved target locations (absolute). */
  moduleTargets: LocationInfo[];

  /** Hover text fragments (markdown/raw). */
  hoverTexts: string[];

  /** Bodies of resolved symbols (if any). */
  definitions?: EnrichedDefinition[];

  /** Previews for module files (when no symbol body). */
  modulePreviews?: ModulePreview[];
}

/** Only line numbers are returned now (no character fields). */
export type LocationInfo = {
  filePath: string;
  line: number;
  snippet?: string;
};

/** Enriched info about the symbol itself (optional in result). */
export interface SymbolInfo {
  name: string;
  kind: string;
  filePath: string; // ABSOLUTE
  selectionLine: number;
  fullRange: { start: number; end: number };
  code?: string; // full symbol body text if we could extract; omitted if not available
}

export interface GetUsagesResult {
  symbol: string;
  counts: {
    references: number;
    definitions: number;
    implementations: number;
  };
  /**
   * References classified against defs/impls.
   */
  references: LocationInfo[];
  definitions: LocationInfo[];
  implementations: LocationInfo[];

  /**
   * Optional enriched info about the symbol itself.
   * If we cannot extract the body/ranges, this will be omitted.
   */
  symbolInfo?: SymbolInfo;
}
