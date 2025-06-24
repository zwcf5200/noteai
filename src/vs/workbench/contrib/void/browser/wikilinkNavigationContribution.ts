import { Disposable, IDisposable, dispose } from '../../../../base/common/lifecycle';
import { ICodeEditor } from '../../../../editor/browser/editorBrowser';
import { registerEditorContribution, EditorContributionInstantiation } from '../../../../editor/browser/editorExtensions';
import { IEditorContribution } from '../../../../editor/common/editorCommon';
import { ITextModel } from '../../../../editor/common/model';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation';
import { IWikilinkService, INote } from '../common/wikilinkService';
import { IVoidSettingsService } from '../common/voidSettingsService';
import { URI } from '../../../../base/common/uri';
import { IEditorService } from '../../../services/editor/common/editorService';
import { MarkdownRenderer } from '../../../contrib/markdown/browser/markdownRenderer'; // For potential hover
import { IOpenerService } from '../../../../platform/opener/common/opener'; // For external links, if ever needed for wikilinks
import { Range } from '../../../../editor/common/core/range';
import { ModelDecorationOptions } from '../../../../editor/common/model/textModel';
import { overviewRulerError, overviewRulerInfo, overviewRulerWarning } from '../../../../editor/common/core/editorColorRegistry';
import { themeColorFromId } from '../../../../platform/theme/common/themeService';


const WIKILINK_DECORATION_OPTIONS = ModelDecorationOptions.register({
    description: 'wikilink-decoration',
    stickiness: 1, // TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
    inlineClassName: 'void-wikilink', // CSS class for styling (underline, color)
    // For hover, we'd need a hoverMessage or use a different mechanism like HoverProvider
});

export class WikilinkNavigationContribution extends Disposable implements IEditorContribution {
    public static readonly ID = 'void.wikilinkNavigation';

    private modelListeners: IDisposable[] = [];
    private currentDecorations: string[] = [];

    constructor(
        private readonly editor: ICodeEditor,
        @IInstantiationService private readonly instantiationService: IInstantiationService,
        @IWikilinkService private readonly wikilinkService: IWikilinkService,
        @IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
        @IEditorService private readonly editorService: IEditorService,
    ) {
        super();

        this._register(this.editor.onDidChangeModel(() => this.onModelChanged()));
        this._register(this.wikilinkService.onDidChangeIndex(() => this.updateDecorations()));
        this._register(this.editor.onMouseDown(e => this.onEditorMouseDown(e)));

        // Initial setup
        this.onModelChanged();
    }

    private onModelChanged(): void {
        dispose(this.modelListeners);
        this.modelListeners = [];
        this.clearDecorations();

        const model = this.editor.getModel();
        if (model && this.isMarkdownInVault(model.uri)) {
            this.modelListeners.push(model.onDidChangeContent(() => this.updateDecorations()));
            this.updateDecorations();
        }
    }

    private isMarkdownInVault(uri: URI): boolean {
        const vaultPathString = this.voidSettingsService.state.globalSettings.vaultPath;
        if (!vaultPathString) return false;
        return uri.scheme === 'file' && uri.fsPath.endsWith('.md') && uri.fsPath.startsWith(vaultPathString);
    }

