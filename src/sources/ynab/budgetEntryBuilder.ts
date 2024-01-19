import moment = require('moment');
import { v5 as uuidv5 } from 'uuid';
import { Account, Category, CategoryGroup, MonthDetail, TransactionDetail } from 'ynab';
import { AutomaticEntry } from '../../entries/AutomaticEntry';
import { StandardEntry } from '../../entries/StandardEntry';
import { EntryType, SplitGroup } from '../../types';
import { splitSort, UUID_NAMESPACE } from '../../utils';
import { YNABEntryBuilder } from './entryBuilder';

export class YNABBudgetEntryBuilder extends YNABEntryBuilder {
    private goalCategories: ((month: MonthDetail) => Category[]);

    constructor(
        transactionsLookup: ((id: string) => TransactionDetail),
        accountLookup: ((id: string) => Account),
        categoryLookup: ((id: string) => Category),
        categoryGroupLookup: ((id: string) => CategoryGroup),
        goalCategories: ((month: MonthDetail) => Category[])
    ) {
        super(
            transactionsLookup,
            accountLookup,
            categoryLookup,
            categoryGroupLookup,
            'YNABBudgetEntryBuilder'
        );
        this.goalCategories = goalCategories;
    }

    public buildEntry(month: MonthDetail): StandardEntry {
        const goalCategories: Category[] = this.goalCategories(month);
        return new StandardEntry({
            ...this.buildDefaultEntry(month),
            splits: [
                {
                    account: 'Budget',
                    amount: this.convertAmount(
                        goalCategories.reduce((sum: number, category: Category) => sum - category.budgeted, 0)
                    ),
                    group: SplitGroup.Liabilities,
                    memo: null,
                },
                ...goalCategories.map(category => {
                        const categoryGroup: CategoryGroup = this.getCategoryGroup(category);
                        return {
                            account: `Budget:${this.validateAndNormalizeAccountName(`${categoryGroup.name}:${category.name}`)}`,
                            amount: this.convertAmount(category.budgeted),
                            group: SplitGroup.Assets,
                            memo: null,
                        };
                    }),
            ].sort(splitSort),
        });
    }

    public buildAutomaticEntry(category: Category): AutomaticEntry {
        const categoryGroup: CategoryGroup = this.getCategoryGroup(category);
        const accountName: string = `${this.validateAndNormalizeAccountName(`${categoryGroup.name}:${category.name}`)}`;
        const accountMatcher = `/${SplitGroup.Expenses}:${accountName}/`;
        return new AutomaticEntry({
            accountMatcher,
            id: uuidv5(accountMatcher, UUID_NAMESPACE),
            recordDate: moment(0).format('YYYY-MM-DD'),
            splits: [
                {
                    account: 'Budget',
                    amount: 1.0,
                    group: SplitGroup.Liabilities,
                    memo: null,
                },
                {
                    account: `Budget:${accountName}`,
                    amount: -1.0,
                    group: SplitGroup.Assets,
                    memo: null,
                },
            ].sort(splitSort),
            type: EntryType.Budget,
        });
    }

    private buildDefaultEntry(month: MonthDetail): Partial<StandardEntry> {
        return {
            cleared: true,
            currency: 'USD',
            id: uuidv5(month.month, UUID_NAMESPACE),
            memo: month.note ? month.note : null,
            metadata: {},
            payee: 'Budget',
            recordDate: month.month,
            splits: [],
            type: EntryType.Budget,
        };
    }

}
