/* eslint-disable complexity */
import configXoTypescript from 'eslint-config-xo-typescript';
import arrify from 'arrify';
import {type Linter, type ESLint} from 'eslint';
import configReact from 'eslint-config-xo-react';
import {type Options} from 'prettier';
import pluginPrettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';
import {type XoConfigItem} from './types.js';
import {config} from './config.js';
import {xoToEslintConfigItem} from './utils.js';

export type CreateConfigOptions = {
	prettierOptions?: Options;
};

type Plugins = NonNullable<Linter.Config['plugins']>;
type Plugin = Plugins[string];

/**
Merge all plugins from every config into a single config entry at the start of the array, ensuring user-provided plugins take precedence. This avoids ESLint's flat config rejecting duplicate plugin names.
*/
const hoistPlugins = (configs: Linter.Config[], userPluginOverrides: Map<string, Plugin>): Linter.Config[] => {
	const plugins: Linter.Config['plugins'] = {};
	const configsWithoutPlugins: Linter.Config[] = [];

	for (const configItem of configs) {
		const {plugins: configPlugins} = configItem;

		if (!configPlugins) {
			configsWithoutPlugins.push(configItem);
			continue;
		}

		// ESLint flat config rejects duplicate plugin names, so merge all plugins into one config.
		Object.assign(plugins, configPlugins);

		const {plugins: _ignored, ...configWithoutPlugins} = configItem;

		if (Object.keys(configWithoutPlugins).length > 0) {
			configsWithoutPlugins.push(configWithoutPlugins);
		}
	}

	for (const [pluginName, plugin] of userPluginOverrides) {
		plugins[pluginName] = plugin;
	}

	if (Object.keys(plugins).length === 0) {
		return configsWithoutPlugins;
	}

	return [
		{
			name: 'xo/plugins',
			plugins,
		},
		...configsWithoutPlugins,
	];
};

