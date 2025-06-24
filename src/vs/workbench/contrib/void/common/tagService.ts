import { URI } from '../../../../base/common/uri';
import { IFileService, IFileChangesEvent } from '../../../../platform/files/common/files';
import { IVoidSettingsService } from './voidSettingsService';
import { Disposable, IDisposable, dispose } from '../../../../base/common/lifecycle';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions';
import { Emitter, Event } from '../../../../base/common/event';
import { IVoidModelService } from './voidModelService';
import { parse } from '../../../../base/common/yaml'; // Assuming a YAML parser is available

export interface ITaggedNote {
    uri: URI;
    // Potentially add note title if needed for display, but URI is key
}

export interface ITagInfo {
    name: string; // The tag itself, without '#'
    count: number;
    notes: URI[]; // URIs of notes containing this tag
}

export interface ITagService {
    readonly _serviceBrand: undefined;

    onDidChangeIndex: Event<void>;
    getAllTags(): ReadonlyMap<string, ITagInfo>; // Key is normalized tag name
    getNotesForTag(tagName: string): ReadonlyArray<URI>;
}

export const ITagService = createDecorator<ITagService>('tagService');

class TagService extends Disposable implements ITagService {
    _serviceBrand: undefined;

    private readonly _onDidChangeIndex = this._register(new Emitter<void>());
    readonly onDidChangeIndex: Event<void> = this._onDidChangeIndex.event;

