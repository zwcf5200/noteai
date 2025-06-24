import React, { useEffect, useState, useRef } from 'react';
import { useAccessor, useSettingsState } from '../util/services';
import { IEditorService } from '../../../../../../workbench/services/editor/common/editorService';
import { ITextModel } from '../../../../../../../editor/common/model';
import { URI } from '../../../../../../../base/common/uri';
import { IInstantiationService } from '../../../../../../../platform/instantiation/common/instantiation';
import { IMarkdownContributionProvider } from '../../../../../markdown-language-features/common/markdownContributionProvider'; // Path needs verification
import { Slugifier } from '../../../../../markdown-language-features/common/slugify'; // Path needs verification
import { ILogger, NullLogger } from '../../../../../../../platform/log/common/log'; // Use NullLogger or a real one
// Attempt to import MarkdownItEngine - path might need adjustment or direct instantiation/service access
// This direct import might be problematic due to VS Code's loader and module structure.
// A service providing access to the engine would be cleaner.
// For now, let's assume we can get it or we might need to simplify the rendering for phase 1.
// import { MarkdownItEngine } from '../../../../../markdown-language-features/browser/markdownEngine';
// ^^ This path is for browser, but engine is in common. Let's try:
// import { MarkdownItEngine } from '../../../../../markdown-language-features/common/markdownEngine';
// If direct import is too complex, we might need to pass HTML from a service or use a simpler parser initially.

// Placeholder for MarkdownItEngine if direct import/instantiation is tricky in this step
let MarkdownItEngineInstance: any = null;

interface MarkdownPreviewPaneProps {
    // Props if any, e.g., for controlling its visibility or specific document URI
}

interface MarkdownPreviewPaneProps {
    // Props if any, e.g., for controlling its visibility or specific document URI
    editorScrollLine?: number; // Line number from the editor's top visible range
}

