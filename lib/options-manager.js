'use strict';
const os = require('os');
const path = require('path');
const arrify = require('arrify');
const mergeWith = require('lodash/mergeWith');
const flow = require('lodash/flow');
const pathExists = require('path-exists');
const findCacheDir = require('find-cache-dir');
const resolveFrom = require('resolve-from');
const prettier = require('prettier');
const semver = require('semver');
const {cosmiconfig, cosmiconfigSync, defaultLoaders} = require('cosmiconfig');
const pReduce = require('p-reduce');
const micromatch = require('micromatch');
const {
	DEFAULT_IGNORES,
	DEFAULT_EXTENSION,
	ENGINE_RULES,
	PRETTIER_CONFIG_OVERRIDE,
	MODULE_NAME, CONFIG_FILES,
	MERGE_OPTIONS_CONCAT
} = require('./constants');

const DEFAULT_CONFIG = {
	useEslintrc: false,
	cache: true,
	cacheLocation: findCacheDir({name: 'xo'}) || path.join(os.homedir() || os.tmpdir(), '.xo-cache/'),
	globInputPaths: false,
	baseConfig: {
		extends: [
			'xo',
			path.join(__dirname, '../config/overrides.js'),
			path.join(__dirname, '../config/plugins.js')
		]
	}
};

/**
 * Define the shape of deep properties for mergeWith
 */
const getEmptyOptions = () => ({
	rules: {},
	settings: {},
	globals: [],
	envs: [],
	plugins: [],
	extends: []
});

const mergeFn = (previousValue, value, key) => {
	if (Array.isArray(previousValue)) {
		if (MERGE_OPTIONS_CONCAT.includes(key)) {
			return previousValue.concat(value);
		}

		return value;
	}
};

/**
 * Find config for `lintText`.
 * The config files are searched starting from `options.filename` if defined or `options.cwd` otherwise.
 */
const mergeWithFileConfig = options => {
	options.cwd = path.resolve(options.cwd || process.cwd());
	const configExplorer = cosmiconfigSync(MODULE_NAME, {searchPlaces: CONFIG_FILES, loaders: {noExt: defaultLoaders['.json']}, stopDir: options.cwd});
	const pkgConfigExplorer = cosmiconfigSync('engines', {searchPlaces: ['package.json'], stopDir: options.cwd});
	if (options.filename) {
		options.filename = path.resolve(options.cwd, options.filename);
	}

	const searchPath = options.filename || options.cwd;

	const {config: xoOptions, filepath: xoConfigPath} = configExplorer.search(searchPath) || {};
	const {config: enginesOptions} = pkgConfigExplorer.search(searchPath) || {};

	options = mergeOptions(xoOptions, enginesOptions, options);
	options.cwd = xoConfigPath && path.dirname(xoConfigPath) !== options.cwd ? path.resolve(options.cwd, path.dirname(xoConfigPath)) : options.cwd;

	if (options.filename) {
		({options} = applyOverrides(options.filename, options));
	}

	const prettierOptions = options.prettier ? prettier.resolveConfig.sync(searchPath) || {} : {};

	return {options, prettierOptions};
};

/**
 * Find config for each files found by `lintFiles`.
 * The config files are searched starting from each files.
 */
const mergeWithFileConfigs = async (files, options) => {
	options.cwd = path.resolve(options.cwd || process.cwd());
	return [...(await pReduce(files, async (configs, file) => {
		const configExplorer = cosmiconfig(MODULE_NAME, {searchPlaces: CONFIG_FILES, loaders: {noExt: defaultLoaders['.json']}, stopDir: options.cwd});
		const pkgConfigExplorer = cosmiconfig('engines', {searchPlaces: ['package.json'], stopDir: options.cwd});
		const filepath = path.resolve(options.cwd, file);

		const {config: xoOptions, filepath: xoConfigPath} = await configExplorer.search(filepath) || {};
		const {config: enginesOptions, filepath: enginesConfigPath} = await pkgConfigExplorer.search(filepath) || {};

		let fileOptions = mergeOptions(xoOptions, enginesOptions, options);
		fileOptions.cwd = xoConfigPath && path.dirname(xoConfigPath) !== fileOptions.cwd ? path.resolve(fileOptions.cwd, path.dirname(xoConfigPath)) : fileOptions.cwd;

		if (!fileOptions.extensions.includes(path.extname(filepath).replace('.', '')) || isFileIgnored(filepath, fileOptions)) {
			// File extension/path is ignored, skip it
			return configs;
		}

		const {hash, options: optionsWithOverrides} = applyOverrides(filepath, fileOptions);

		const prettierConfigPath = optionsWithOverrides.prettier ? await prettier.resolveConfigFile(filepath) : undefined;
		const prettierOptions = prettierConfigPath ? await prettier.resolveConfig(filepath, {config: prettierConfigPath}) : {};

		const cacheKey = JSON.stringify({xoConfigPath, enginesConfigPath, prettierConfigPath, hash});
		const cachedGroup = configs.get(cacheKey);

		configs.set(cacheKey, {
			files: [filepath, ...(cachedGroup ? cachedGroup.files : [])],
			options: cachedGroup ? cachedGroup.options : optionsWithOverrides,
			prettierOptions
		});

		return configs;
	}, new Map())).values()];
};

