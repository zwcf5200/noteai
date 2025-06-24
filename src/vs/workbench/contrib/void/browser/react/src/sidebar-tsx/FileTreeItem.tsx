import React, { useState, useCallback } from 'react';
import { URI } from '../../../../../../../base/common/uri';
// No need to import IFileService here if only fetchChildren uses it and it's passed from parent
import { useAccessor } from '../util/services'; // Still needed if FileTreeItem itself calls services
import { FileTreeNode } from './VaultExplorer'; // Import the shared interface
import { IContextMenuService } from '../../../../../../../platform/contextview/browser/contextView';
import { Action } from '../../../../../../../base/common/actions';
import { IDialogService } from '../../../../../../../platform/dialogs/common/dialogs';
import { IFileService } from '../../../../../../../platform/files/common/files';
import { IEditorService } from '../../../../../../workbench/services/editor/common/editorService';

interface FileTreeItemProps {
    node: FileTreeNode;
    level: number; // For indentation
    onFileClick: (node: FileTreeNode) => void;
    fetchChildren?: (parentNode: FileTreeNode) => Promise<FileTreeNode[]>;
    // Callback to inform parent about data changes so it can refresh the tree
    onTreeDataChange: () => void;
}

export const FileTreeItem: React.FC<FileTreeItemProps> = ({ node, level, onFileClick, fetchChildren, onTreeDataChange }) => {
    const [isExpanded, setIsExpanded] = useState(node.isExpanded || false);
    const [children, setChildren] = useState<FileTreeNode[] | undefined>(node.children);
    const [isLoadingChildren, setIsLoadingChildren] = useState(false);

    const accessor = useAccessor();
    const contextMenuService = accessor.get(IContextMenuService);
    const dialogService = accessor.get(IDialogService);
    const fileService = accessor.get(IFileService);
    const editorService = accessor.get(IEditorService);


    const handleToggleExpand = async () => {
        if (!node.isDirectory) return;

        const newExpandedState = !isExpanded;
        setIsExpanded(newExpandedState);

        if (newExpandedState && !children && fetchChildren) { // Load children on demand
            setIsLoadingChildren(true);
            try {
                const fetchedChildren = await fetchChildren(node);
                setChildren(fetchedChildren);
            } catch (error) {
                console.error("Error fetching children for", node.name, error);
                // Potentially set an error state on the node
            } finally {
                setIsLoadingChildren(false);
            }
        }
    };

    const itemStyle = {
        paddingLeft: `${level * 16}px`, // Indentation based on level
    };

    const handleContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        const actions: Action[] = [];
        const targetDirectory = node.isDirectory ? node.uri : URI.parse(node.uri.path.substring(0, node.uri.path.lastIndexOf('/')));

        actions.push(new Action('void.newNote', 'New Note', undefined, true, async () => {
            const result = await dialogService.prompt([{ type: 'input', name: 'filename', message: 'Enter note name:' }]);
            if (result && result.filename) {
                let newFileName = result.filename.trim();
                if (!newFileName.toLowerCase().endsWith('.md')) newFileName += '.md';
                const newFileUri = URI.joinPath(targetDirectory, newFileName);
                try {
                    if (await fileService.exists(newFileUri)) {
                        dialogService.error('File already exists.'); return;
                    }
                    await fileService.createFile(newFileUri);
                    editorService.openEditor({ resource: newFileUri });
                    onTreeDataChange();
                } catch (e) { dialogService.error(`Failed to create note: ${e}`); }
            }
        }));

        if (node.isDirectory) {
            actions.push(new Action('void.newFolder', 'New Folder', undefined, true, async () => {
                const result = await dialogService.prompt([{ type: 'input', name: 'foldername', message: 'Enter folder name:' }]);
                if (result && result.foldername) {
                    const newFolderUri = URI.joinPath(node.uri, result.foldername.trim());
                    try {
                        if (await fileService.exists(newFolderUri)) {
                             dialogService.error('Folder already exists.'); return;
                        }
                        await fileService.createFolder(newFolderUri);
                        onTreeDataChange();
                    } catch (e) { dialogService.error(`Failed to create folder: ${e}`); }
                }
            }));
        }

        actions.push(new Action('void.rename', 'Rename', undefined, true, async () => {
            const result = await dialogService.prompt([{ type: 'input', name: 'newname', message: 'Enter new name:', initialValue: node.name }]);
            if (result && result.newname && result.newname.trim() !== node.name) {
                const newName = result.newname.trim();
                const newUri = URI.joinPath(targetDirectory, newName);
                try {
                     if (await fileService.exists(newUri)) {
                        dialogService.error('A file or folder with this name already exists.'); return;
                    }
                    await fileService.move(node.uri, newUri, true);
                    onTreeDataChange();
                } catch (e) { dialogService.error(`Failed to rename: ${e}`); }
            }
        }));

        actions.push(new Action('void.delete', 'Delete', undefined, true, async () => {
            const confirmation = await dialogService.confirm({
                message: `Are you sure you want to delete '${node.name}'?`,
                type: 'warning',
                primaryButton: 'Delete'
            });
            if (confirmation.confirmed) {
                try {
                    await fileService.del(node.uri, { recursive: true });
                    onTreeDataChange();
                } catch (e) { dialogService.error(`Failed to delete: ${e}`); }
            }
        }));

        contextMenuService.showContextMenu({
            getAnchor: () => ({ x: event.clientX, y: event.clientY }),
            getActions: () => actions,
            onHide: () => { actions.forEach(a => a.dispose()); } // Important to dispose actions
        });
    };

    return (
        <li>
            <div
                className="flex items-center text-sm text-void-fg-2 hover:bg-void-bg-hover cursor-pointer py-0.5"
                style={itemStyle}
                onClick={node.isDirectory ? handleToggleExpand : () => onFileClick(node)}
                onContextMenu={handleContextMenu}
                title={node.uri.fsPath}
            >
                {node.isDirectory && (
                    <span className="w-4 inline-block mr-1">
                        {isLoadingChildren ? '⏳' : (isExpanded ? '▼' : '▶')}
                    </span>
                )}
                {!node.isDirectory && (
                    <span className="w-4 inline-block mr-1"></span> // Placeholder for alignment
                )}
                <span>{node.isDirectory ? '📁' : '📄'}</span>
                <span className="ml-1 truncate">{node.name}</span>
            </div>
            {node.isDirectory && isExpanded && children && (
                <ul>
                    {children.map(childNode => (
                        <FileTreeItem
                            key={childNode.uri.toString()}
                            node={childNode}
                            level={level + 1}
                            onFileClick={onFileClick}
                            fetchChildren={fetchChildren}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
};
