import { IEntry, IConfiguration, SplitGroup } from '../types';

function isValidTransfer(entry: IEntry) {
    if(entry.metadata.ynab_transfer_id === undefined) { return true }
    // The other side of this transfer is a subtransaction, so we want to drop this one
    if(entry.metadata.ynab_transfer_id === null) { return false }
    // Otherwise, just pick one - this works as well as any
    return entry.metadata.ynab_id < entry.metadata.ynab_transfer_id
}

export function cleanupTransfers(config: IConfiguration, entries: IEntry[]): IEntry[] {
    return entries.filter(isValidTransfer);
}
