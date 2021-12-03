import cosmiconfig from 'cosmiconfig';
import fs from 'fs';
import path from 'path';
import prompts from 'prompts';
import util from 'util';

import ynabBuildConfig from './sources/ynab/config';
import { IConfiguration, IYNABConfiguration } from './types';
import moment from 'moment';

const moduleName = 'ynabtransformer';
const home = process.env.HOME;
const defaultConfigPath = path.join(home || '.', `.${moduleName}rc`);
let cfg: IConfiguration;
let instanceCfg: Partial<IConfiguration> = {};
let cfgFilepath: string;

export async function initializeConfiguration(configFilepath?: string) {
    const result = await loadOrBuildConfig(configFilepath);
    cfg = (result.cfg as IConfiguration);
    cfgFilepath = result.cfgFilepath;
}

async function loadOrBuildConfig(configFilepath?: string): Promise<{cfg: cosmiconfig.Config, cfgFilepath: string }> {
    const explorer = cosmiconfig(moduleName);
    try {
        let searchResult;
        if (configFilepath) {
            searchResult = await explorer.load(configFilepath);
        } else {
            searchResult = await explorer.search();
        }
        if (!searchResult) {
            return buildConfig();
        } else if (!searchResult.config) {
            return buildConfig(searchResult.filepath);
        } else {
            return buildConfig(searchResult.filepath, searchResult.config);
        }
    } catch (e) {
        console.error('Error when searching for configuration', e);
    }
}

async function buildConfig(filepath: string = defaultConfigPath, existingConfig: cosmiconfig.Config = null)
    : Promise<{cfg: cosmiconfig.Config, cfgFilepath: string }> {

    const onCancel = () => {
        console.log('Failed to gather necessary information, exiting...');
        process.exit(0);
    };

    let ynabConfig = {} as IYNABConfiguration;
    try {
        ynabConfig = await ynabBuildConfig(existingConfig);
    } catch (e) {
        console.error('Failed to gather ynab configuration information', e);
        process.exit(0);
    }

    const config: IConfiguration = {
        filters: {},
        account_name_map: [],
        beancount_tags: true,
        ynab: ynabConfig,
    };

    await saveConfig(config, filepath);

    return {
        cfg: config,
        cfgFilepath: filepath,
    };
}

async function saveConfig(config: cosmiconfig.Config, filepath: string) {
    const writeFile = util.promisify(fs.writeFile);

    try {
        writeFile(filepath, JSON.stringify(config, null, 4));
    } catch (e) {
        console.error('Error when attempting to save config', config, filepath, e);
    }
}

export function setInstanceConfig(config: Partial<IConfiguration>): void {
    instanceCfg = config;
}

export function getInstanceConfig(): Partial<IConfiguration> {
    return instanceCfg;
}

export async function getConfig(): Promise<IConfiguration> {
    if (!cfg) {
        await initializeConfiguration();
    }
    return {
        ...cfg,
        ...instanceCfg,
    };
}