/**
Takes a XO flat config and returns an ESlint flat config.
*/
export function xoToEslintConfig(flatXoConfig: XoConfigItem[] | undefined, {prettierOptions = {}}: CreateConfigOptions = {}): Linter.Config[] {
	const baseConfig = [...config];
	const userPluginOverrides = new Map<string, Plugin>();

	for (const xoConfigItem of flatXoConfig ?? []) {
		const {plugins} = xoConfigItem;

		if (!plugins) {
			continue;
		}

		for (const [pluginName, plugin] of Object.entries(plugins)) {
			userPluginOverrides.set(pluginName, plugin);
		}
	}

	/**
	Since configs are merged and the last config takes precedence this means we need to handle both true AND false cases for each option. For example, we need to turn `prettier`, `space`, `semi`, etc. on or off for a specific file.
	*/
	for (const xoConfigItem of flatXoConfig ?? []) {
		const keysOfXoConfig = Object.keys(xoConfigItem);

		if (keysOfXoConfig.length === 0) {
			continue;
		}

		/** Special case global ignores */
		if (xoConfigItem.ignores) {
			if (keysOfXoConfig.length === 1) {
				baseConfig.push({ignores: arrify(xoConfigItem.ignores)});
				continue;
			} else if (keysOfXoConfig.length === 2 && xoConfigItem.name) {
				baseConfig.push({name: xoConfigItem.name, ignores: arrify(xoConfigItem.ignores)});
				continue;
			}
		}

		/**
		An ESLint config item derived from the XO config item with rules and files initialized.
		*/
		const eslintConfigItem = xoToEslintConfigItem(xoConfigItem);

		if (xoConfigItem.semicolon === false) {
			eslintConfigItem.rules ??= {};
			eslintConfigItem.rules['@stylistic/semi'] = ['error', 'never'];
			eslintConfigItem.rules['@stylistic/semi-spacing'] = [
				'error',
				{before: false, after: true},
			];
		}

		if (xoConfigItem.space) {
			const spaces = typeof xoConfigItem.space === 'number' ? xoConfigItem.space : 2;
			eslintConfigItem.rules ??= {};
			eslintConfigItem.rules['@stylistic/indent'] = [
				'error',
				spaces,
				// eslint-disable-next-line @typescript-eslint/naming-convention
				{SwitchCase: 1},
			];
			eslintConfigItem.rules['@stylistic/indent-binary-ops'] = ['error', spaces];
		} else if (xoConfigItem.space === false) {
			// If a user sets this to false for a small subset of files for some reason,
			// then we need to set them back to their original values.
			eslintConfigItem.rules ??= {};
			eslintConfigItem.rules['@stylistic/indent'] = configXoTypescript[1]?.rules?.['@stylistic/indent'];
			eslintConfigItem.rules['@stylistic/indent-binary-ops'] = configXoTypescript[1]?.rules?.['@stylistic/indent-binary-ops'];
		}

		if (xoConfigItem.react) {
			// Ensure the files applied to the React config are the same as the config they are derived from
			baseConfig.push({...configReact[0], files: eslintConfigItem.files, name: 'xo/react'});
		}

		// Prettier should generally be the last config in the array
		if (xoConfigItem.prettier) {
			if (xoConfigItem.prettier === 'compat') {
				baseConfig.push({...eslintConfigPrettier, files: eslintConfigItem.files});
			} else {
				// Validate that Prettier options match other `xoConfig` options.
				/* eslint-disable-next-line */
				if ((xoConfigItem.semicolon && prettierOptions.semi === false) || (!xoConfigItem.semicolon && prettierOptions.semi === true)) {
					throw new Error(`The Prettier config \`semi\` is ${prettierOptions.semi} while Xo \`semicolon\` is ${xoConfigItem.semicolon}, also check your .editorconfig for inconsistencies.`);
				}

				if (((xoConfigItem.space ?? typeof xoConfigItem.space === 'number') && prettierOptions.useTabs === true) || (!xoConfigItem.space && prettierOptions.useTabs === false)) {
					throw new Error(`The Prettier config \`useTabs\` is ${prettierOptions.useTabs} while Xo \`space\` is ${xoConfigItem.space}, also check your .editorconfig for inconsistencies.`);
				}

				if (typeof xoConfigItem.space === 'number' && typeof prettierOptions.tabWidth === 'number' && xoConfigItem.space !== prettierOptions.tabWidth) {
					throw new Error(`The Prettier config \`tabWidth\` is ${prettierOptions.tabWidth} while Xo \`space\` is ${xoConfigItem.space}, also check your .editorconfig for inconsistencies.`);
				}

				// Add Prettier plugin
				eslintConfigItem.plugins = {
					...eslintConfigItem.plugins,
					prettier: pluginPrettier,
				};

				const prettierConfig = {
					singleQuote: true,
					bracketSpacing: false,
					bracketSameLine: false,
					trailingComma: 'all',
					tabWidth: typeof xoConfigItem.space === 'number' ? xoConfigItem.space : 2,
					useTabs: !xoConfigItem.space,
					semi: xoConfigItem.semicolon,
					...prettierOptions,
				};

				// Configure Prettier rules
				const rulesWithPrettier: Linter.RulesRecord = {
					...eslintConfigItem.rules,
					// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
					...(pluginPrettier.configs?.['recommended'] as ESLint.ConfigData)?.rules,
					// eslint-disable-next-line @typescript-eslint/naming-convention
					'prettier/prettier': ['error', prettierConfig],
					...eslintConfigPrettier.rules,
				};

				eslintConfigItem.rules = rulesWithPrettier;
			}
		} else if (xoConfigItem.prettier === false) {
			// Turn Prettier off for a subset of files
			eslintConfigItem.rules ??= {};
			eslintConfigItem.rules['prettier/prettier'] = 'off';
		}

		if (Object.keys(eslintConfigItem).length === 0) {
			continue;
		}

		baseConfig.push(eslintConfigItem);
	}

	// User plugins should always win, even if XO injects plugins later in the config list.
	return hoistPlugins(baseConfig, userPluginOverrides);
}

export default xoToEslintConfig;
