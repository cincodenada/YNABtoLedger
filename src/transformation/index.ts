import { getConfig } from '../configuration';
import { IConfiguration, IEntry } from '../types';
import { mapAccounts } from './accountMapping';
import { filterEntries } from './filtering';
import { combineStartingBalance } from './combineStartingBalance';
import { cleanupTransfers } from './cleanupTransfers';

export async function transform(entries: IEntry[]) {
    const config: IConfiguration = await getConfig();

    entries = mapAccounts(config, entries);
    entries = filterEntries(config, entries);
    entries = cleanupTransfers(config, entries);
    //entries = cleanupRta(config, entries);
    //entries = cleanupMeta(config, entries);
    entries = combineStartingBalance(config, entries);

    return entries;
}
