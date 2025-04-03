import path from 'node:path';
import process from 'node:process';
import {cosmiconfig, defaultLoaders} from 'cosmiconfig';
import pick from 'lodash.pick';
import arrify from 'arrify';
import {type FlatXoConfig, type LinterOptions, type XoConfigItem} from './types.js';
import {moduleName} from './constants.js';

/**
 * Finds the xo config file
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
				`${moduleName}.config.cjs`,
				`${moduleName}.config.mjs`,
				`${moduleName}.config.ts`,
				`${moduleName}.config.cts`,
				`${moduleName}.config.mts`,
			],
			loaders: {
				'.cts': defaultLoaders['.ts'], // eslint-disable-line @typescript-eslint/naming-convention
				'.mts': defaultLoaders['.ts'], // eslint-disable-line @typescript-eslint/naming-convention
			},
			stopDir: stopDirectory,
			cache: true,
		});

		options.filePath &&= path.resolve(options.cwd, options.filePath);

		const searchPath = options.filePath ?? options.cwd;

		let {config: flatOptions = [], filepath: flatConfigPath = ''} = await (flatConfigExplorer.search(searchPath) as Promise<{config: FlatXoConfig | undefined; filepath: string}>) ?? {};

		const globalKeys = [
			'ignores',
			'settings',
			'parserOptions',
			'prettier',
			'semicolon',
			'space',
			'rules',
			'env',
			'extension',
			'files',
			'plugins',
			'react',
		];

		flatOptions = arrify(flatOptions).map(config => pick(config, globalKeys));

		return {
			flatOptions,
			flatConfigPath,
		};
	} catch (error) {
		throw new AggregateError([error], 'Error resolving XO config, there is likely an issue with your config file. Please check the file for mistakes.');
	}
}

export default resolveXoConfig;
