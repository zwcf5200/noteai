import { Disposable } from '../../../../base/common/lifecycle';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures';
import { WikilinkCompletionProvider } from './wikilinkCompletionProvider';
import { IWikilinkService } from '../common/wikilinkService';
import { IVoidSettingsService } from '../common/voidSettingsService';

export class VoidLanguageFeaturesContribution extends Disposable implements IWorkbenchContribution {
    static readonly ID = 'workbench.contrib.voidLanguageFeatures';

    constructor(
        @IInstantiationService private readonly instantiationService: IInstantiationService,
        @ILanguageFeaturesService private readonly languageFeaturesService: ILanguageFeaturesService,
        @IWikilinkService private readonly wikilinkService: IWikilinkService,
        @IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
    ) {
        super();
        this.registerFeatures();
    }

    private registerFeatures(): void {
        // Register Wikilink Completion Provider
        const wikilinkCompletionProvider = new WikilinkCompletionProvider(this.wikilinkService, this.voidSettingsService);
        this._register(this.languageFeaturesService.completionProvider.register(
            { language: 'markdown', scheme: 'file' }, // Selector: for markdown files on disk
            wikilinkCompletionProvider
        ));
    }
}

registerWorkbenchContribution2(
    VoidLanguageFeaturesContribution.ID,
    VoidLanguageFeaturesContribution,
    WorkbenchPhase.Eventually // Register after services are typically ready
);
