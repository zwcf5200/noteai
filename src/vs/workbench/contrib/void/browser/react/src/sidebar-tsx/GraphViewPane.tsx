import React, { useEffect, useState, useRef } from 'react';
import { useAccessor, useSettingsState } from '../util/services';
import { IWikilinkService, INote } from '../../../common/wikilinkService';
import { IEditorService } from '../../../../../../workbench/services/editor/common/editorService';
import { URI } from '../../../../../../../base/common/uri';

// Assume react-force-graph-2d is installed and can be imported
// In a real scenario: import ForceGraph2D from 'react-force-graph-2d';
// For now, we'll use a placeholder for the component if it's not available in the sandbox
// or define a type for its props if we were to mock it.
let ForceGraph2D: any = null;
try {
    // This dynamic import will likely fail in this sandbox environment
    // but represents how it might be loaded if available.
    // ForceGraph2D = (await import('react-force-graph-2d')).default;
    // For now, let's mock it or provide a placeholder.
    ForceGraph2D = ({ graphData, onNodeClick }: { graphData: any, width?: number, height?: number, onNodeClick?: (node: any) => void }) => {
        if (!graphData || !graphData.nodes || !graphData.links) {
            return <div>Preparing graph data...</div>;
        }
        return (
            <div style={{ border: '1px dashed #ccc', padding: '10px', textAlign: 'center' }}>
                <p>[Graph Placeholder]</p>
                <p>Nodes: {graphData.nodes.length}, Links: {graphData.links.length}</p>
                {graphData.nodes.map((node: any) => (
                    <div key={node.id} onClick={() => onNodeClick && onNodeClick(node)} style={{cursor: 'pointer'}}>
                        - {node.name || node.id}
                    </div>
                ))}
            </div>
        );
    };
} catch (e) {
    console.warn("react-force-graph-2d not available, using placeholder for GraphViewPane.", e);
    ForceGraph2D = ({ graphData, onNodeClick }: { graphData: any, width?: number, height?: number, onNodeClick?: (node: any) => void }) => (
        <div style={{ border: '1px dashed #ccc', padding: '10px', textAlign: 'center' }}>
            <p>[Graph Placeholder: react-force-graph-2d not loaded]</p>
            <p>Nodes: {graphData?.nodes?.length || 0}, Links: {graphData?.links?.length || 0}</p>
        </div>
    );
}


interface GraphData {
    nodes: { id: string; name: string; /* other properties like val, color */ }[];
    links: { source: string; target: string; /* other properties */ }[];
}

export const GraphViewPane: React.FC = () => {
    const accessor = useAccessor();
    const wikilinkService = accessor.get(IWikilinkService);
    const editorService = accessor.get(IEditorService);
    const settingsState = useSettingsState();
    const { vaultPath } = settingsState.globalSettings;

    const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const updateGraphData = () => {
            if (!vaultPath) {
                setGraphData({ nodes: [], links: [] });
                return;
            }

            const notesMap = wikilinkService.getNotes();
            const nodes: GraphData['nodes'] = [];
            const links: GraphData['links'] = [];
            const noteIdToNameMap = new Map<string, string>();

            notesMap.forEach(note => {
                const noteId = note.uri.toString();
                const noteName = note.uri.path.substring(note.uri.path.lastIndexOf('/') + 1).replace(/\.md$/, '');
                nodes.push({ id: noteId, name: noteName });
                noteIdToNameMap.set(noteId, note.name); // Store normalized name for link resolution
            });

            notesMap.forEach(sourceNote => {
                const sourceId = sourceNote.uri.toString();
                sourceNote.links.forEach(targetNoteNormalizedName => {
                    // Find the target note URI using the normalized name
                    // This assumes wikilinkService.resolveLink or a similar lookup on normalized names
                    let targetUri: URI | undefined = undefined;
                    for (const [_, potentialTargetNote] of notesMap) {
                        if (potentialTargetNote.name === targetNoteNormalizedName) { // note.name is normalized
                            targetUri = potentialTargetNote.uri;
                            break;
                        }
                    }

                    if (targetUri) {
                        const targetId = targetUri.toString();
                        // Ensure target node exists in our nodes list (it should if index is consistent)
                        if (nodes.find(n => n.id === targetId)) {
                             // Avoid duplicate links and self-links for basic graph
                            if (sourceId !== targetId && !links.some(l => (l.source === sourceId && l.target === targetId))) {
                                links.push({ source: sourceId, target: targetId });
                            }
                        }
                    }
                });
            });
            setGraphData({ nodes, links });
        };

        updateGraphData();
        const disposer = wikilinkService.onDidChangeIndex(updateGraphData);
        return () => disposer.dispose();
    }, [wikilinkService, vaultPath]);

    // Update dimensions for the graph
    useEffect(() => {
        if (containerRef.current) {
            setDimensions({
                width: containerRef.current.offsetWidth,
                height: containerRef.current.offsetHeight,
            });
        }
        const handleResize = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight,
                });
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [containerRef.current]);


    const handleNodeClick = (node: any /* Adjust type based on library */) => {
        if (node && node.id) {
            editorService.openEditor({ resource: URI.parse(node.id as string) });
        }
    };

    if (!vaultPath) {
        return null; // Don't show if no vault is configured
    }

    // Ensure ForceGraph2D is available before rendering
    if (!ForceGraph2D) {
        return <div className="p-2 text-sm text-void-fg-3">Graph library not loaded.</div>;
    }

    return (
        <div className="p-2 border-t border-void-border-1 flex-grow flex flex-col" ref={containerRef}>
            <div className="text-sm font-medium text-void-fg-1 mb-2">
                Graph View
            </div>
            <div className="flex-grow relative"> {/* Ensure graph takes available space */}
                {dimensions.width > 0 && dimensions.height > 0 && graphData.nodes.length > 0 && (
                    <ForceGraph2D
                        graphData={graphData}
                        width={dimensions.width}
                        height={dimensions.height}
                        nodeLabel="name"
                        nodeAutoColorBy="id" // Example: color by id or group
                        linkDirectionalParticles={1}
                        linkDirectionalParticleWidth={1.5}
                        onNodeClick={handleNodeClick}
                        // Consider adding more props for customization:
                        // nodeRelSize={...}
                        // linkWidth={...}
                        // dagMode="td" // if it's a DAG
                    />
                )}
                {graphData.nodes.length === 0 && vaultPath && (
                     <div className="text-sm text-void-fg-3">No notes or links to display in graph.</div>
                )}
            </div>
        </div>
    );
};