    private updateDecorations(): void {
        const model = this.editor.getModel();
        if (!model || !this.isMarkdownInVault(model.uri)) {
            this.clearDecorations();
            return;
        }

        const note = this.wikilinkService.getNoteByUri(model.uri);
        if (!note || note.links.length === 0) {
            this.clearDecorations();
            return;
        }

        const decorations = [];
        const text = model.getValue();

        // More robust regex to find [[link]] or [[link|display]]
        // It captures the full match, the link part, and optionally the display part
        const linkRegex = /(\[\[([^\]|]+)(?:\|[^\]]+)?\]\])/g;
        let match;

        while ((match = linkRegex.exec(text)) !== null) {
            const fullMatchText = match[1]; // e.g., "[[My Note]]" or "[[My Note|Alias]]"
            const linkName = match[2].trim();    // e.g., "My Note"

            const startPos = model.getPositionAt(match.index);
            const endPos = model.getPositionAt(match.index + fullMatchText.length);
            const range = new Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column);

            const targetUri = this.wikilinkService.resolveLink(model.uri, linkName);

            decorations.push({
                range: range,
                options: {
                    ...WIKILINK_DECORATION_OPTIONS,
                    // Store target URI in hoverMessage for simplicity in onEditorMouseDown
                    // A proper HoverProvider would be better for rich hovers.
                    hoverMessage: targetUri ? { value: `Go to: ${targetUri.fsPath}` } : { value: `Note not found: ${linkName}` }
                }
            });
        }
        this.currentDecorations = this.editor.deltaDecorations(this.currentDecorations, decorations);
    }

    private onEditorMouseDown(event: any /* IEditorMouseEvent */): void {
        const model = this.editor.getModel();
        if (!model || !this.isMarkdownInVault(model.uri)) return;

        const target = event.target;
        if (target.type === 6 /* CONTENT_TEXT */ && target.detail?.decorations) {
            for (const decoration of target.detail.decorations) {
                if (decoration.className === 'void-wikilink') { // Check our specific class
                    const linkTextWithBrackets = model.getValueInRange(decoration.range);
                    // Regex to extract note name and optional header: [[NoteName(#Header)?(|Alias)?]]
                    // Captures: 1=NoteName, 2=#Header (optional), 3=Header (optional, without #)
                    const linkParseRegex = /\[\[([^\]#|]+)(#([^\]|]+))?(?:\|[^\]]+)?\]\]/;
                    const parsedLinkMatch = linkParseRegex.exec(linkTextWithBrackets);

                    if (parsedLinkMatch && parsedLinkMatch[1]) {
                        const targetNoteName = parsedLinkMatch[1].trim();
                        const targetHeader = parsedLinkMatch[3] ? parsedLinkMatch[3].trim() : undefined;

                        const targetUri = this.wikilinkService.resolveLink(model.uri, targetNoteName);

                        if (targetUri) {
                            this.editorService.openEditor({
                                resource: targetUri,
                                options: { preserveFocus: false }
                            }).then(openedEditor => {
                                if (openedEditor && targetHeader) {
                                    // Attempt to find and reveal the header
                                    const editorControl = openedEditor.getControl() as ICodeEditor | null;
                                    if (editorControl && editorControl.getModel()) {
                                        const targetModel = editorControl.getModel();
                                        if (targetModel) {
                                            const headerLine = this.findHeaderLine(targetModel, targetHeader);
                                            if (headerLine !== -1) {
                                                editorControl.revealLineInCenterIfOutsideViewport(headerLine, 0 /* ScrollType.Smooth */);
                                                editorControl.setPosition({ lineNumber: headerLine, column: 1 });
                                            }
                                        }
                                    }
                                }
                            });
                            event.event.stopPropagation();
                            return;
                        } else {
                            this.offerToCreateNote(targetNoteName, model.uri); // Pass targetNoteName
                            event.event.stopPropagation();
                            return;
                        }
                    }
                }
            }
        }
    }

    private findHeaderLine(model: ITextModel, headerText: string): number {
        const headerRegexes = [
            new RegExp(`^#\\s+${this.escapeRegex(headerText)}\\s*$`, 'im'),
            new RegExp(`^##\\s+${this.escapeRegex(headerText)}\\s*$`, 'im'),
            new RegExp(`^###\\s+${this.escapeRegex(headerText)}\\s*$`, 'im'),
            new RegExp(`^####\\s+${this.escapeRegex(headerText)}\\s*$`, 'im'),
            new RegExp(`^#####\\s+${this.escapeRegex(headerText)}\\s*$`, 'im'),
            new RegExp(`^######\\s+${this.escapeRegex(headerText)}\\s*$`, 'im'),
        ];
        const lineCount = model.getLineCount();
        for (let i = 1; i <= lineCount; i++) {
            const lineContent = model.getLineContent(i);
            for (const regex of headerRegexes) {
                if (regex.test(lineContent)) {
                    return i;
                }
            }
        }
        return -1; // Not found
    }

    private escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }

    private clearDecorations(): void {
        this.currentDecorations = this.editor.deltaDecorations(this.currentDecorations, []);
    }

    override dispose(): void {
        super.dispose();
        dispose(this.modelListeners);
        this.clearDecorations();
    }

    private async offerToCreateNote(linkName: string, sourceModelUri: URI): Promise<void> {
        const dialogService = this.instantiationService.get(IDialogService);
        const fileService = this.instantiationService.get(IFileService);
        const editorService = this.instantiationService.get(IEditorService);
        const voidSettingsService = this.instantiationService.get(IVoidSettingsService);

        const vaultPathString = voidSettingsService.state.globalSettings.vaultPath;
        if (!vaultPathString) return; // Should not happen if we are in a vault context

        const confirmation = await dialogService.confirm({
            message: `Note "${linkName}" does not exist. Create it?`,
            primaryButton: 'Create Note',
            cancelButton: 'Cancel'
        });

        if (confirmation.confirmed) {
            let newFileName = linkName.trim();
            // Basic sanitization: replace characters not suitable for filenames, could be more robust
            newFileName = newFileName.replace(/[\\/:*?"<>|]/g, '-');
            if (!newFileName.toLowerCase().endsWith('.md')) {
                newFileName += '.md';
            }

            // For now, create in the root of the vault.
            // Future: could offer to select folder or use sourceModelUri's folder.
            const vaultUri = URI.file(vaultPathString);
            const newFileUri = URI.joinPath(vaultUri, newFileName);

            try {
                if (await fileService.exists(newFileUri)) {
                    // Should ideally not happen if resolveLink failed, but as a safeguard:
                    await dialogService.info(`Note "${newFileName}" already exists.`);
                    editorService.openEditor({ resource: newFileUri });
                } else {
                    await fileService.createFile(newFileUri, undefined, { overwrite: false });
                    editorService.openEditor({ resource: newFileUri });
                    // WikilinkService watcher should pick this up and update index.
                }
            } catch (error) {
                console.error("Error creating new note from wikilink:", error);
                dialogService.error(`Failed to create note: ${error}`);
            }
        }
    }

    override dispose(): void {
        super.dispose();
        dispose(this.modelListeners);
        this.clearDecorations();
    }
}

registerEditorContribution(WikilinkNavigationContribution.ID, WikilinkNavigationContribution, EditorContributionInstantiation.AfterFirstRender);

// Add some basic CSS for the wikilinks (users can override in their custom CSS)
const style = document.createElement('style');
style.textContent = `
    .void-wikilink {
        color: var(--vscode-textLink-foreground);
        text-decoration: underline;
        cursor: pointer;
    }
    .void-wikilink:hover {
        color: var(--vscode-textLink-activeForeground);
    }
`;
document.head.appendChild(style);
