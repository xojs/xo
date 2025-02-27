/* eslint-disable complexity */
import configXoTypescript from 'eslint-config-xo-typescript';
import arrify from 'arrify';
import {type Linter, type ESLint} from 'eslint';
import configReact from 'eslint-config-xo-react';
import {type Options} from 'prettier';
import pluginPrettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';
import {type FlatXoConfig} from './types.js';
import {config} from './config.js';
import {xoToEslintConfigItem} from './utils.js';

export type CreateConfigOptions = {
	prettierOptions?: Options;
};
/**
 * Takes a xo flat config and returns an eslint flat config
 */
export async function xoToEslintConfig(flatXoConfig: FlatXoConfig | undefined, {prettierOptions = {}}: CreateConfigOptions = {}): Promise<Linter.Config[]> {
	const baseConfig = [...config];
	/**
   * Since configs are merged and the last config takes precedence
   * this means we need to handle both true AND false cases for each option.
   * ie... we need to turn prettier,space,semi,etc... on or off for a specific file
   */
	for (const xoConfigItem of flatXoConfig ?? []) {
		const keysOfXoConfig = Object.keys(xoConfigItem);

		if (keysOfXoConfig.length === 0) {
			continue;
		}

		/** Special case global ignores */
		if (keysOfXoConfig.length === 1 && keysOfXoConfig[0] === 'ignores') {
			baseConfig.push({ignores: arrify(xoConfigItem.ignores)});
			continue;
		}

		/**  An eslint config item derived from the xo config item with rules and files initialized */
		const eslintConfigItem = xoToEslintConfigItem(xoConfigItem);

		if (xoConfigItem.semicolon === false) {
			eslintConfigItem.rules['@stylistic/semi'] = ['error', 'never'];
			eslintConfigItem.rules['@stylistic/semi-spacing'] = [
				'error',
				{before: false, after: true},
			];
		}

		if (xoConfigItem.space) {
			const spaces
        = typeof xoConfigItem.space === 'number' ? xoConfigItem.space : 2;
			eslintConfigItem.rules['@stylistic/indent'] = [
				'error',
				spaces,
				// eslint-disable-next-line @typescript-eslint/naming-convention
				{SwitchCase: 1},
			];
		} else if (xoConfigItem.space === false) {
			// If a user set this false for a small subset of files for some reason,
			// then we need to set them back to their original values
			eslintConfigItem.rules['@stylistic/indent']
        = configXoTypescript[1]?.rules?.['@stylistic/indent'];
		}

		if (xoConfigItem.prettier) {
			if (xoConfigItem.prettier === 'compat') {
				baseConfig.push({...eslintConfigPrettier, files: eslintConfigItem.files});
			} else {
				// Validate that prettier options match other xoConfig options
				if ((xoConfigItem.semicolon && prettierOptions.semi === false) ?? (!xoConfigItem.semicolon && prettierOptions.semi === true)) {
					throw new Error(`The Prettier config \`semi\` is ${prettierOptions.semi} while Xo \`semicolon\` is ${xoConfigItem.semicolon}, also check your .editorconfig for inconsistencies.`);
				}

				if (((xoConfigItem.space ?? typeof xoConfigItem.space === 'number') && prettierOptions.useTabs === true) || (!xoConfigItem.space && prettierOptions.useTabs === false)) {
					throw new Error(`The Prettier config \`useTabs\` is ${prettierOptions.useTabs} while Xo \`space\` is ${xoConfigItem.space}, also check your .editorconfig for inconsistencies.`);
				}

				if (typeof xoConfigItem.space === 'number' && typeof prettierOptions.tabWidth === 'number' && xoConfigItem.space !== prettierOptions.tabWidth) {
					throw new Error(`The Prettier config \`tabWidth\` is ${prettierOptions.tabWidth} while Xo \`space\` is ${xoConfigItem.space}, also check your .editorconfig for inconsistencies.`);
				}

				// Add prettier plugin
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

				// Configure prettier rules
				const rulesWithPrettier: Linter.RulesRecord = {
					...eslintConfigItem.rules,
					...(pluginPrettier.configs?.['recommended'] as ESLint.ConfigData)?.rules,
					// eslint-disable-next-line @typescript-eslint/naming-convention
					'prettier/prettier': ['error', prettierConfig],
					...eslintConfigPrettier.rules,
				};

				eslintConfigItem.rules = rulesWithPrettier;
			}
		} else if (xoConfigItem.prettier === false) {
			// Turn prettier off for a subset of files
			eslintConfigItem.rules['prettier/prettier'] = 'off';
		}

		if (xoConfigItem.react) {
			// Ensure the files applied to the react config are the same as the config they are derived from
			baseConfig.push({...configReact[0], files: eslintConfigItem.files});
		}

		baseConfig.push(eslintConfigItem);
	}

	return baseConfig;
}

export default xoToEslintConfig;
