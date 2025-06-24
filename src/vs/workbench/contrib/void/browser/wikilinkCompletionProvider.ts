import * as monaco from '../../../../editor/editor.api';
import { ITextModel } from '../../../../editor/common/model';
import { Position } from '../../../../editor/common/core/position';
import { CompletionContext, CompletionItem, CompletionItemKind, CompletionList, CompletionTriggerKind } from '../../../../editor/common/languages';
import { IWikilinkService } from '../common/wikilinkService';
import { IVoidSettingsService } from '../common/voidSettingsService';
import { URI } from '../../../../base/common/uri';

export class WikilinkCompletionProvider implements monaco.languages.CompletionItemProvider {

    constructor(
        private readonly wikilinkService: IWikilinkService,
        private readonly voidSettingsService: IVoidSettingsService
    ) {}

    triggerCharacters = ['['];

    async provideCompletionItems(
        model: ITextModel,
        position: Position,
        context: CompletionContext,
        token: monaco.CancellationToken
    ): Promise<CompletionList | undefined> {
        const vaultPathString = this.voidSettingsService.state.globalSettings.vaultPath;
        if (!vaultPathString || !model.uri.fsPath.startsWith(vaultPathString) || !model.uri.fsPath.endsWith('.md')) {
            return undefined;
        }

        const lineContent = model.getLineContent(position.lineNumber);
        // Check if we are inside [[...
        // A more robust check would involve looking at the character before position.column -1 (current char)
        // and position.column - 2 (char before that)
        const textBeforeCursor = lineContent.substring(0, position.column -1);

        if (!textBeforeCursor.endsWith('[[')) {
             // Check if we are already typing a link: [[Alr
            const openLinkMatch = textBeforeCursor.match(/\[\[([^\]]*)$/);
            if (!openLinkMatch) {
                return undefined;
            }
        }

        // If we are here, we are likely typing inside [[...]]
        // Extract the currently typed part of the link
        let currentLinkText = "";
        const linkStartMatch = textBeforeCursor.match(/\[\[([^\]]*)$/);
        if (linkStartMatch && linkStartMatch[1]) {
            currentLinkText = linkStartMatch[1];
        }

        const notes = this.wikilinkService.getNotes();
        const suggestions: CompletionItem[] = [];

        notes.forEach((note, normalizedName) => {
            // Note names in the index are already normalized (e.g., "my-note")
            // The actual filename might be "My Note.md"
            // For display and filtering, we might want to use the original filename without extension
            const originalFileNameWithoutExtension = note.uri.path.substring(note.uri.path.lastIndexOf('/') + 1).replace(/\.md$/i, '');

            if (originalFileNameWithoutExtension.toLowerCase().includes(currentLinkText.toLowerCase())) {
                suggestions.push({
                    label: originalFileNameWithoutExtension, // Show "My Note"
                    kind: CompletionItemKind.File,
                    insertText: originalFileNameWithoutExtension, // Insert "My Note"
                    range: monaco.Range.fromPositions(
                        position.delta(0, -currentLinkText.length), // From start of currentLinkText
                        position // To current cursor position
                    ),
                    detail: note.uri.fsPath,
                });
            }
        });

        return { suggestions };
    }
}