export const MarkdownPreviewPane: React.FC<MarkdownPreviewPaneProps> = ({ editorScrollLine }) => {
    const accessor = useAccessor();
    const editorService = accessor.get(IEditorService);
    // const instantiationService = accessor.get(IInstantiationService); // Not used if commandService is used directly
    const settingsState = useSettingsState();
    const { vaultPath } = settingsState.globalSettings;

    const [htmlContent, setHtmlContent] = useState<string>('');
    const [activeEditorModel, setActiveEditorModel] = useState<ITextModel | null>(null);
    const currentContentRef = useRef<string>('');
    const previewContainerRef = useRef<HTMLDivElement>(null); // Ref for the preview container

    // Attempt to get or create a MarkdownItEngine instance
    const commandService = accessor.get('ICommandService');
    const wikilinkService = accessor.get('IWikilinkService'); // To resolve wikilinks

    // No need for MarkdownItEngineInstance state anymore if using command
    // useEffect(() => {
    //     if (!MarkdownItEngineInstance) {
    //         try {
    //             console.warn("MarkdownItEngine could not be instantiated directly for custom preview. Rendering will be basic.");
    //         } catch (e) {
    //             console.error("Failed to instantiate MarkdownItEngine:", e);
    //         }
    //     }
    // }, [instantiationService]);

    const processHtmlForWikilinks = (html: string, noteUri: URI): string => {
        // Regex to find [[Link Text]] or [[Link Text|Alias]] in the HTML output
        // This is a simplified regex and might need to be more robust,
        // especially if the Markdown parser escapes characters within the link text.
        // It assumes the Markdown parser outputs the raw [[...]] text or something very close.
        const wikilinkRegex = /\[\[([^\]#|]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;

        return html.replace(wikilinkRegex, (match, linkTarget, _headerMarker, headerContent, alias) => {
            const targetNoteName = linkTarget.trim();
            const targetHeader = headerContent ? headerContent.trim() : undefined;
            const displayText = alias ? alias.trim() : (targetHeader ? `${targetNoteName}#${targetHeader}` : targetNoteName);

            const resolvedUri = wikilinkService.resolveLink(noteUri, targetNoteName); // Assumes resolveLink takes note name

            if (resolvedUri) {
                // Create a clickable link. Data attributes will be used to handle click.
                // The href is kept minimal to avoid accidental navigation if webview security allows it.
                return `<a href="#" class="void-wikilink-preview" data-target-note="${resolvedUri.toString()}" data-target-header="${targetHeader || ''}">${displayText}</a>`;
            } else {
                // Render as plain text or a different style for broken links
                return `<span class="void-broken-wikilink-preview">${displayText}</span>`;
            }
        });
    };


    useEffect(() => {
        const updateActiveEditor = () => {
            const activeEditorPane = editorService.activeEditorPane;
            const resource = activeEditorPane?.input?.resource;
            if (resource && vaultPath && resource.fsPath.startsWith(vaultPath) && resource.fsPath.endsWith('.md')) {
                const model = editorService.getModel(resource) as ITextModel | null; // Type assertion
                setActiveEditorModel(model);
            } else {
                setActiveEditorModel(null);
            }
        };

        updateActiveEditor();
        const disposer = editorService.onDidActiveEditorChange(updateActiveEditor);
        return () => disposer.dispose();
    }, [editorService, vaultPath]);

    // Effect for scrolling the preview when editorScrollLine changes
    useEffect(() => {
        if (previewContainerRef.current && editorScrollLine !== undefined) {
            // Attempt to find the element with the corresponding data-line
            // This assumes 'markdown.api.render' adds 'data-line' attributes.
            const targetElement = previewContainerRef.current.querySelector(`[data-line="${editorScrollLine}"]`) as HTMLElement;
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                // Fallback: scroll to a percentage if data-line not found or not precise enough
                // This is a rough approximation.
                // const totalHeight = previewContainerRef.current.scrollHeight;
                // const modelLineCount = activeEditorModel?.getLineCount() || 1;
                // const percentage = editorScrollLine / modelLineCount;
                // previewContainerRef.current.scrollTop = totalHeight * percentage;
            }
        }
    }, [editorScrollLine, htmlContent]); // Re-run if htmlContent changes, as elements might reappear


    useEffect(() => {
        if (!activeEditorModel) {
            setHtmlContent('');
            currentContentRef.current = '';
            return;
        }

        const renderMarkdown = async () => {
            const newContent = activeEditorModel.getValue(); // Get full content
            if (newContent === currentContentRef.current && htmlContent !== '') { // Only re-render if content changed, unless html is empty (initial load)
                return;
            }
            currentContentRef.current = newContent;

            try {
                // Use 'markdown.api.render' command
                // The command might take the full document text or URI. Let's assume URI.
                const result = await commandService.executeCommand<{ html: string }>('markdown.api.render', activeEditorModel.uri);
                if (result && typeof result.html === 'string') {
                    const processedHtml = processHtmlForWikilinks(result.html, activeEditorModel.uri);
                    setHtmlContent(processedHtml);
                } else {
                    throw new Error('markdown.api.render did not return expected HTML string.');
                }
            } catch (e) {
                console.error("Error rendering markdown via command:", e);
                // Fallback to basic rendering if command fails
                const basicHtml = newContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')
                                      .replace(/\n/g, '<br/>')
                                      .replace(/^# (.+)/gm, '<h1>$1</h1>')
                                      .replace(/^## (.+)/gm, '<h2>$1</h2>');
                setHtmlContent(`<div style="font-family: sans-serif; white-space: pre-wrap;">${basicHtml}</div>`);
            }
        };

        renderMarkdown(); // Initial render
        const contentChangeDisposer = activeEditorModel.onDidChangeContent(renderMarkdown);

        return () => {
            contentChangeDisposer.dispose();
        };
    }, [activeEditorModel]);


    if (!vaultPath) {
        return null;
    }

    if (!activeEditorModel) {
        return <div className="p-2 text-sm text-void-fg-3">Open a Markdown note from your vault to see the preview.</div>;
    }

    // Using dangerouslySetInnerHTML for HTML from Markdown engine.
    // Ensure the Markdown engine sanitizes its output if it comes from untrusted sources.
    // VS Code's engine should be safe.
    return (
        <div className="p-2 border-t border-void-border-1 flex-grow flex flex-col overflow-y-auto">
            <div className="text-sm font-medium text-void-fg-1 mb-2">
                Live Preview
            </div>
            <div
                ref={previewContainerRef} // Assign ref here
                className="markdown-body p-2 flex-grow overflow-y-auto" /* Add 'markdown-body' for potential VSCode styling */
                style={{ fontFamily: 'var(--vscode-editor-font-family)', fontSize: 'var(--vscode-editor-font-size)' }}
                dangerouslySetInnerHTML={{ __html: htmlContent }}
                onClick={(e) => { // Handle clicks on wikilinks in preview
                    let target = e.target as HTMLElement;
                    while (target && target !== previewContainerRef.current) {
                        if (target.classList.contains('void-wikilink-preview')) {
                            const targetNoteUriStr = target.dataset.targetNote;
                            // const targetHeader = target.dataset.targetHeader; // For future header navigation
                            if (targetNoteUriStr) {
                                const targetUri = URI.parse(targetNoteUriStr);
                                editorService.openEditor({ resource: targetUri }).then(openedEditor => {
                                    // TODO: Implement scrolling to header if targetHeader is present
                                });
                                e.preventDefault();
                                return;
                            }
                        }
                        target = target.parentElement as HTMLElement;
                    }
                }}
            />
        </div>
    );
};
