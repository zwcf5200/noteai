import React, { useEffect, useState } from 'react';
import { useAccessor, useSettingsState } from '../util/services';
import { ITagService, ITagInfo } from '../../../common/tagService';
import { URI } from '../../../../../../../base/common/uri';
import { IEditorService } from '../../../../../../workbench/services/editor/common/editorService'; // For future click handling

export const TagPane: React.FC = () => {
    const accessor = useAccessor();
    const tagService = accessor.get(ITagService);
    const editorService = accessor.get(IEditorService);
    const quickInputService = accessor.get('IQuickInputService');
    const settingsState = useSettingsState();
    const { vaultPath } = settingsState.globalSettings;

    const [tags, setTags] = useState<ReadonlyMap<string, ITagInfo>>(new Map());

    useEffect(() => {
        if (!vaultPath) {
            setTags(new Map()); // Clear tags if no vault path
            return;
        }

        const updateTags = () => {
            setTags(tagService.getAllTags());
        };

        updateTags(); // Initial fetch
        const disposer = tagService.onDidChangeIndex(updateTags);
        return () => disposer.dispose();
    }, [tagService, vaultPath]);

    const handleTagClick = (tagInfo: ITagInfo) => {
        if (tagInfo.notes.length === 0) return;

        const items = tagInfo.notes.map(uri => {
            const fileName = uri.path.substring(uri.path.lastIndexOf('/') + 1);
            return {
                label: fileName,
                description: uri.fsPath, // Show full path as description
                uri: uri,
            };
        });

        const picked = await quickInputService.pick(items, {
            canPickMany: false,
            placeHolder: `Notes tagged with #${tagInfo.name}`,
        });

        if (picked && picked.uri) {
            editorService.openEditor({ resource: picked.uri });
        }
    };

    if (!vaultPath) {
        return null; // Don't show if no vault is configured
    }

    const tagArray = Array.from(tags.values());

    return (
        <div className="p-2 border-t border-void-border-1">
            <div className="text-sm font-medium text-void-fg-1 mb-2">
                Tags
            </div>
            {tagArray.length > 0 ? (
                <ul className="flex flex-wrap gap-1">
                    {tagArray.map(tagInfo => (
                        <li key={tagInfo.name}
                            className="text-xs text-void-fg-link hover:text-void-fg-link-hover bg-void-bg-code-block px-2 py-0.5 rounded-sm cursor-pointer"
                            onClick={() => handleTagClick(tagInfo)}
                            title={`${tagInfo.count} note(s)`}
                        >
                            #{tagInfo.name} ({tagInfo.count})
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="text-sm text-void-fg-3">No tags found in vault.</div>
            )}
        </div>
    );
};
