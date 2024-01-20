import { v5 as uuidv5 } from 'uuid';
import { Account, Category, CategoryGroup, MonthDetail, SubTransaction, TransactionDetail, utils } from 'ynab';
import { StandardEntry } from '../../entries/StandardEntry';
import { EntryType, SplitGroup } from '../../types';
import { splitSort, UUID_NAMESPACE } from '../../utils';
import { YNABEntryBuilder } from './entryBuilder';

export class YNABTransactionEntryBuilder extends YNABEntryBuilder {
    constructor(
        transactionsLookup: ((id: string) => TransactionDetail),
        accountLookup: ((id: string) => Account),
        categoryLookup: ((id: string) => Category),
        categoryGroupLookup: ((id: string) => CategoryGroup),
    ) {
        super(
            transactionsLookup,
            accountLookup,
            categoryLookup,
            categoryGroupLookup,
            'YNABTransactionEntryBuilder'
        );
    }

    public buildEntry(transaction: TransactionDetail): StandardEntry {
        if (transaction.transfer_account_id !== null) {
            // Transfer Case
            return this.buildTransferEntry(transaction);
        } else if (transaction.subtransactions.length === 0) {
            // Standard Case
            return this.buildStandardEntry(transaction);
        } else {
            // Split Case
            return this.buildSplitEntry(transaction);
        }
    }

    private buildDefaultEntry(transaction: TransactionDetail): Partial<StandardEntry> {
        return {
            cleared: this.isCleared(transaction.cleared),
            currency: 'USD',
            id: uuidv5(transaction.id, UUID_NAMESPACE),
            memo: transaction.memo,
            metadata: {ynab_id: transaction.id},
            payee: transaction.payee_name,
            recordDate: transaction.date,
            splits: [],
            type: EntryType.Transaction,
        };
    }

    private buildTransferEntry(transaction: TransactionDetail): StandardEntry {
        const account = this.accountLookup(transaction.account_id);
        const transferAccount = this.accountLookup(transaction.transfer_account_id);
        const amount = this.getTransactionAccountAmount(transaction, account);
        
        const category: Category = this.categoryLookup(transaction.category_id);
        const categoryGroup: CategoryGroup = this.getCategoryGroup(category);

        // Off-budget to on-budget transfer
        if(category) {
            const [splitGroup, splitAccount] = this.getSplitAccountName(
                transaction,
                category,
                categoryGroup
            );
            return new StandardEntry({
                ...this.buildDefaultEntry(transaction),
                splits: [
                    {
                        account: this.getAccountAccountName(account),
                        amount: utils.convertMilliUnitsToCurrencyAmount(-transaction.amount),
                        group: this.getAccountSplitGroup(account),
                        memo: null,
                    },
                    {
                        account: splitAccount,
                        amount: this.getTransactionAccountAmount(transaction, account),
                        group: splitGroup,
                        memo: null,
                    },
                ].sort(splitSort),
            })
        } else {
            return new StandardEntry({
                ...this.buildDefaultEntry(transaction),
                id: uuidv5(transaction.id, UUID_NAMESPACE),
                metadata: {
                    ynab_id: transaction.id,
                    ynab_transfer_id: transaction.transfer_transaction_id,
                },
                payee: 'Transfer',
                splits: [
                    {
                        account: this.getAccountAccountName(account),
                        amount,
                        group: this.getAccountSplitGroup(account),
                        memo: null,
                    },
                    {
                        account: this.getAccountAccountName(transferAccount),
                        amount: -amount,
                        group: this.getAccountSplitGroup(transferAccount),
                        memo: null,
                    },
                ].sort(splitSort),
            });
        }
    }

