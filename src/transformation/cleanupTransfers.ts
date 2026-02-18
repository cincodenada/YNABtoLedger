import { StandardEntry } from '../entries/StandardEntry';
import { IEntry, IConfiguration, SplitGroup } from '../types';
import { partition, splitName } from "../utils";
import { P, match } from "ts-pattern";

function isValidTransfer(entry: IEntry) {
    if(entry.metadata.ynab_transfer_id === undefined) { return true }
    // The other side of this transfer is a subtransaction, so we want to drop this one
    if(entry.metadata.ynab_transfer_id === null) { return false }
    // Otherwise, just pick one - this works as well as any
    return entry.metadata.ynab_id < entry.metadata.ynab_transfer_id
}

function getRtaSplit(entry: IEntry) {
    return entry.splits.find(s => s.account.startsWith('Internal Master Category'))
}

function isMetaTransfer(metaAccounts: string[]) {
    return (entry: IEntry)  => entry.splits.length === 2 && entry.splits.every(s => metaAccounts.includes(s.account.split(':').slice(-1)[0]))
}

export function cleanupRta(entries: IEntry[]) {
    return entries.filter(e => (e as StandardEntry).payee?.startsWith("Transfer") ? !getRtaSplit(e) : true)
        .map(e => {
            const rtaSplit = getRtaSplit(e);
            if(rtaSplit) {
                rtaSplit.group = SplitGroup.Income;
                rtaSplit.account = "Other";
            }
            return e 
        })
}

export function cleanupMeta(config: IConfiguration, entries: IEntry[]): IEntry[] {
    const [meta, remainder] = partition(entries, isMetaTransfer(config.meta_accounts))
    const transferMap = {}
    for(const t of meta) {
        if(!transferMap[t.recordDate]) { transferMap[t.recordDate] = {} }
        const curDate = transferMap[t.recordDate];
        for(const idxKey in t.splits) {
            const idx = Number(idxKey)
            const key = splitName(t.splits[idx]);
            const other = t.splits[1-idx]
            if(!curDate[key]) { curDate[key] = [] }
            curDate[key].push(other)
        }
    }

    return remainder.map(e => {
        if(e.splits.length !== 2) { return e }

        // TODO: Gosh this is ugly
        const transfers = transferMap[e.recordDate];
        if(transfers) {
            const expenseIdx = e.splits.findIndex(s => s.group === 'Expenses')
            if(expenseIdx > -1) {
                const other = e.splits[1-expenseIdx]
                const relTransfer = transfers[splitName(other)]?.find(t => t.amount === other.amount)
                if(relTransfer) {
                    e.splits[1-expenseIdx] = relTransfer;
                }
            }
        }

        return e
    })
}

export function cleanupTransfers(config: IConfiguration, entries: IEntry[]): IEntry[] {
    const prune = new Set()
    for(const tx of entries.filter(e => e.metadata?.ynab_transfer_id)) {
        if(!prune.has(tx.metadata.ynab_id)) {
            prune.add(tx.metadata.ynab_transfer_id)
        }
    }
    return entries.filter(e => !e.metadata || !(prune.has(e.metadata.ynab_id) || e.metadata.ynab_transfer_id === null));
}

export function rtaToIncome(config: IConfiguration, entries: IEntry[]): IEntry[] {
    return entries.map(e => {
        const rta = getRtaSplit(e);
        const tx = (e as StandardEntry);
        if(rta) {
            [rta.group, rta.account] = match(tx)
                .returnType<[SplitGroup, string]>()
                .with({payee: "Starting Balance"}, () => [SplitGroup.Equity, 'Starting Balances'])
                .with({payee: P.string.includes("Dividend")}, () => [SplitGroup.Income, 'Dividend'])
                .with({payee: P.string.includes("Interest")}, () => [SplitGroup.Income, 'Interest'])
                .with({payee: P.string.includes("Payroll")}, (tx: StandardEntry) => {
                    if(tx.splits.find(s => s.account.includes('Benefits'))) {
                       return [SplitGroup.Income, 'Benefits']
                    } else {
                        return [SplitGroup.Income, 'Salary']
                    }
                })
                .otherwise(() => [SplitGroup.Income, 'Other'])
        }
        return e
    })
}
