import { URI } from '../../../../base/common/uri';
import { IFileService } from '../../../../platform/files/common/files';
import { IVoidSettingsService } from './voidSettingsService';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions';
import { Emitter, Event } from '../../../../base/common/event';
import { IVoidModelService } from './voidModelService';

export interface INote {
    uri: URI;
    name: string; // Derived from filename, e.g., "My Note.md" -> "My Note"
    links: string[]; // Array of target note names, e.g., ["Another Note", "Topic X"]
}

export interface IWikilinkService {
    readonly _serviceBrand: undefined;

    onDidChangeIndex: Event<void>;
    getNotes(): ReadonlyMap<string, INote>; // Key is normalized note name
    getNoteByUri(uri: URI): INote | undefined;
    resolveLink(sourceNoteUri: URI, targetName:string): URI | undefined; // Resolves link text to a URI
    findTargetNotes(targetName: string): INote[]; // Finds notes that match a link name
    getBacklinks(noteUri: URI): INote[];
}

export const IWikilinkService = createDecorator<IWikilinkService>('wikilinkService');

class WikilinkService extends Disposable implements IWikilinkService {
    _serviceBrand: undefined;

    private readonly _onDidChangeIndex = this._register(new Emitter<void>());
    readonly onDidChangeIndex: Event<void> = this._onDidChangeIndex.event;

    private notesIndex: Map<string, INote> = new Map(); // Key: normalized note name
    private uriToNoteName: Map<string, string> = new Map(); // Key: URI.toString(), Value: normalized note name

    private vaultPath: URI | null = null;
    private fileWatcher: IDisposable | null = null;

    constructor(
        @IFileService private readonly fileService: IFileService,
        @IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
        @IVoidModelService private readonly voidModelService: IVoidModelService,
    ) {
        super();
        this._register(this.voidSettingsService.onDidChangeState(() => this.handleSettingsChange()));
        this.handleSettingsChange(); // Initial setup
    }

    private async handleSettingsChange(): Promise<void> {
        const newVaultPathString = this.voidSettingsService.state.globalSettings.vaultPath;
        const newVaultPath = newVaultPathString ? URI.file(newVaultPathString) : null;

        if (this.vaultPath?.toString() === newVaultPath?.toString()) {
            return;
        }

        this.vaultPath = newVaultPath;
        this.disposeFileWatcher();

        if (this.vaultPath) {
            await this.buildIndex();
            this.fileWatcher = this.fileService.watch(this.vaultPath);
            this._register(this.fileWatcher);
            this._register(this.fileService.onDidFilesChange(e => this.handleFileChanges(e)));
        } else {
            this.notesIndex.clear();
            this.uriToNoteName.clear();
            this._onDidChangeIndex.fire();
        }
    }

