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
                    const linkNameWithBrackets = model.getValueInRange(decoration.range);
                    // Extract link name: [[Link Name]] or [[Link Name|Display]] -> Link Name
                    const match = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/.exec(linkNameWithBrackets);
                    if (match && match[1]) {
                        const linkName = match[1].trim();
                        const targetUri = this.wikilinkService.resolveLink(model.uri, linkName);
                        if (targetUri) {
                            this.editorService.openEditor({ resource: targetUri });
                            event.event.stopPropagation(); // Prevent default editor actions
                            return;
                        } else {
                            // Optionally offer to create note
                            console.warn(`Wikilink target not found: ${linkName}`);
                        }
                    }
                }
            }
        }
    }

    private clearDecorations(): void {
        this.currentDecorations = this.editor.deltaDecorations(this.currentDecorations, []);
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
