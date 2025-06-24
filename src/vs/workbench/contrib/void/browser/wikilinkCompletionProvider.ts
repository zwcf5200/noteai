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

    triggerCharacters = ['[', '#']; // Add '#' as a trigger character

    private getNoteNameFromLinkContext(textBeforeCursor: string): string | null {
        // Extracts "NoteName" from "[[NoteName#"
        const match = textBeforeCursor.match(/\[\[([^#|\]]+)#$/);
        return match ? match[1] : null;
    }

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
        const textBeforeCursor = lineContent.substring(0, position.column - 1); // Text before the character that triggered completion

        const suggestions: CompletionItem[] = [];

        // Case 1: Triggered by '[' for note name completion
        if (context.triggerKind === CompletionTriggerKind.TriggerCharacter && context.triggerCharacter === '[') {
            if (textBeforeCursor.endsWith('[')) { // We are at [[
                const notes = this.wikilinkService.getNotes();
                notes.forEach((note, _normalizedName) => {
                    const originalFileNameWithoutExtension = note.uri.path.substring(note.uri.path.lastIndexOf('/') + 1).replace(/\.md$/i, '');
                    suggestions.push({
                        label: originalFileNameWithoutExtension,
                        kind: CompletionItemKind.File,
                        insertText: originalFileNameWithoutExtension,
                        range: monaco.Range.fromPositions(position, position), // Insert at cursor
                        detail: `link to note: ${originalFileNameWithoutExtension}`,
                    });
                });
            }
        }
        // Case 2: Triggered by typing inside an already started [[link for note name
        else if (!textBeforeCursor.endsWith('#')) { // Avoid conflict with header completion if '#' was just typed
            const noteLinkMatch = textBeforeCursor.match(/\[\[([^#\]]*)$/);
            if (noteLinkMatch) {
                const currentTypedNoteName = noteLinkMatch[1];
                const notes = this.wikilinkService.getNotes();
                notes.forEach((note, _normalizedName) => {
                    const originalFileNameWithoutExtension = note.uri.path.substring(note.uri.path.lastIndexOf('/') + 1).replace(/\.md$/i, '');
                    if (originalFileNameWithoutExtension.toLowerCase().includes(currentTypedNoteName.toLowerCase())) {
                        suggestions.push({
                            label: originalFileNameWithoutExtension,
                            kind: CompletionItemKind.File,
                            insertText: originalFileNameWithoutExtension,
                            range: monaco.Range.fromPositions(position.delta(0, -currentTypedNoteName.length), position),
                            detail: `link to note: ${originalFileNameWithoutExtension}`,
                        });
                    }
                });
            }
        }

        // Case 3: Triggered by '#' for header completion
        if (context.triggerKind === CompletionTriggerKind.TriggerCharacter && context.triggerCharacter === '#') {
            const noteNameForHeader = this.getNoteNameFromLinkContext(textBeforeCursor + "#"); // Add # back as it's consumed
            if (noteNameForHeader) {
                const targetNotes = this.wikilinkService.findTargetNotes(noteNameForHeader); // findTargetNotes uses normalized name
                if (targetNotes.length > 0) {
                    const targetNote = targetNotes[0]; // Assume first match for simplicity
                    targetNote.headers.forEach(header => {
                        suggestions.push({
                            label: header,
                            kind: CompletionItemKind.Reference, // Or Text, Constant, etc.
                            insertText: header,
                            range: monaco.Range.fromPositions(position, position), // Insert at cursor
                            detail: `header in ${targetNote.name}`,
                        });
                    });
                }
            }
        }
        // Case 4: Triggered by typing after # in [[NoteName#headerPart
        else if (textBeforeCursor.includes('#')) {
            const headerLinkMatch = textBeforeCursor.match(/\[\[([^#|\]]+)#([^\]]*)$/);
            if (headerLinkMatch) {
                const noteNameForHeader = headerLinkMatch[1];
                const currentTypedHeader = headerLinkMatch[2];
                const targetNotes = this.wikilinkService.findTargetNotes(noteNameForHeader);
                if (targetNotes.length > 0) {
                    const targetNote = targetNotes[0];
                    targetNote.headers.forEach(header => {
                        if (header.toLowerCase().includes(currentTypedHeader.toLowerCase())) {
                            suggestions.push({
                                label: header,
                                kind: CompletionItemKind.Reference,
                                insertText: header,
                                range: monaco.Range.fromPositions(position.delta(0, -currentTypedHeader.length), position),
                                detail: `header in ${targetNote.name}`,
                            });
                        }
                    });
                }
            }
        }


        if (suggestions.length > 0) {
            return { suggestions };
        }
        return undefined;
    }
}
