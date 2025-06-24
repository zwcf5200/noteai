/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useIsDark } from '../util/services.js';
// import { SidebarThreadSelector } from './SidebarThreadSelector.js';
// import { SidebarChat } from './SidebarChat.js';

import React, { useState, useEffect, useCallback } from 'react'; // Added useState, useEffect, useCallback
import '../styles.css'
import { SidebarChat } from './SidebarChat.js';
import ErrorBoundary from './ErrorBoundary.js';
import { VaultExplorer } from './VaultExplorer.js';
import { BacklinksPanel } from './BacklinksPanel.js';
import { TagPane } from './TagPane.js';
import { SearchPane } from './SearchPane.js';
import { GraphViewPane } from './GraphViewPane.js';
import { MarkdownPreviewPane } from './preview-tsx/MarkdownPreviewPane.js'; // Import Preview Pane
import { useSettingsState, useAccessor } from '../util/services.js';
import { IEditorService } from '../../../../../../workbench/services/editor/common/editorService.js';
import { ICodeEditor } from '../../../../../../../editor/browser/editorBrowser.js';
import { IDisposable, DisposableStore } from '../../../../../../../base/common/lifecycle.js';


export const Sidebar = ({ className }: { className: string }) => {
	const isDark = useIsDark();
	const settingsState = useSettingsState();
	const accessor = useAccessor();
	const editorService = accessor.get(IEditorService);
	const { vaultPath } = settingsState.globalSettings;

	const [currentEditorScrollLine, setCurrentEditorScrollLine] = useState<number | undefined>(undefined);
	const editorScrollListener = useRef<IDisposable | null>(null);
	const disposables = useRef(new DisposableStore()).current;

	const setupEditorScrollListener = useCallback(() => {
		disposables.clear(); // Clear previous listeners

		const activeEditorPane = editorService.activeEditorPane;
		const editorControl = activeEditorPane?.getControl() as ICodeEditor | undefined;

		if (editorControl && editorControl.getEditorType() === 'vs.editor.ICodeEditor') {
			const updateScrollLine = () => {
				const visibleRanges = editorControl.getVisibleRanges();
				if (visibleRanges.length > 0) {
					setCurrentEditorScrollLine(visibleRanges[0].startLineNumber);
				}
			};

			editorScrollListener.current = editorControl.onDidScrollChange(updateScrollLine);
			disposables.add(editorScrollListener.current);
			updateScrollLine(); // Initial update
		} else {
			setCurrentEditorScrollLine(undefined);
		}
	}, [editorService, disposables]);

	useEffect(() => {
		setupEditorScrollListener();
		const activeEditorChangeListener = editorService.onDidActiveEditorChange(setupEditorScrollListener);
		disposables.add(activeEditorChangeListener);

		return () => {
			disposables.clear(); // Clear all disposables on unmount
		};
	}, [editorService, setupEditorScrollListener, disposables]);


	return <div
		className={`@@void-scope ${isDark ? 'dark' : ''}`}
		style={{ width: '100%', height: '100%' }}
	>
		<div
			// default background + text styles for sidebar
			className={`
				w-full h-full
				bg-void-bg-2
				text-void-fg-1
				flex flex-col overflow-hidden
			`}
		>
			{vaultPath ? (
				<>
					<ErrorBoundary>
						<SearchPane />
					</ErrorBoundary>
					<ErrorBoundary>
						<VaultExplorer />
					</ErrorBoundary>
					<ErrorBoundary>
						<BacklinksPanel />
					</ErrorBoundary>
					<ErrorBoundary>
						<TagPane />
					</ErrorBoundary>
					<ErrorBoundary>
						<GraphViewPane />
					</ErrorBoundary>
					<ErrorBoundary>
						<MarkdownPreviewPane editorScrollLine={currentEditorScrollLine} />
					</ErrorBoundary>
				</>
			) : (
				<ErrorBoundary>
					<SidebarChat />
				</ErrorBoundary>
			)}
		</div>
	</div>
}

