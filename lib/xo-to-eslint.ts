import arrify from 'arrify';
import {type Linter} from 'eslint';
import eslintConfigXo, {type Options} from 'eslint-config-xo';
import {type XoConfigItem} from './types.js';
import {xoToEslintConfigItem} from './utils.js';

type Plugins = NonNullable<Linter.Config['plugins']>;
type Plugin = Plugins[string];

type GlobalOptions = Pick<Options, 'space' | 'semicolon' | 'prettier'>;

const getGlobalOptions = (xoConfig: XoConfigItem[]): GlobalOptions => {
	const options: GlobalOptions = {};

	for (const xoConfigItem of xoConfig) {
		const hasScopedOptions = xoConfigItem.files !== undefined
			|| xoConfigItem.basePath !== undefined
			|| xoConfigItem.ignores !== undefined;
		const hasStyleOptions = xoConfigItem.space !== undefined
			|| xoConfigItem.semicolon !== undefined
			|| xoConfigItem.prettier !== undefined;
		if (hasScopedOptions && hasStyleOptions) {
			throw new TypeError('XO style options only support global config items. Use ESLint rules for file-scoped overrides.');
		}

		if (xoConfigItem.space !== undefined) {
			options.space = xoConfigItem.space as Options['space'];
		}

		if (xoConfigItem.semicolon !== undefined) {
			options.semicolon = xoConfigItem.semicolon;
		}

		if (xoConfigItem.prettier !== undefined) {
			options.prettier = xoConfigItem.prettier;
		}
	}

	return options;
};

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

		// A leftover with only `files` has no effect, so drop it.
		if (Object.keys(configWithoutPlugins).some(key => key !== 'files')) {
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
	const xoConfig = flatXoConfig ?? [];
	const baseConfig = eslintConfigXo(getGlobalOptions(xoConfig));
	const prettierConfig = baseConfig.find(config => config.name === 'xo/prettier' || config.name === 'xo/prettier-compat');
	if (prettierConfig) {
		// XO's global Prettier option applies to every language config, not only the JavaScript and TypeScript files covered by eslint-config-xo.
		delete prettierConfig.files;
	}

	const userPluginOverrides = new Map<string, Plugin>();

	for (const xoConfigItem of xoConfig) {
		const {plugins} = xoConfigItem;

		if (plugins) {
			for (const [pluginName, plugin] of Object.entries(plugins)) {
				userPluginOverrides.set(pluginName, plugin);
			}
		}

		const keysOfXoConfig = Object.keys(xoConfigItem);

		if (keysOfXoConfig.length === 0) {
			continue;
		}

		/**
		Special case global ignores
		*/
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

		if (Object.keys(eslintConfigItem).length > 0) {
			baseConfig.push(eslintConfigItem);
		}
	}

	// User plugins should always win, even if XO injects plugins later in the config list.
	return hoistPlugins(baseConfig, userPluginOverrides);
}

export default xoToEslintConfig;