    private tagsIndex: Map<string, ITagInfo> = new Map(); // Key: normalized tag name
    private vaultPath: URI | null = null;
    private fileWatcher: IDisposable | null = null;
    private isBuildingIndex: boolean = false;

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
            await this.buildFullIndex();
            // Watch for file changes within the vault
            this.fileWatcher = this.fileService.watch(this.vaultPath);
            this._register(this.fileWatcher);
            // More granular change handling than just onDidFilesChange might be needed
            // For now, simple onDidFilesChange and rebuild/update.
            this._register(this.fileService.onDidFilesChange(e => this.handleFileChanges(e)));
        } else {
            this.tagsIndex.clear();
            this._onDidChangeIndex.fire();
        }
    }

    private disposeFileWatcher(): void {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = null;
        }
    }

    private async buildFullIndex(): Promise<void> {
        if (!this.vaultPath || this.isBuildingIndex) return;
        this.isBuildingIndex = true;

        this.tagsIndex.clear();
        console.log('TagService: Starting full index build...');

        const files = await this.collectMarkdownFiles(this.vaultPath);
        for (const fileUri of files) {
            await this.parseAndIndexFile(fileUri);
        }

        this._onDidChangeIndex.fire();
        this.isBuildingIndex = false;
        console.log('TagService: Full index build complete.', this.tagsIndex);
    }

    private async collectMarkdownFiles(folderUri: URI): Promise<URI[]> {
        const collectedFiles: URI[] = [];
        try {
            const stat = await this.fileService.resolve(folderUri);
            if (!stat.children) return collectedFiles;

            for (const child of stat.children) {
                if (child.name.startsWith('.')) continue; // Skip hidden
                if (child.isDirectory) {
                    collectedFiles.push(...await this.collectMarkdownFiles(child.resource));
                } else if (child.name.endsWith('.md') || child.name.endsWith('.markdown')) {
                    collectedFiles.push(child.resource);
                }
            }
        } catch (error) {
            console.error(`TagService: Error collecting files in ${folderUri.fsPath}:`, error);
        }
        return collectedFiles;
    }

    private parseTagsFromContent(content: string): Set<string> {
        const foundTags = new Set<string>();

        // Regex for #tag - must not be preceded by a non-whitespace char (unless it's start of line)
        // and must be followed by word characters. Avoids matching things like color #RRGGBB or C#
        // It should not be immediately followed by a non-whitespace, non-punctuation character.
        // Handles: #tag, #tag/with/slash, #tag-with-hyphen
        // Does not handle: #123 (numeric tags usually not standard, but can be adapted)
        const tagRegex = /(?:^|\s)#([a-zA-Z0-9_/\-]+)(?=\s|$|[.,!?;:)\]}])/g;
        let match;
        while ((match = tagRegex.exec(content)) !== null) {
            if (match[1]) {
                 // Avoid empty tags if regex somehow allows it, or tags that are just slashes/hyphens
                if (match[1].trim() && !/^[/\-]+$/.test(match[1].trim())) {
                    foundTags.add(this.normalizeTagName(match[1]));
                }
            }
        }
        return foundTags;
    }

    private parseTagsFromFrontmatter(content: string): Set<string> {
        const foundTags = new Set<string>();
        const frontmatterRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/;
        const fmMatch = content.match(frontmatterRegex);

        if (fmMatch && fmMatch[1]) {
            try {
                const frontmatter = parse(fmMatch[1]); // Using 'yaml.parse'
                if (frontmatter && frontmatter.tags) {
                    if (Array.isArray(frontmatter.tags)) {
                        frontmatter.tags.forEach(tag => {
                            if (typeof tag === 'string' && tag.trim()) {
                                foundTags.add(this.normalizeTagName(tag));
                            }
                        });
                    } else if (typeof frontmatter.tags === 'string' && frontmatter.tags.trim()) {
                        // Handle comma or space separated tags in a single string
                        frontmatter.tags.split(/[\s,]+/).forEach(tag => {
                             if (tag.trim()) foundTags.add(this.normalizeTagName(tag));
                        });
                    }
                }
            } catch (e) {
                console.warn(`TagService: Failed to parse YAML frontmatter: ${e}`);
            }
        }
        return foundTags;
    }

    private async updateFileInIndex(fileUri: URI): Promise<void> {
        // First, remove old tags for this file to handle tag deletions or changes
        this.removeFileFromIndex(fileUri);
        // Then, re-parse and add
        await this.parseAndIndexFile(fileUri);
    }

    private removeFileFromIndex(fileUri: URI): void {
        const uriString = fileUri.toString();
        this.tagsIndex.forEach((tagInfo, tagName) => {
            const initialCount = tagInfo.notes.length;
            tagInfo.notes = tagInfo.notes.filter(noteUri => noteUri.toString() !== uriString);
            if (tagInfo.notes.length === 0) {
                this.tagsIndex.delete(tagName);
            } else if (tagInfo.notes.length !== initialCount) {
                tagInfo.count = tagInfo.notes.length;
            }
        });
    }


    private async parseAndIndexFile(fileUri: URI): Promise<void> {
        try {
            const { model } = await this.voidModelService.getModelSafe(fileUri);
            if (!model) return;

            const content = model.getValue();
            const contentTags = this.parseTagsFromContent(content);
            const frontmatterTags = this.parseTagsFromFrontmatter(content);
            const allTagsForFile = new Set([...contentTags, ...frontmatterTags]);

            allTagsForFile.forEach(tag => {
                const normalizedTag = this.normalizeTagName(tag);
                if (!this.tagsIndex.has(normalizedTag)) {
                    this.tagsIndex.set(normalizedTag, { name: normalizedTag, count: 0, notes: [] });
                }
                const tagInfo = this.tagsIndex.get(normalizedTag)!;
                // Ensure note URI is not added multiple times for the same tag
                if (!tagInfo.notes.some(nUri => nUri.toString() === fileUri.toString())) {
                    tagInfo.notes.push(fileUri);
                    tagInfo.count = tagInfo.notes.length;
                }
            });
        } catch (error) {
            console.error(`TagService: Error parsing file ${fileUri.fsPath}:`, error);
        }
    }

    private async handleFileChanges(event: IFileChangesEvent): Promise<void> {
        if (!this.vaultPath || this.isBuildingIndex) return;
        this.isBuildingIndex = true; // Prevent concurrent modifications

        let changed = false;
        for (const change of event.changes) {
            if (!change.resource.fsPath.startsWith(this.vaultPath.fsPath) || !(change.resource.fsPath.endsWith('.md') || change.resource.fsPath.endsWith('.markdown'))) {
                continue;
            }

            changed = true;
            if (change.type === 0 /* ADDED */ || change.type === 2 /* UPDATED */) {
                // For ADDED, we need to ensure it's not already being parsed if buildFullIndex was very recent
                // For UPDATED, we need to remove old tags and add new ones
                console.log(`TagService: Updating/Adding file in index: ${change.resource.fsPath}`);
                await this.updateFileInIndex(change.resource);
            } else if (change.type === 1 /* DELETED */) {
                console.log(`TagService: Removing file from index: ${change.resource.fsPath}`);
                this.removeFileFromIndex(change.resource);
            }
        }

        if (changed) {
            this._onDidChangeIndex.fire();
        }
        this.isBuildingIndex = false;
         console.log('TagService: File changes processed.', this.tagsIndex);
    }

    private normalizeTagName(name: string): string {
        // Basic normalization: lowercase. Tags are often case-insensitive.
        // Remove leading/trailing slashes/hyphens if they are part of the capture but not desired.
        return name.toLowerCase().replace(/^[/\\\-]+|[/\\\-]+$/g, '');
    }

    // --- Interface Methods ---

    getAllTags(): ReadonlyMap<string, ITagInfo> {
        // Sort tags alphabetically for display
        const sortedMap = new Map([...this.tagsIndex.entries()].sort((a, b) => a[0].localeCompare(b[0])));
        return sortedMap;
    }

    getNotesForTag(tagName: string): ReadonlyArray<URI> {
        const normalizedTag = this.normalizeTagName(tagName);
        return this.tagsIndex.get(normalizedTag)?.notes || [];
    }

    override dispose() {
        this.disposeFileWatcher();
        super.dispose();
    }
}

registerSingleton(ITagService, TagService, InstantiationType.Delayed);

[end of src/vs/workbench/contrib/void/common/tagService.ts]
