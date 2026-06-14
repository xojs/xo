/* eslint-disable complexity -- Translating every XO config option into ESLint rules is inherently branchy. */
import arrify from 'arrify';
import {type Linter} from 'eslint';
import {getPrettierConfig} from 'eslint-config-xo';
import {type XoConfigItem} from './types.js';
import {config} from './config.js';
import {xoToEslintConfigItem} from './utils.js';

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
Takes an XO flat config and returns an ESLint flat config.
*/
export function xoToEslintConfig(flatXoConfig: XoConfigItem[] | undefined): Linter.Config[] {
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
		if (xoConfigItem.ignores !== undefined) {
			if (keysOfXoConfig.length === 1) {
				baseConfig.push({ignores: arrify(xoConfigItem.ignores)});
				continue;
			}

			if (keysOfXoConfig.length === 2 && xoConfigItem.name !== undefined) {
				baseConfig.push({name: xoConfigItem.name, ignores: arrify(xoConfigItem.ignores)});
				continue;
			}
		}

		/**
		An ESLint config item derived from the XO config item with rules and files initialized.
		*/
		const eslintConfigItem = xoToEslintConfigItem(xoConfigItem);

		const isUsingSpaces = Boolean(xoConfigItem.space);

		if (xoConfigItem.semicolon === false) {
			eslintConfigItem.rules ??= {};
			eslintConfigItem.rules['@stylistic/semi'] = ['error', 'never'];
			eslintConfigItem.rules['@stylistic/semi-spacing'] = ['error', {before: false, after: true}];
			eslintConfigItem.rules['@stylistic/member-delimiter-style'] = [
				'error',
				{
					multiline: {delimiter: 'none'},
					singleline: {delimiter: 'comma', requireLast: false},
				},
			];
		}

		if (isUsingSpaces) {
			const spaces = typeof xoConfigItem.space === 'number' ? xoConfigItem.space : 2;
			eslintConfigItem.rules ??= {};
			eslintConfigItem.rules['@stylistic/indent'] = ['error', spaces, {SwitchCase: 1}]; // eslint-disable-line @typescript-eslint/naming-convention
			eslintConfigItem.rules['@stylistic/indent-binary-ops'] = ['error', spaces];
		} else if (xoConfigItem.space === false) {
			eslintConfigItem.rules ??= {};
			eslintConfigItem.rules['@stylistic/indent'] = ['error', 'tab', {SwitchCase: 1}]; // eslint-disable-line @typescript-eslint/naming-convention
			eslintConfigItem.rules['@stylistic/indent-binary-ops'] = ['error', 'tab'];
		}

		// Delegate Prettier integration to `eslint-config-xo`. Its config is pushed after `eslintConfigItem` below so it comes last, disabling the conflicting stylistic rules set above.
		const prettierConfig = getPrettierConfig({
			prettier: xoConfigItem.prettier,
			// `Space` allows `string` for legacy reasons, but Prettier only needs `boolean | number`.
			space: xoConfigItem.space as boolean | number | undefined,
			semicolon: xoConfigItem.semicolon,
			files: eslintConfigItem.files,
		});

		if (xoConfigItem.prettier === false) {
			// Turn Prettier off for a subset of files
			eslintConfigItem.rules ??= {};
			eslintConfigItem.rules['prettier/prettier'] = 'off';
		}

		if (Object.keys(eslintConfigItem).length > 0) {
			baseConfig.push(eslintConfigItem);
		}

		if (prettierConfig) {
			baseConfig.push(prettierConfig);
		}
	}

	// User plugins should always win, even if XO injects plugins later in the config list.
	return hoistPlugins(baseConfig, userPluginOverrides);
}

export default xoToEslintConfig;
