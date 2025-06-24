import React, { useEffect, useState } from 'react';
import { useAccessor, useSettingsState } from '../util/services';
import { IEditorService } from '../../../../../../workbench/services/editor/common/editorService';
import { IWikilinkService, INote } from '../../../common/wikilinkService';
import { URI } from '../../../../../../../base/common/uri';
import { IFileService } from '../../../../../../../platform/files/common/files'; // Only if needed for file icons or extra info

export const BacklinksPanel: React.FC = () => {
    const accessor = useAccessor();
    const editorService = accessor.get(IEditorService);
    const wikilinkService = accessor.get(IWikilinkService);
    const settingsState = useSettingsState();
    const { vaultPath } = settingsState.globalSettings;

    const [activeFileUri, setActiveFileUri] = useState<URI | null>(null);
    const [backlinks, setBacklinks] = useState<INote[]>([]);

    useEffect(() => {
        const updateActiveFile = () => {
            const activeEditorPane = editorService.activeEditorPane;
            const resource = activeEditorPane?.input?.resource;
            if (resource && vaultPath && resource.fsPath.startsWith(vaultPath) && resource.fsPath.endsWith('.md')) {
                setActiveFileUri(resource);
            } else {
                setActiveFileUri(null);
            }
        };

        updateActiveFile(); // Initial check
        const disposer = editorService.onDidActiveEditorChange(updateActiveFile);
        return () => disposer.dispose();
    }, [editorService, vaultPath]);

    useEffect(() => {
        if (activeFileUri) {
            setBacklinks(wikilinkService.getBacklinks(activeFileUri));
        } else {
            setBacklinks([]);
        }

        // Listen to index changes to update backlinks
        const disposer = wikilinkService.onDidChangeIndex(() => {
            if (activeFileUri) {
                setBacklinks(wikilinkService.getBacklinks(activeFileUri));
            } else {
                setBacklinks([]);
            }
        });
        return () => disposer.dispose();
    }, [activeFileUri, wikilinkService]);

    const handleBacklinkClick = (note: INote) => {
        editorService.openEditor({ resource: note.uri });
    };

    if (!vaultPath) {
        return null; // Don't show if no vault is configured
    }

    if (!activeFileUri) {
        return (
            <div className="p-2 text-xs text-void-fg-3">
                Open a note in the vault to see its backlinks.
            </div>
        );
    }

    return (
        <div className="p-2 border-t border-void-border-1">
            <div className="text-sm font-medium text-void-fg-1 mb-2">
                Backlinks for {activeFileUri.fsPath.substring(activeFileUri.fsPath.lastIndexOf('/') + 1)}
            </div>
            {backlinks.length > 0 ? (
                <ul>
                    {backlinks.map(note => (
                        <li key={note.uri.toString()}
                            className="text-sm text-void-fg-2 hover:text-void-fg-1 cursor-pointer truncate"
                            onClick={() => handleBacklinkClick(note)}
                            title={note.uri.fsPath}
                        >
                            {note.name}
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="text-sm text-void-fg-3">No backlinks found.</div>
            )}
        </div>
    );
};
