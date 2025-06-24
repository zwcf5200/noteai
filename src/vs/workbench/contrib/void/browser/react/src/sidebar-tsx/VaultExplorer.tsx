import React from 'react';
import { useAccessor, useSettingsState } from '../util/services';
import { URI } from '../../../../../../../base/common/uri';

interface VaultExplorerProps {
	// vaultPath: string; // vaultPath will be read from settingsState
}

export const VaultExplorer: React.FC<VaultExplorerProps> = () => {
	const settingsState = useSettingsState();
	const { vaultPath } = settingsState.globalSettings;

	const accessor = useAccessor();
	const fileService = accessor.get('IFileService');
	const editorService = accessor.get('IEditorService');

	// Dummy file list for now
	const [files, setFiles] = React.useState<string[]>([]);

	React.useEffect(() => {
		if (vaultPath) {
			const resource = URI.file(vaultPath);
			fileService.resolve(resource).then(stat => {
				if (stat.children) {
					setFiles(stat.children.map(child => child.name));
				}
			}).catch(error => {
				console.error("Error resolving vault path:", error);
				setFiles([]);
			});
		} else {
			setFiles([]);
		}
	}, [vaultPath, fileService]);

	const handleFileClick = (fileName: string) => {
		if (vaultPath && fileName.endsWith('.md')) {
			const filePath = URI.joinPath(URI.file(vaultPath), fileName);
			editorService.openEditor({ resource: filePath });
		}
	};

	if (!vaultPath) {
		return (
			<div className="p-2 text-sm text-void-fg-3">
				No vault path configured. Please set it in Void Settings.
			</div>
		);
	}

import { Plus } from 'lucide-react';
import { IDialogService } from '../../../../../../../platform/dialogs/common/dialogs';

// ... (imports remain the same)

export const VaultExplorer: React.FC<VaultExplorerProps> = () => {
	const settingsState = useSettingsState();
	const { vaultPath } = settingsState.globalSettings;

	const accessor = useAccessor();
	const fileService = accessor.get('IFileService');
	const editorService = accessor.get('IEditorService');
	const dialogService = accessor.get('IDialogService'); // Get IDialogService

	// Dummy file list for now
	const [files, setFiles] = React.useState<string[]>([]);
	const [_, setForceUpdate] = React.useState(0); // To refresh file list after creation


	const refreshFiles = React.useCallback(() => {
		if (vaultPath) {
			const resource = URI.file(vaultPath);
			fileService.resolve(resource).then(stat => {
				if (stat.children) {
					setFiles(stat.children.map(child => child.name).sort());
				} else {
					setFiles([]);
				}
			}).catch(error => {
				console.error("Error resolving vault path:", error);
				setFiles([]);
			});
		} else {
			setFiles([]);
		}
	}, [vaultPath, fileService]);

	React.useEffect(() => {
		refreshFiles();
	}, [refreshFiles]);

	const handleFileClick = (fileName: string) => {
		if (vaultPath && fileName.endsWith('.md')) {
			const filePath = URI.joinPath(URI.file(vaultPath), fileName);
			editorService.openEditor({ resource: filePath });
		}
	};

	const handleNewNote = async () => {
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
				// Check if file already exists
				const exists = await fileService.exists(newFileUri);
				if (exists) {
					dialogService.error('File already exists.');
					return;
				}

				await fileService.createFile(newFileUri, undefined /* content */, { overwrite: false });
				editorService.openEditor({ resource: newFileUri });
				refreshFiles(); // Refresh file list
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
		<div className="p-2 flex-grow flex flex-col overflow-y-auto"> {/* Allow vertical scroll and take available space */}
			<div className="flex justify-between items-center mb-2">
				<div className="text-sm font-medium text-void-fg-1">Vault Explorer</div>
				<button
					onClick={handleNewNote}
					className="p-1 text-void-fg-3 hover:text-void-fg-1"
					title="New Note"
				>
					<Plus size={16} />
				</button>
			</div>
			<div className="text-xs text-void-fg-3 mb-1">Path: {vaultPath}</div>
			<div className="flex-grow overflow-y-auto"> {/* This div will scroll if content overflows */}
				{files.length > 0 ? (
					<ul>
					{files.map(file => (
						<li key={file}
							className="text-sm text-void-fg-2 hover:text-void-fg-1 cursor-pointer"
							onClick={() => handleFileClick(file)}
						>
							{file}
						</li>
					))}
				</ul>
			) : (
				<div className="text-sm text-void-fg-3">No files or folders in this vault.</div>
			)}
		</div>
	);
};
