import * as vscode from 'vscode';

export interface ILanguageFeaturesService {
  _serviceBrand: undefined;
  getDefinitions(uri: vscode.Uri, position: vscode.Position): Promise<(vscode.LocationLink | vscode.Location)[]>;
  getImplementations(uri: vscode.Uri, position: vscode.Position): Promise<(vscode.LocationLink | vscode.Location)[]>;
  getReferences(uri: vscode.Uri, position: vscode.Position): Promise<vscode.Location[]>;
  getWorkspaceSymbols(query: string): Promise<vscode.SymbolInformation[]>;
  getDocumentSymbols(uri: vscode.Uri): Promise<vscode.DocumentSymbol[]>;
  getDiagnostics(uri: vscode.Uri): vscode.Diagnostic[];
  resolveImport(uri: vscode.Uri, position: vscode.Position): Promise<vscode.Location[]>;
  getHover(uri: vscode.Uri, position: vscode.Position): Promise<vscode.Hover[]>;
}

export class LanguageFeaturesService implements ILanguageFeaturesService {
  declare readonly _serviceBrand: undefined;

  constructor() {}

  async getDefinitions(uri: vscode.Uri, position: vscode.Position): Promise<(vscode.LocationLink | vscode.Location)[]> {
    const res = await vscode.commands.executeCommand<(vscode.LocationLink | vscode.Location)[] | undefined>(
      'vscode.executeDefinitionProvider',
      uri,
      position,
    );
    return res ?? [];
  }

  async getTypeDefinitions(
    uri: vscode.Uri,
    position: vscode.Position,
  ): Promise<(vscode.LocationLink | vscode.Location)[]> {
    const res = await vscode.commands.executeCommand<(vscode.LocationLink | vscode.Location)[] | undefined>(
      'vscode.executeTypeDefinitionProvider',
      uri,
      position,
    );
    return res ?? [];
  }

  async getDeclarations(
    uri: vscode.Uri,
    position: vscode.Position,
  ): Promise<(vscode.LocationLink | vscode.Location)[]> {
    const res = await vscode.commands.executeCommand<(vscode.LocationLink | vscode.Location)[] | undefined>(
      'vscode.executeDeclarationProvider',
      uri,
      position,
    );
    return res ?? [];
  }
  async getImplementations(
    uri: vscode.Uri,
    position: vscode.Position,
  ): Promise<(vscode.LocationLink | vscode.Location)[]> {
    const res = await vscode.commands.executeCommand<(vscode.LocationLink | vscode.Location)[] | undefined>(
      'vscode.executeImplementationProvider',
      uri,
      position,
    );
    return res ?? [];
  }

  async getReferences(uri: vscode.Uri, position: vscode.Position): Promise<vscode.Location[]> {
    const res = await vscode.commands.executeCommand<vscode.Location[] | undefined>(
      'vscode.executeReferenceProvider',
      uri,
      position,
    );
    return res ?? [];
  }

  async getWorkspaceSymbols(query: string): Promise<vscode.SymbolInformation[]> {
    const res = await vscode.commands.executeCommand<vscode.SymbolInformation[] | undefined>(
      'vscode.executeWorkspaceSymbolProvider',
      query,
    );
    return res ?? [];
  }

  async getDocumentSymbols(uri: vscode.Uri): Promise<vscode.DocumentSymbol[]> {
    const res = await vscode.commands.executeCommand<vscode.DocumentSymbol[] | vscode.SymbolInformation[] | undefined>(
      'vscode.executeDocumentSymbolProvider',
      uri,
    );

    if (!res) {
      return [];
    }

    if (this.isDocumentSymbolArray(res)) {
      return res;
    }

    // Convert SymbolInformation[] -> DocumentSymbol[]
    return (res as vscode.SymbolInformation[]).map((si) => this.symbolInformationToDocumentSymbol(si));
  }

  getDiagnostics(uri: vscode.Uri): vscode.Diagnostic[] {
    return vscode.languages.getDiagnostics(uri);
  }

  async getHover(uri: vscode.Uri, position: vscode.Position): Promise<vscode.Hover[]> {
    const res = await vscode.commands.executeCommand<vscode.Hover[] | undefined>(
      'vscode.executeHoverProvider',
      uri,
      position,
    );
    return res ?? [];
  }

  // -------- High-level: resolve an import target --------
  // Call this on the module specifier token (or imported identifier).
  async resolveImport(uri: vscode.Uri, position: vscode.Position): Promise<vscode.Location[]> {
    // 1) Try definition
    const defs = this.flattenLocations(await this.getDefinitions(uri, position));
    if (defs.length) {
      return this.dedupeLocations(defs);
    }

    // 2) Try type definition (common for .d.ts)
    const typeDefs = this.flattenLocations(await this.getTypeDefinitions(uri, position));
    if (typeDefs.length) {
      return this.dedupeLocations(typeDefs);
    }

    // 3) Try declarations
    const decls = this.flattenLocations(await this.getDeclarations(uri, position));
    if (decls.length) {
      return this.dedupeLocations(decls);
    }

    // 4) Nothing found
    return [];
  }

  // -------------------------
  // Helpers
  // -------------------------

  private isDocumentSymbolArray(
    arr: vscode.DocumentSymbol[] | vscode.SymbolInformation[],
  ): arr is vscode.DocumentSymbol[] {
    // DocumentSymbol has a 'selectionRange'; SymbolInformation does not.
    return (
      (arr as vscode.DocumentSymbol[])[0]?.selectionRange instanceof vscode.Range ||
      (arr as vscode.DocumentSymbol[]).length === 0
    );
  }

  private flattenLocations(res: (vscode.Location | vscode.LocationLink)[] | undefined): vscode.Location[] {
    const out: vscode.Location[] = [];
    for (const item of res ?? []) {
      const anyItem = item as any;
      if ('targetUri' in anyItem) {
        // LocationLink -> use targetSelectionRange if present, else targetRange
        const link = item as vscode.LocationLink;
        out.push(new vscode.Location(link.targetUri, link.targetSelectionRange ?? link.targetRange));
      } else {
        out.push(item as vscode.Location);
      }
    }
    return out;
  }

  private dedupeLocations(locs: vscode.Location[]): vscode.Location[] {
    const seen = new Set<string>();
    const res: vscode.Location[] = [];
    for (const l of locs) {
      const r = l.range;
      const key = `${l.uri.toString()}#${r.start.line}:${r.start.character}-${r.end.line}:${r.end.character}`;
      if (!seen.has(key)) {
        seen.add(key);
        res.push(l);
      }
    }
    return res;
  }

  // Optional: if you want to turn hover contents into plain text
  // (Hover.contents can be MarkdownString or MarkedString (string | {language,value}))
  private hoverToText(hover: vscode.Hover): string[] {
    const parts: string[] = [];
    for (const c of hover.contents as (vscode.MarkdownString | vscode.MarkedString)[]) {
      if (typeof c === 'string') {
        parts.push(c);
      } else if ('value' in (c as any)) {
        // MarkedString object
        parts.push((c as { value: string }).value);
      } else if (c instanceof vscode.MarkdownString) {
        parts.push(c.value);
      }
    }
    return parts;
  }

  private symbolInformationToDocumentSymbol(si: vscode.SymbolInformation): vscode.DocumentSymbol {
    // Map SymbolInformation to a flat DocumentSymbol (no children)
    const range = si.location.range;
    const ds = new vscode.DocumentSymbol(si.name, si.containerName ?? '', si.kind, range, range);
    // children remain empty for flat conversion
    return ds;
  }
}
