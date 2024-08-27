import { getConfig } from '../configuration';
import { IConfiguration, IEntry } from '../types';
import { mapAccounts } from './accountMapping';
import { mapCategory } from './mapCategory';
import { filterEntries } from './filtering';
import { combineStartingBalance, combinePayroll } from './combineStartingBalance';
import { cleanupTransfers, rtaToIncome } from './cleanupTransfers';

export async function transform(entries: IEntry[]) {
    const config: IConfiguration = await getConfig();

    entries = mapCategory(config, entries);
    entries = mapAccounts(config, entries);
    entries = filterEntries(config, entries);
    entries = cleanupTransfers(config, entries);
    entries = rtaToIncome(config, entries);
    //entries = cleanupRta(config, entries);
    //entries = cleanupMeta(config, entries);
    entries = combineStartingBalance(config, entries);
    entries = combinePayroll(config, entries);

    return entries;
}
