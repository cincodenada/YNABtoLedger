#!/usr/bin/env node

require('source-map-support').install()
import meow = require('meow');
import { ListAccountsSubCommand } from './commands/list-accounts';
import { ToBeancountSubCommand } from './commands/to-beancount';
import { ToJsonSubCommand } from './commands/to-json';
import { ToLedgerSubCommand } from './commands/to-ledger';
import { ISubCommand } from './commands/types';
import { getConfig, initializeConfiguration, setInstanceConfig } from './configuration';
import { EntriesProvider } from './entiresProvider';
import { DedupLogger } from './logging';
import { CommonFlags, IConfiguration, IEntry } from './types';

async function configureCommonConfig(cli: meow.Result<CommonFlags>): Promise<void> {
    await initializeConfiguration(cli.flags.config);
    const config: IConfiguration = await getConfig();

    let instanceConfig: Partial<IConfiguration> = {};

    if (cli.flags.filter) {
        try {
            cli.flags.filter = JSON.parse(cli.flags.filter);
        } catch (e) {
            if (e instanceof SyntaxError && cli.flags.filter.match(/[{}]/)) {
                throw e;
            }
        }

        instanceConfig = {
            ...instanceConfig,
            active_filter: cli.flags.filter,
        };
    }

    if (cli.flags.startDate) {
        instanceConfig = {
            ...instanceConfig,
            start_date: cli.flags.startDate,
        };
    }

    setInstanceConfig(instanceConfig);
}

(async () => {
    const logger: DedupLogger = new DedupLogger('CliManager');

    const cliFlags: CommonFlags = {
        config: {
            alias: 'c',
            type: 'string',
        },
        filter: {
            alias: 'f',
            type: 'string',
        },
        startDate: {
            alias: 's',
            type: 'string',
        },
    };

    const cli: meow.Result<CommonFlags> = meow(`
        Usage
          $ ynab-translator [options] <command>

        Options
          --config (-c)                                  config file to be used
          --filter (-f) [<file name> | <json-logic>]     either named filter, or json-logic syntax (http://jsonlogic.com)
          --start-date (-s)                              date to start YNAB transactions from

        Commands
          list-accounts                                  lists the mapped accounts from YNAB
          to-beancount                                   handles the translation from YNAB to beancount files
          to-ledger                                      handles the translation from YNAB to a ledger file
          to-json                                        handles the translation from YNAB to the internal json representation

        Examples
          $ ynab-translator --filter '^Expenses.*' list-account
          $ ynab-translator --config config/.ynabtransformerrc to-beancount
    `, {
        autoHelp: false,
        flags: cliFlags,
    });

    const subCommandMap: {[key: string]: (provider: EntriesProvider) => ISubCommand} = {
        'list-accounts': p => new ListAccountsSubCommand(p),
        'to-beancount':  p => new ToBeancountSubCommand(p, cliFlags),
        'to-json':       p => new ToJsonSubCommand(p),
        'to-ledger':     p => new ToLedgerSubCommand(p, cliFlags),
    };

    if (cli.input.length === 0 || !(cli.input[0] in subCommandMap)) {
        cli.showHelp();
    }

    await configureCommonConfig(cli);

    const provider: EntriesProvider = new EntriesProvider();
    const command: ISubCommand = subCommandMap[cli.input[0]](provider);

    await command.execute();
})();
