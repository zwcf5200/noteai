import React, { useState, useCallback } from 'react';
import { useAccessor, useSettingsState } from '../util/services';
import { IVaultSearchService, ISearchResult } from '../../../common/vaultSearchService';
import { IEditorService } from '../../../../../../workbench/services/editor/common/editorService';
import { URI } from '../../../../../../../base/common/uri';
import { CancellationTokenSource } from '../../../../../../../base/common/cancellation';
import { debounce } from '../../../../../../../base/common/decorators'; // Assuming debounce decorator exists or a utility function

export const SearchPane: React.FC = () => {
    const accessor = useAccessor();
    const vaultSearchService = accessor.get(IVaultSearchService);
    const editorService = accessor.get(IEditorService);
    const settingsState = useSettingsState();
    const { vaultPath } = settingsState.globalSettings;

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ISearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [cancellationTokenSource, setCancellationTokenSource] = useState<CancellationTokenSource | null>(null);

    // Debounce search function
    const performSearch = useCallback(async (currentQuery: string) => {
        if (cancellationTokenSource) {
            cancellationTokenSource.cancel();
        }

        if (!currentQuery.trim() || currentQuery.trim().length < 1) { // Min query length
            setResults([]);
            setIsLoading(false);
            return;
        }

        const newCts = new CancellationTokenSource();
        setCancellationTokenSource(newCts);
        setIsLoading(true);

        try {
            const searchResults = await vaultSearchService.search(currentQuery, newCts.token);
            if (!newCts.token.isCancellationRequested) {
                setResults(searchResults);
            }
        } catch (error) {
            if (!newCts.token.isCancellationRequested) {
                console.error("Error performing search:", error);
                setResults([]); // Clear results on error
            }
        } finally {
            if (!newCts.token.isCancellationRequested) {
                setIsLoading(false);
            }
            if (cancellationTokenSource === newCts) { // Clean up if this is the most recent CTS
                setCancellationTokenSource(null);
            }
        }
    }, [vaultSearchService, cancellationTokenSource]);

    // Using a simpler debounce utility function approach if decorator is not straightforward
    const debouncedSearchRef = React.useRef<(q: string) => void>();
    useEffect(() => {
        // Simple debounce function
        function debounceUtility<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
            let timeoutId: any;
            return (...args: Parameters<T>) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func(...args);
                }, delay);
            };
        }
        debouncedSearchRef.current = debounceUtility(performSearch, 300);
    }, [performSearch]);


    const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newQuery = event.target.value;
        setQuery(newQuery);
        if (debouncedSearchRef.current) {
            debouncedSearchRef.current(newQuery);
        }
    };

    const handleResultClick = (result: ISearchResult) => {
        editorService.openEditor({ resource: result.uri });
    };

    if (!vaultPath) {
        return null; // Don't show if no vault is configured
    }

    return (
        <div className="p-2 border-t border-void-border-1">
            <div className="text-sm font-medium text-void-fg-1 mb-2">
                Search Vault
            </div>
            <input
                type="text"
                placeholder="Type to search..."
                value={query}
                onChange={handleQueryChange}
                className="w-full p-1 mb-2 bg-void-bg-input text-void-fg-1 border border-void-border-1 rounded-sm focus:border-void-border-focus"
            />
            {isLoading && <div className="text-sm text-void-fg-3">Searching...</div>}
            {!isLoading && results.length === 0 && query.trim().length > 0 && (
                <div className="text-sm text-void-fg-3">No results found.</div>
            )}
            {results.length > 0 && (
                <ul className="max-h-60 overflow-y-auto"> {/* Limit height and allow scroll */}
                    {results.map(result => (
                        <li
                            key={result.uri.toString()}
                            className="p-1 text-sm text-void-fg-2 hover:text-void-fg-1 hover:bg-void-bg-hover cursor-pointer truncate"
                            onClick={() => handleResultClick(result)}
                            title={result.uri.fsPath}
                        >
                            {result.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
