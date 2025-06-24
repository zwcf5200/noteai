import { Action2, registerAction2, MenuId } from '../../../../platform/actions/common/actions';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry';
import { KeyMod, KeyCode } from '../../../../base/common/keyCodes';
import { IVoidSettingsService } from '../common/voidSettingsService';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs';
import { IFileService } from '../../../../platform/files/common/files';
import { IEditorService } from '../../../services/editor/common/editorService';
import { URI } from '../../../../base/common/uri';
import { IWikilinkService } from '../common/wikilinkService';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput';
import { IViewsService } from '../../../services/views/common/viewsService'; // To open/focus sidebar
import { VOID_VIEW_CONTAINER_ID } from './sidebarPane'; // Assuming this is where SearchPane is

// Helper to check if vault path is configured
function isVaultConfigured(accessor: ServicesAccessor): boolean {
    const voidSettingsService = accessor.get(IVoidSettingsService);
    return !!voidSettingsService.state.globalSettings.vaultPath;
}

// --- Command: Obsidian: New Note ---
class ObsidianNewNoteAction extends Action2 {
    static readonly ID = 'obsidian.newNote';
    static readonly LABEL = 'Obsidian: New Note';

    constructor() {
        super({
            id: ObsidianNewNoteAction.ID,
            title: { value: ObsidianNewNoteAction.LABEL, original: 'Obsidian: New Note' },
            f1: true, // Show in command palette
            // category: 'Obsidian', // Optional category
        });
    }

    async run(accessor: ServicesAccessor): Promise<void> {
        const dialogService = accessor.get(IDialogService);
        const fileService = accessor.get(IFileService);
        const editorService = accessor.get(IEditorService);
        const voidSettingsService = accessor.get(IVoidSettingsService);

        const vaultPath = voidSettingsService.state.globalSettings.vaultPath;
        if (!vaultPath) {
            dialogService.info('Please configure your Obsidian vault path in Void settings first.');
            return;
        }

        const result = await dialogService.prompt(
            [{ type: 'input', name: 'filename', message: 'Enter note name (e.g., My New Note):' }],
        );

        if (result && result.filename) {
            let newFileName = result.filename.trim();
            if (!newFileName.toLowerCase().endsWith('.md')) {
                newFileName += '.md';
            }
            newFileName = newFileName.replace(/[\\/:*?"<>|]/g, '-'); // Basic sanitization

            const newFileUri = URI.joinPath(URI.file(vaultPath), newFileName);

            try {
                if (await fileService.exists(newFileUri)) {
                    dialogService.error('File already exists.');
                    return;
                }
                await fileService.createFile(newFileUri);
                await editorService.openEditor({ resource: newFileUri });
                // Assuming VaultExplorer and WikilinkService will pick up the change
            } catch (error) {
                dialogService.error(`Failed to create note: ${error}`);
            }
        }
    }
}
registerAction2(ObsidianNewNoteAction);


// --- Command: Obsidian: Open Note ---
interface INoteQuickPickItem extends IQuickPickItem {
    uri: URI;
}
class ObsidianOpenNoteAction extends Action2 {
    static readonly ID = 'obsidian.openNote';
    static readonly LABEL = 'Obsidian: Open Note...';

    constructor() {
        super({
            id: ObsidianOpenNoteAction.ID,
            title: { value: ObsidianOpenNoteAction.LABEL, original: 'Obsidian: Open Note...' },
            f1: true,
        });
    }

    async run(accessor: ServicesAccessor): Promise<void> {
        if (!isVaultConfigured(accessor)) {
            accessor.get(IDialogService).info('Please configure your Obsidian vault path in Void settings first.');
            return;
        }

        const wikilinkService = accessor.get(IWikilinkService);
        const quickInputService = accessor.get(IQuickInputService);
        const editorService = accessor.get(IEditorService);

        const notes = Array.from(wikilinkService.getNotes().values());
        const items: INoteQuickPickItem[] = notes.map(note => ({
            label: note.uri.path.substring(note.uri.path.lastIndexOf('/') + 1), // filename
            description: note.uri.fsPath, // full path
            uri: note.uri,
        })).sort((a,b) => a.label.localeCompare(b.label));

        const picked = await quickInputService.pick(items, {
            canPickMany: false,
            placeHolder: 'Type to search for a note to open',
            matchOnDescription: true,
        });

        if (picked && picked.uri) {
            await editorService.openEditor({ resource: picked.uri });
        }
    }
}
registerAction2(ObsidianOpenNoteAction);


// --- Command: Obsidian: Search Notes (Focus Search Pane) ---
// This is a placeholder. Actually focusing the React input is more complex
// and might require a service/event bus for communication from command to React component.
// For now, it will just open the Void sidebar.
class ObsidianSearchNotesAction extends Action2 {
    static readonly ID = 'obsidian.searchNotes';
    static readonly LABEL = 'Obsidian: Search Notes in Vault';

    constructor() {
        super({
            id: ObsidianSearchNotesAction.ID,
            title: { value: ObsidianSearchNotesAction.LABEL, original: 'Obsidian: Search Notes in Vault' },
            f1: true,
        });
    }

    async run(accessor: ServicesAccessor): Promise<void> {
        if (!isVaultConfigured(accessor)) {
            accessor.get(IDialogService).info('Please configure your Obsidian vault path in Void settings first.');
            return;
        }

        const viewsService = accessor.get(IViewsService);
        // This opens the sidebar container. Focusing the specific input in SearchPane.tsx
        // from a command is non-trivial and would require additional mechanisms.
        await viewsService.openViewContainer(VOID_VIEW_CONTAINER_ID, true);
        // Ideally, we'd then send an event or call a service method that SearchPane.tsx listens to,
        // which would then focus its input field. This is out of scope for this simplified step.
        accessor.get(IDialogService).info('Void sidebar opened. Use the search input at the top.');
    }
}
registerAction2(ObsidianSearchNotesAction);