const normalizeOptions = options => {
	options = {...options};

	// Aliases for humans
	const aliases = [
		'env',
		'global',
		'ignore',
		'plugin',
		'rule',
		'setting',
		'extend',
		'extension'
	];

	for (const singular of aliases) {
		const plural = singular + 's';
		let value = options[plural] || options[singular];

		delete options[singular];

		if (value === undefined) {
			continue;
		}

		if (singular !== 'rule' && singular !== 'setting') {
			value = arrify(value);
		}

		options[plural] = value;
	}

	return options;
};

const normalizeSpaces = options => typeof options.space === 'number' ? options.space : 2;

const isFileIgnored = (file, options) => micromatch.isMatch(path.relative(options.cwd, file), options.ignores);

/**
 * Merge option passed via CLI/API via options founf in config files.
 */
const mergeOptions = (xoOptions, enginesOptions, options) => {
	const mergedOptions = normalizeOptions({
		...xoOptions,
		nodeVersion: enginesOptions && enginesOptions.node && semver.validRange(enginesOptions.node),
		...options
	});

	mergedOptions.extensions = DEFAULT_EXTENSION.concat(options.extensions || []);
	mergedOptions.ignores = getIgnores(mergedOptions);

	return mergedOptions;
};

/**
 * Transform an XO options into ESLint compatible options:
 * - apply rules based on XO options (e.g `spaces` => `indent` rules or `semicolon` => `semi` rule)
 * - resolve the extended configurations
 * - apply rules based on Prettier config if `prettier` option is `true`
 */
const buildConfig = (options, prettierOptions) =>
	flow(
		buildXOConfig(options),
		buildExtendsConfig(options),
		buildPrettierConfig(options, prettierOptions)
	)(mergeWith(getEmptyOptions(), DEFAULT_CONFIG, normalizeOptions(options), mergeFn));

const buildXOConfig = options => config => {
	const spaces = normalizeSpaces(options);

	for (const [rule, ruleConfig] of Object.entries(ENGINE_RULES)) {
		for (const minVersion of Object.keys(ruleConfig).sort(semver.rcompare)) {
			if (!options.nodeVersion || semver.intersects(options.nodeVersion, `<${minVersion}`)) {
				config.rules[rule] = ruleConfig[minVersion];
			}
		}
	}

	if (options.nodeVersion) {
		config.rules['node/no-unsupported-features/es-builtins'] = ['error', {version: options.nodeVersion}];
		config.rules['node/no-unsupported-features/es-syntax'] = ['error', {version: options.nodeVersion, ignores: ['modules']}];
		config.rules['node/no-unsupported-features/node-builtins'] = ['error', {version: options.nodeVersion}];
	}

	if (options.space && !options.prettier) {
		config.rules.indent = ['error', spaces, {SwitchCase: 1}];

		// Only apply if the user has the React plugin
		if (options.cwd && resolveFrom.silent(options.cwd, 'eslint-plugin-react')) {
			config.plugins = config.plugins.concat('react');
			config.rules['react/jsx-indent-props'] = ['error', spaces];
			config.rules['react/jsx-indent'] = ['error', spaces];
		}
	}

	if (options.semicolon === false && !options.prettier) {
		config.rules.semi = ['error', 'never'];
		config.rules['semi-spacing'] = ['error', {
			before: false,
			after: true
		}];
	}

	if (options.esnext !== false) {
		config.baseConfig.extends = [
			'xo/esnext',
			path.join(__dirname, '../config/plugins.js')
		];
	}

	if (options.rules) {
		Object.assign(config.rules, options.rules);
	}

	if (options.settings) {
		config.baseConfig.settings = options.settings;
	}

	if (options.parser) {
		config.baseConfig.parser = options.parser;
	}

	return config;
};