    private buildStandardEntry(transaction: TransactionDetail): StandardEntry {
        const account = this.accountLookup(transaction.account_id);
        const category: Category = this.categoryLookup(transaction.category_id);
        const categoryGroup: CategoryGroup = this.getCategoryGroup(category);
        const [splitGroup, splitAccount] = this.getSplitAccountName(
            transaction,
            category,
            categoryGroup
        );
        return new StandardEntry({
            ...this.buildDefaultEntry(transaction),
            splits: [
                {
                    account: this.getAccountAccountName(account),
                    amount: this.getTransactionAccountAmount(transaction, account),
                    group: this.getAccountSplitGroup(account),
                    memo: null,
                },
                {
                    account: splitAccount,
                    amount: utils.convertMilliUnitsToCurrencyAmount(-transaction.amount),
                    group: splitGroup,
                    memo: null,
                },
            ].sort(splitSort),
        });
    }

    private buildSplitEntry(transaction: TransactionDetail): StandardEntry {
        const account = this.accountLookup(transaction.account_id);
        return new StandardEntry({
            ...this.buildDefaultEntry(transaction),
            splits: [
                {
                    account: this.getAccountAccountName(account),
                    amount: this.getTransactionAccountAmount(transaction, account),
                    group: this.getAccountSplitGroup(account),
                    memo: null,
                },
                ...transaction.subtransactions.map((subTransaction: SubTransaction) => {
                    if (subTransaction.transfer_account_id !== null) {
                        // Transfer Case
                        const account = this.accountLookup(transaction.account_id);
                        const transferAccount = this.accountLookup(subTransaction.transfer_account_id);
                        const amount = utils.convertMilliUnitsToCurrencyAmount(subTransaction.amount);
                        return {
                            account: this.getAccountAccountName(transferAccount),
                            amount: -amount,
                            group: this.getAccountSplitGroup(transferAccount),
                            memo: null,
                        }
                    } else {
                        const category: Category = this.categoryLookup(subTransaction.category_id);
                        const categoryGroup: CategoryGroup = this.getCategoryGroup(category);
                        const [splitGroup, splitAccount] = this.getSplitAccountName(
                            transaction,
                            category,
                            categoryGroup
                        );
                        return {
                            account: splitAccount,
                            amount: utils.convertMilliUnitsToCurrencyAmount(-subTransaction.amount),
                            group: splitGroup,
                            memo: subTransaction.memo,
                        };
                    }
                }),
            ].sort(splitSort),
        });
    }

    private isCleared(cleared: TransactionDetail.ClearedEnum): boolean {
        return cleared !== TransactionDetail.ClearedEnum.Uncleared;
    }

    private getCategorySplitGroup(transaction: TransactionDetail, category: Category): SplitGroup {
        if (!category) { return SplitGroup.Expenses; }

        switch (category.name) {
            case 'To be Budgeted':
                if (transaction.payee_name === 'Starting Balance') {
                    return SplitGroup.Equity;
                } else {
                    return SplitGroup.Income;
                }
            default:
                return SplitGroup.Expenses;
        }
    }

    private getSplitAccountName(
        transaction: TransactionDetail,
        category: Category,
        categoryGroup: CategoryGroup): [SplitGroup, string] {
        const [accountGroup, accountName] = ((): [SplitGroup, string] => {
            if (category) {
                switch (this.getCategorySplitGroup(transaction, category)) {
                    case SplitGroup.Income:
                        return [SplitGroup.Income, `${transaction.payee_name}`];
                    case SplitGroup.Equity:
                        return [SplitGroup.Equity, 'Starting Balance'];
                    case SplitGroup.Expenses:
                        return [SplitGroup.Expenses, `${categoryGroup.name}:${category.name}`];
                }
            } else if (categoryGroup) {
                return [SplitGroup.Expenses, `${categoryGroup.name}:Uncategorized`];
            } else {
                return [SplitGroup.Expenses, "Uncategorized"]
            }
        })();

        return [accountGroup, this.validateAndNormalizeAccountName(accountName)];
    }

    private getTransactionAccountAmount(transaction: TransactionDetail, account: Account): number {
        return this.convertAmount(transaction.amount);
    }

}
