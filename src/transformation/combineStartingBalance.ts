import { StandardEntry } from '../entries/StandardEntry';
import { IEntry, IConfiguration, SplitGroup } from '../types';
import { partition, splitSort } from '../utils';

export function combineStartingBalance(config: IConfiguration, entries: IEntry[]) {
    const [startingBalances, remainder] = partition(entries, t => (t as StandardEntry).payee === "Starting Balance")
    const combined = startingBalances.reduce((combined, t) => {
        combined.splits.push(t.splits.find(s => s.group !== SplitGroup.Expenses))
        return combined
    })
    combined.splits = [
        // TODO: Sort better now?
        ...combined.splits.filter(s => s.group !== SplitGroup.Expenses).sort(splitSort),
        {
            group: SplitGroup.Equity,
            amount: null,
            account: 'Starting Balances',
            memo: null
        }
    ]

    return [
        combined,
        ...remainder
    ]
}
