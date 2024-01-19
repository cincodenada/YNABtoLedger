import { IOutputEntry, OutputType } from './outputs/types';
import meow, { AnyFlags, StringFlag, BooleanFlag } from 'meow';

export interface CommonFlags extends AnyFlags {
    config: StringFlag & {type: 'string'};
    filter: StringFlag & {type: 'string'};
    startDate: StringFlag & {type: 'string'};
}

export interface IConfiguration {
    ynab: IYNABConfiguration;
    account_name_map: SearchReplaceArray | SearchReplaceMap;
    active_filter?: string | IFilter;
    filters: {[name: string]: IFilter};
    start_date?: string;
    beancount_tags: boolean;
    meta_accounts?: string[];
    mappings?: CategoryMapping[];
}

export interface IYNABConfiguration {
    api_access_token: string;
    primary_budget_id: string;
}

export type TransactionMapper = {
    payee?: string|string[],
    memo?: string|string[],
}

export type CategoryMapping = [
    TransactionMapper,
    string
]

export type IFilter = {
    [operator: string]: IFilterSubOperations | IFilterSubOperations[]
};
export type IFilterSubOperations = string | number | IFilter;

export type SearchReplaceArray = Array<{ search: string, replace: string }>;
export type SearchReplaceMap = {[search: string]: string};

export enum SplitGroup {
    Assets = 'Assets',
    Equity = 'Equity',
    Expenses = 'Expenses',
    Income = 'Income',
    Liabilities = 'Liabilities',
}

export interface ISplit {
    group: SplitGroup;
    account: string;
    amount: number;
    memo: string;
}

export enum EntryType {
    Transaction = 'Transaction',
    Budget = 'Budget',
}

export interface IEntry {
    type: EntryType;
    id: string;
    recordDate: string;
    memo: string;
    currency: string;
    splits: ISplit[];
    metadata: {[key: string]: string};

    toOutputEntry(type: OutputType, config?: IConfiguration): IOutputEntry;
}
