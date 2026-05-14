import path from 'node:path';
import process from 'node:process';
import {cosmiconfig} from 'cosmiconfig';
import arrify from 'arrify';
import {createJiti} from 'jiti';
import {type FlatXoConfig, type LinterOptions, type XoConfigItem} from './types.js';
import {moduleName} from './constants.js';

const jiti = createJiti(import.meta.url, {moduleCache: false});

const loadTypeScriptConfig = async (filepath: string) => jiti.import(filepath, {default: true});

/**
Finds the XO config file.
*/
export async function resolveXoConfig(options: LinterOptions): Promise<{
	flatOptions: XoConfigItem[];
	flatConfigPath: string;
}> {
	try {
		options.cwd ||= process.cwd();

		if (!path.isAbsolute(options.cwd)) {
			options.cwd = path.resolve(process.cwd(), options.cwd);
		}

		const stopDirectory = path.dirname(options.cwd);

		const flatConfigExplorer = cosmiconfig(moduleName, {
			searchPlaces: [
				'package.json',
				`${moduleName}.config.js`,
				`${moduleName}.config.mjs`,
				`${moduleName}.config.ts`,
				`${moduleName}.config.mts`,
			],
			loaders: {
				'.ts': loadTypeScriptConfig,
				'.mts': loadTypeScriptConfig,
			},
			stopDir: stopDirectory,
			cache: true,
		});

		options.filePath &&= path.resolve(options.cwd, options.filePath);

		const searchPath = options.filePath ?? options.cwd;

		let {
			config: flatOptions = [],
			filepath: flatConfigPath = '', // eslint-disable-line @typescript-eslint/no-useless-default-assignment
		} = await (
			options.configPath !== undefined && options.configPath !== ''

				? flatConfigExplorer.load(path.resolve(options.cwd, options.configPath)) as Promise<{config: FlatXoConfig | undefined; filepath: string}>

				: flatConfigExplorer.search(searchPath) as Promise<{config: FlatXoConfig | undefined; filepath: string}>
		) ?? {};

		flatOptions = arrify(flatOptions);

		return {
			flatOptions,
			flatConfigPath,
		};
	} catch (error) {
		throw new Error('Error resolving XO config, there is likely an issue with your config file. Please check the file for mistakes.', {cause: error});
	}
}

export default resolveXoConfig;