    private disposeFileWatcher(): void {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = null;
        }
    }

    private async buildIndex(): Promise<void> {
        if (!this.vaultPath) return;

        this.notesIndex.clear();
        this.uriToNoteName.clear();

        const files = await this.collectMarkdownFiles(this.vaultPath);
        for (const fileUri of files) {
            await this.parseAndIndexFile(fileUri);
        }
        this._onDidChangeIndex.fire();
        console.log('Wikilink index built:', this.notesIndex);
    }

    private async collectMarkdownFiles(folderUri: URI): Promise<URI[]> {
        const collectedFiles: URI[] = [];
        try {
            const stat = await this.fileService.resolve(folderUri);
            if (!stat.children) return collectedFiles;

            for (const child of stat.children) {
                if (child.isDirectory) {
                    collectedFiles.push(...await this.collectMarkdownFiles(child.resource));
                } else if (child.name.endsWith('.md')) {
                    collectedFiles.push(child.resource);
                }
            }
        } catch (error) {
            console.error(`Error collecting files in ${folderUri.fsPath}:`, error);
        }
        return collectedFiles;
    }

    private async parseAndIndexFile(fileUri: URI): Promise<void> {
        try {
            const { model } = await this.voidModelService.getModelSafe(fileUri);
            if (!model) return;

            const content = model.getValue();
            const noteName = this.normalizeNoteName(this.getNoteNameFromUri(fileUri));

            // Simple wikilink regex: [[Link Name]] or [[Link Name|Display Text]]
            // This needs to be more robust to handle various edge cases.
            const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
            const links: string[] = [];
            let match;
            while ((match = linkRegex.exec(content)) !== null) {
                links.push(this.normalizeNoteName(match[1].trim()));
            }

            const note: INote = {
                uri: fileUri,
                name: noteName,
                links: links,
            };
            this.notesIndex.set(noteName, note);
            this.uriToNoteName.set(fileUri.toString(), noteName);
        } catch (error) {
            console.error(`Error parsing file ${fileUri.fsPath}:`, error);
        }
    }

    private async handleFileChanges(event: any /* IFileChangesEvent */): Promise<void> {
        // This is a simplified handler. A more robust implementation would check:
        // - If changes are within the vaultPath.
        // - Handle additions, deletions, and updates of .md files.
        // - For updates, re-parse the specific file.
        // - For deletions, remove from index.
        // - For additions, parse and add to index.
        // - For renames, it's more complex (treat as delete + add or update links).
        console.log('File changes detected, rebuilding index (simplistic). Event:', event);
        // For simplicity in phase 1, rebuild the whole index on any change.
        // This is inefficient for large vaults.
        if (this.vaultPath) {
             // Check if any change is relevant (within vault, is .md, etc.)
            let relevantChange = false;
            if (event.rawChanges) { // Assuming rawChanges structure, adapt if different
                for (const change of event.rawChanges) {
                    if (change.resource.fsPath.startsWith(this.vaultPath.fsPath) && (change.resource.fsPath.endsWith('.md') || change.type === 1 /* DELETED */ || change.type === 0 /* ADDED */ || change.type === 2 /* UPDATED */)) {
                        relevantChange = true;
                        break;
                    }
                }
            } else if (event.changes) { // Fallback or alternative structure for changes
                 for (const change of event.changes) {
                    if (change.resource.fsPath.startsWith(this.vaultPath.fsPath) && (change.resource.fsPath.endsWith('.md') || change.type === 1 /* DELETED */ || change.type === 0 /* ADDED */ || change.type === 2 /* UPDATED */)) {
                        relevantChange = true;
                        break;
                    }
                }
            }


            if (relevantChange) {
                console.log("Relevant file change detected, rebuilding wikilink index.");
                await this.buildIndex();
            }
        }
    }

    private getNoteNameFromUri(uri: URI): string {
        const path = uri.path;
        const nameWithExtension = path.substring(path.lastIndexOf('/') + 1);
        return nameWithExtension.substring(0, nameWithExtension.lastIndexOf('.md'));
    }

    private normalizeNoteName(name: string): string {
        // Basic normalization: lowercase and replace spaces with hyphens (configurable later)
        // This is important for matching links like "My Note" to "my-note.md"
        return name.toLowerCase().replace(/\s+/g, '-');
    }

    // --- Interface Methods ---

    getNotes(): ReadonlyMap<string, INote> {
        return this.notesIndex;
    }

    getNoteByUri(uri: URI): INote | undefined {
        const normalizedName = this.uriToNoteName.get(uri.toString());
        return normalizedName ? this.notesIndex.get(normalizedName) : undefined;
    }

    findTargetNotes(targetName: string): INote[] {
        const normalizedTarget = this.normalizeNoteName(targetName);
        const note = this.notesIndex.get(normalizedTarget);
        return note ? [note] : [];
    }

    resolveLink(sourceNoteUri: URI, targetName: string): URI | undefined {
        // In Obsidian, links are often relative to the vault root.
        // Or they can be just the note name.
        const normalizedTarget = this.normalizeNoteName(targetName);
        const targetNote = this.notesIndex.get(normalizedTarget);
        return targetNote?.uri;
    }

    getBacklinks(noteUri: URI): INote[] {
        const backlinks: INote[] = [];
        const targetNote = this.getNoteByUri(noteUri);
        if (!targetNote) {
            return backlinks;
        }

        const normalizedTargetName = targetNote.name; // Already normalized as it's a key in notesIndex or derived from it

        for (const [_, potentialSourceNote] of this.notesIndex) {
            if (potentialSourceNote.uri.toString() === noteUri.toString()) {
                continue; // Don't link to self in backlinks
            }
            // potentialSourceNote.links contains normalized link names
            if (potentialSourceNote.links.includes(normalizedTargetName)) {
                backlinks.push(potentialSourceNote);
            }
        }
        return backlinks;
    }

    override dispose() {
        this.disposeFileWatcher();
        super.dispose();
    }
}

registerSingleton(IWikilinkService, WikilinkService, InstantiationType.Delayed);
