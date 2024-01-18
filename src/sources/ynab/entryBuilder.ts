import { Account, Category, CategoryGroup, TransactionDetail, utils } from 'ynab';
import { DedupLogger } from '../../logging';
import { SplitGroup } from '../../types';
import { normalizeAccountName, validateAccountName } from '../../utils';

export class YNABEntryBuilder {
    protected transactionLookup: (id: string) => TransactionDetail;
    protected accountLookup: (id: string) => Account;
    protected categoryLookup: (id: string) => Category;
    protected categoryGroupLookup: (id: string) => CategoryGroup;
    protected dedupLogger: DedupLogger;

    constructor(
        transactionsLookup: ((id: string) => TransactionDetail),
        accountLookup: ((id: string) => Account),
        categoryLookup: ((id: string) => Category),
        categoryGroupLookup: ((id: string) => CategoryGroup),
        loggerKey: string
    ) {
        this.transactionLookup = transactionsLookup;
        this.accountLookup = accountLookup;
        this.categoryLookup = categoryLookup;
        this.categoryGroupLookup = categoryGroupLookup;
        this.dedupLogger = new DedupLogger(loggerKey);
    }

    protected getCategoryGroup(category: Category): CategoryGroup {
        if(!category) { return null }
        if (category.hidden) {
            const originalGroup = this.categoryGroupLookup(category.original_category_group_id);
            if (originalGroup) {
                return originalGroup;
            }
        }
        return this.categoryGroupLookup(category.category_group_id);
    }

    protected getAccountSplitGroup(account: Account): SplitGroup {
        switch (account.type) {
            case Account.TypeEnum.CreditCard:
            case Account.TypeEnum.LineOfCredit:
            case Account.TypeEnum.Mortgage:
            case Account.TypeEnum.OtherLiability:
                return SplitGroup.Liabilities;
            default:
                return SplitGroup.Assets;
        }
    }

    protected getAccountAccountName(account: Account): string {

        const accountName = (() => {
            switch (account.type) {
                case Account.TypeEnum.CreditCard:
                case Account.TypeEnum.LineOfCredit:
                    return `Credit:${account.name}`;
                case Account.TypeEnum.Mortgage:
                    return `Mortgage:${account.name}`;
                case Account.TypeEnum.OtherLiability:
                case Account.TypeEnum.OtherAsset:
                case Account.TypeEnum.Cash:
                case Account.TypeEnum.PayPal:
                    return `Other:${account.name}`;
                case Account.TypeEnum.Checking:
                    return `Checking:${account.name}`;
                case Account.TypeEnum.Savings:
                    return `Savings:${account.name}`;
                case Account.TypeEnum.InvestmentAccount:
                case Account.TypeEnum.MerchantAccount:
                    return `Investment:${account.name}`;
                default:
                    return account.name;
            }
        })();

        return this.validateAndNormalizeAccountName(accountName);
    }

    protected validateAndNormalizeAccountName(accountName: string): string {
        if (!validateAccountName(accountName)) {
            const normalizedAccountName = normalizeAccountName(accountName);
            this.dedupLogger.warn(
                'ACCOUNT_NAME_NORMALIZATION_WARNING',
                `Account name '${accountName}' is invalid, normalizing to '${normalizedAccountName}'`
            );
            return normalizedAccountName;
        }

        return accountName;
    }

    protected convertAmount(amount: number): number {
        return utils.convertMilliUnitsToCurrencyAmount(amount);
    }

}
