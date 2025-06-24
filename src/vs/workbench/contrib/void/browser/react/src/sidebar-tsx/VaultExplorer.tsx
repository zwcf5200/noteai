import React from 'react';
import { useAccessor, useSettingsState } from '../util/services';
import { URI } from '../../../../../../../base/common/uri';
import { Plus } from 'lucide-react'; // Added in "Note Creation"
import { IDialogService } from '../../../../../../../platform/dialogs/common/dialogs'; // Added in "Note Creation"
import { IEditorService } from '../../../../../../workbench/services/editor/common/editorService'; // Assumed present
import { IFileService } from '../../../../../../../platform/files/common/files'; // Assumed present

interface VaultExplorerProps {
    // vaultPath will be read from settingsState
}

// This is the state *after* "Note Creation" step and *before* "Enhance Vault Explorer"
export const VaultExplorer: React.FC<VaultExplorerProps> = () => {
    const settingsState = useSettingsState();
    const { vaultPath } = settingsState.globalSettings;

    const accessor = useAccessor();
    const fileService = accessor.get(IFileService);
    const editorService = accessor.get(IEditorService);
    const dialogService = accessor.get(IDialogService);

import { FileTreeItem } from './FileTreeItem'; // Import the new component

    // Define FileTreeNode interface (or import if moved to a shared types file)
    // This interface is used by both VaultExplorer and FileTreeItem
export interface FileTreeNode { // Exporting so FileTreeItem can use it if not in a shared file
        name: string;
        uri: URI;
        isDirectory: boolean;
        children?: FileTreeNode[];
        isExpanded?: boolean;
    }
    const [rootNode, setRootNode] = React.useState<FileTreeNode | null>(null);

    // This function will be passed to FileTreeItem for on-demand loading
    const fetchChildrenForNode = async (parentNode: FileTreeNode): Promise<FileTreeNode[]> => {
        if (!parentNode.isDirectory) return [];
        try {
            const stat = await fileService.resolve(parentNode.uri);
            if (!stat.children) return [];

            const childrenPromises = stat.children.map(async (child): Promise<FileTreeNode | null> => {
                if (child.name.startsWith('.')) return null;
                return {
                    name: child.name,
                    uri: child.resource,
                    isDirectory: child.isDirectory,
                    isExpanded: false, // Children default to collapsed
                    // children: child.isDirectory ? [] : undefined // Initialize children for folders if needed for further expansion
                };
            });

            const resolvedChildren = (await Promise.all(childrenPromises))
                .filter((child): child is FileTreeNode => child !== null)
                .sort((a, b) => {
                    if (a.isDirectory && !b.isDirectory) return -1;
                    if (!a.isDirectory && b.isDirectory) return 1;
                    return a.name.localeCompare(b.name);
                });
            return resolvedChildren;
        } catch (error) {
            console.error(`Error fetching children for ${parentNode.name}:`, error);
            return [];
        }
    };

    const refreshFullFileTree = React.useCallback(async () => {
        if (vaultPath) {
            const resource = URI.file(vaultPath);
            // Fetch only the first level for the root initially
            const rootChildren = await fetchChildrenForNode({ name: "root", uri: resource, isDirectory: true });
            setRootNode({
                name: resource.fsPath.substring(resource.fsPath.lastIndexOf('/') + 1) || "Vault",
                uri: resource,
                isDirectory: true,
                children: rootChildren,
                isExpanded: true,
            });
        } else {
            setRootNode(null);
        }
    }, [vaultPath, fileService]); // fetchChildrenForNode is stable if fileService is

    React.useEffect(() => {
        refreshFullFileTree();
    }, [refreshFullFileTree]);

    const handleFileNodeClick = (node: FileTreeNode) => { // Renamed to avoid conflict
        if (!node.isDirectory && node.uri.fsPath.endsWith('.md')) {
            editorService.openEditor({ resource: node.uri });
        }
        // Folder expansion is handled within FileTreeItem
    };

    const handleNewNote = async () => { // Added in "Note Creation"
        if (!vaultPath) return;

        const result = await dialogService.prompt(
            [{
                type: 'input',
                name: 'filename',
                message: 'Enter note name (e.g., My New Note):',
            }],
        );

        if (result && result.filename) {
            let newFileName = result.filename.trim();
            if (!newFileName.toLowerCase().endsWith('.md')) {
                newFileName += '.md';
            }

            const newFileUri = URI.joinPath(URI.file(vaultPath), newFileName);

            try {
                const exists = await fileService.exists(newFileUri);
                if (exists) {
                    dialogService.error('File already exists.');
                    return;
                }

                await fileService.createFile(newFileUri, undefined, { overwrite: false });
                editorService.openEditor({ resource: newFileUri });
                refreshFiles();
            } catch (error) {
                console.error("Error creating new note:", error);
                dialogService.error(`Failed to create note: ${error}`);
            }
        }
    };

    if (!vaultPath) {
        return (
            <div className="p-2 text-sm text-void-fg-3">
                No vault path configured. Please set it in Void Settings.
            </div>
        );
    }

    return (
        // Layout classes added/modified in "Note Creation"
        <div className="p-2 flex-grow flex flex-col overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
                <div className="text-sm font-medium text-void-fg-1">Vault Explorer</div>
                <button // Added in "Note Creation"
                    onClick={handleNewNote}
                    className="p-1 text-void-fg-3 hover:text-void-fg-1"
                    title="New Note"
                >
                    <Plus size={16} />
                </button>
            </div>
            <div className="text-xs text-void-fg-3 mb-1">Path: {vaultPath}</div>
            <div className="flex-grow overflow-y-auto">
                {rootNode && rootNode.children && rootNode.children.length > 0 ? (
                    <ul>
                        {rootNode.children.map(node => (
                            <FileTreeItem
                                key={node.uri.toString()}
                                node={node}
                                level={0}
                                onFileClick={handleFileNodeClick}
                                fetchChildren={fetchChildrenForNode}
                                onTreeDataChange={refreshFullFileTree}
                            />
                        ))}
                    </ul>
                ) : (
                    <div className="text-sm text-void-fg-3">Vault is empty or could not be read.</div>
                )}
            </div>
        </div>
    );
};
