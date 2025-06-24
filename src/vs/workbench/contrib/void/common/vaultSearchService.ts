import { URI } from '../../../../base/common/uri';
import { Disposable } from '../../../../base/common/lifecycle';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions';
import { IWikilinkService, INote } from './wikilinkService'; // To get all notes
import { IVoidModelService } from './voidModelService'; // To get content for searching
import { CancellationToken } from '../../../../base/common/cancellation';

export interface ISearchResult {
    uri: URI;
    label: string; // Filename
    // For later: snippets or line numbers of matches
    // snippet?: { text: string; matchRange: monaco.IRange }[];
}

export interface IVaultSearchService {
    readonly _serviceBrand: undefined;
    search(query: string, token?: CancellationToken): Promise<ISearchResult[]>;
}

export const IVaultSearchService = createDecorator<IVaultSearchService>('vaultSearchService');

class VaultSearchService extends Disposable implements IVaultSearchService {
    _serviceBrand: undefined;

    constructor(
        @IWikilinkService private readonly wikilinkService: IWikilinkService,
        @IVoidModelService private readonly voidModelService: IVoidModelService,
    ) {
        super();
    }

    async search(query: string, token?: CancellationToken): Promise<ISearchResult[]> {
        if (!query || query.trim().length < 1) { // Minimum query length, e.g., 1 char
            return [];
        }

        const lowerCaseQuery = query.toLowerCase();
        const results: ISearchResult[] = [];
        const notesMap = this.wikilinkService.getNotes(); // Get all known notes

        for (const [_, note] of notesMap) {
            if (token?.isCancellationRequested) {
                return results;
            }

            try {
                const { model } = await this.voidModelService.getModelSafe(note.uri);
                if (model) {
                    const content = model.getValue();
                    if (content.toLowerCase().includes(lowerCaseQuery)) {
                        results.push({
                            uri: note.uri,
                            label: note.uri.path.substring(note.uri.path.lastIndexOf('/') + 1),
                        });
                    }
                }
            } catch (error) {
                console.error(`VaultSearchService: Error reading content for ${note.uri.fsPath}`, error);
            }
        }

        // Sort results, e.g., alphabetically by label
        results.sort((a,b) => a.label.localeCompare(b.label));
        return results;
    }
}

registerSingleton(IVaultSearchService, VaultSearchService, InstantiationType.Delayed);