const buildExtendsConfig = options => config => {
	if (options.extends && options.extends.length > 0) {
		// TODO: This logic needs to be improved, preferably use the same code as ESLint
		// user's configs must be resolved to their absolute paths
		const configs = options.extends.map(name => {
			// Don't do anything if it's a filepath
			if (pathExists.sync(name)) {
				return name;
			}

			// Don't do anything if it's a config from a plugin
			if (name.startsWith('plugin:')) {
				return name;
			}

			if (!name.includes('eslint-config-')) {
				name = `eslint-config-${name}`;
			}

			const returnValue = resolveFrom(options.cwd, name);

			if (!returnValue) {
				throw new Error(`Couldn't find ESLint config: ${name}`);
			}

			return returnValue;
		});

		config.baseConfig.extends = [...config.baseConfig.extends, ...configs];
	}

	return config;
};

const buildPrettierConfig = (options, prettierConfig) => config => {
	if (options.prettier) {
		// The prettier plugin uses Prettier to format the code with `--fix`
		config.plugins = config.plugins.concat('prettier');
		// The prettier config overrides ESLint stylistic rules that are handled by Prettier
		config.baseConfig.extends = config.baseConfig.extends.concat('prettier');
		config.baseConfig.extends = config.baseConfig.extends.concat('prettier/unicorn');
		// The `prettier/prettier` rule reports errors if the code is not formatted in accordance to Prettier
		config.rules['prettier/prettier'] = ['error', mergeWithPrettierConfig(options, prettierConfig)];
		// If the user has the React, Flowtype, or Standard plugin, add the corresponding Prettier rule overrides
		// See https://github.com/prettier/eslint-config-prettier for the list of plugins overrrides
		for (const [plugin, prettierConfig] of Object.entries(PRETTIER_CONFIG_OVERRIDE)) {
			if (options.cwd && resolveFrom.silent(options.cwd, plugin)) {
				config.baseConfig.extends = config.baseConfig.extends.concat(prettierConfig);
			}
		}
	}

	return config;
};

const mergeWithPrettierConfig = (options, prettierOptions) => {
	if ((options.semicolon === true && prettierOptions.semi === false) ||
		(options.semicolon === false && prettierOptions.semi === true)) {
		throw new Error(`The Prettier config \`semi\` is ${prettierOptions.semi} while XO \`semicolon\` is ${options.semicolon}`);
	}

	if (((options.space === true || typeof options.space === 'number') && prettierOptions.useTabs === true) ||
		((options.space === false) && prettierOptions.useTabs === false)) {
		throw new Error(`The Prettier config \`useTabs\` is ${prettierOptions.useTabs} while XO \`space\` is ${options.space}`);
	}

	if (typeof options.space === 'number' && typeof prettierOptions.tabWidth === 'number' && options.space !== prettierOptions.tabWidth) {
		throw new Error(`The Prettier config \`tabWidth\` is ${prettierOptions.tabWidth} while XO \`space\` is ${options.space}`);
	}

	return mergeWith(
		{},
		{
			singleQuote: true,
			bracketSpacing: false,
			jsxBracketSameLine: false,
			trailingComma: 'none',
			tabWidth: normalizeSpaces(options),
			useTabs: !options.space,
			semi: options.semicolon !== false
		},
		prettierOptions,
		mergeFn
	);
};

const applyOverrides = (file, options) => {
	if (options.overrides && options.overrides.length > 0) {
		const {overrides} = options;
		delete options.overrides;

		let {applicable, hash} = findApplicableOverrides(path.relative(options.cwd, file), overrides);

		options = mergeWith(...[getEmptyOptions(), options].concat(applicable.map(override => normalizeOptions(override)), mergeFn));
		delete options.files;
		return {options, hash};
	}

	return {options};
};

/**
 * Builds a list of overrides for a particular path, and a hash value.
 * The hash value is a binary representation of which elements in the `overrides` array apply to the path.
 *
 * If `overrides.length === 4`, and only the first and third elements apply, then our hash is: 1010 (in binary)
 */
const findApplicableOverrides = (path, overrides) => {
	let hash = 0;
	const applicable = [];

	for (const override of overrides) {
		hash <<= 1;

		if (micromatch.isMatch(path, override.files)) {
			applicable.push(override);
			hash |= 1;
		}
	}

	return {
		hash,
		applicable
	};
};

const getIgnores = ({ignores}) => DEFAULT_IGNORES.concat(ignores || []);

module.exports = {
	findApplicableOverrides,
	mergeWithPrettierConfig,
	normalizeOptions,
	getIgnores,
	mergeWithFileConfigs,
	mergeWithFileConfig,
	buildConfig,
	applyOverrides
};
