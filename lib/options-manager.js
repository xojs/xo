'use strict';
const os = require('os');
const path = require('path');
const {outputJson, outputJsonSync} = require('fs-extra');
const pkg = require('../package.json');
const arrify = require('arrify');
const mergeWith = require('lodash/mergeWith');
const groupBy = require('lodash/groupBy');
const flow = require('lodash/flow');
const pathExists = require('path-exists');
const findUp = require('find-up');
const findCacheDir = require('find-cache-dir');
const resolveFrom = require('resolve-from');
const prettier = require('prettier');
const semver = require('semver');
const {cosmiconfig, cosmiconfigSync, defaultLoaders} = require('cosmiconfig');
const pReduce = require('p-reduce');
const micromatch = require('micromatch');
const JSON5 = require('json5');
const toAbsoluteGlob = require('to-absolute-glob');
const stringify = require('json-stable-stringify-without-jsonify');
const murmur = require('imurmurhash');
const isPathInside = require('is-path-inside');
const {
	DEFAULT_IGNORES,
	DEFAULT_EXTENSION,
	TYPESCRIPT_EXTENSION,
	ENGINE_RULES,
	PRETTIER_CONFIG_OVERRIDE,
	MODULE_NAME,
	CONFIG_FILES,
	MERGE_OPTIONS_CONCAT,
	TSCONFIG_DEFFAULTS,
	CACHE_DIR_NAME
} = require('./constants');

const nodeVersion = process && process.version;
const cacheLocation = findCacheDir({name: CACHE_DIR_NAME}) || path.join(os.homedir() || os.tmpdir(), '.xo-cache/');

const DEFAULT_CONFIG = {
	useEslintrc: false,
	cache: true,
	cacheLocation: path.join(cacheLocation, 'xo-cache.json'),
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
Define the shape of deep properties for `mergeWith`.
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

const isTypescript = file => TYPESCRIPT_EXTENSION.includes(path.extname(file).slice(1));

/**
Find config for `lintText`.
The config files are searched starting from `options.filename` if defined or `options.cwd` otherwise.
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

	options = mergeOptions(options, xoOptions, enginesOptions);
	options.cwd = xoConfigPath && path.dirname(xoConfigPath) !== options.cwd ? path.resolve(options.cwd, path.dirname(xoConfigPath)) : options.cwd;

	if (options.filename) {
		({options} = applyOverrides(options.filename, options));
	}

	const prettierOptions = options.prettier ? prettier.resolveConfig.sync(searchPath, {editorconfig: true}) || {} : {};

	if (options.filename && isTypescript(options.filename)) {
		const tsConfigExplorer = cosmiconfigSync([], {searchPlaces: ['tsconfig.json'], loaders: {'.json': (_, content) => JSON5.parse(content)}});
		const {config: tsConfig, filepath: tsConfigPath} = tsConfigExplorer.search(options.filename) || {};

		options.tsConfigPath = getTsConfigCachePath([options.filename], options.tsConfigPath);
		options.ts = true;
		outputJsonSync(options.tsConfigPath, makeTSConfig(tsConfig, tsConfigPath, [options.filename]));
	}

	return {options, prettierOptions};
};

/**
Find config for each files found by `lintFiles`.
The config files are searched starting from each files.
*/
const mergeWithFileConfigs = async (files, options, configFiles) => {
	configFiles = configFiles.sort((a, b) => b.filepath.split(path.sep).length - a.filepath.split(path.sep).length);
	const tsConfigs = {};

	const groups = [...(await pReduce(files, async (configs, file) => {
		const pkgConfigExplorer = cosmiconfig('engines', {searchPlaces: ['package.json'], stopDir: options.cwd});

		const {config: xoOptions, filepath: xoConfigPath} = findApplicableConfig(file, configFiles) || {};
		const {config: enginesOptions, filepath: enginesConfigPath} = await pkgConfigExplorer.search(file) || {};

		let fileOptions = mergeOptions(options, xoOptions, enginesOptions);
		fileOptions.cwd = xoConfigPath && path.dirname(xoConfigPath) !== fileOptions.cwd ? path.resolve(fileOptions.cwd, path.dirname(xoConfigPath)) : fileOptions.cwd;

		const {hash, options: optionsWithOverrides} = applyOverrides(file, fileOptions);
		fileOptions = optionsWithOverrides;

		const prettierOptions = fileOptions.prettier ? await prettier.resolveConfig(file, {editorconfig: true}) || {} : {};

		let tsConfigPath;
		if (isTypescript(file)) {
			let tsConfig;
			const tsConfigExplorer = cosmiconfig([], {searchPlaces: ['tsconfig.json'], loaders: {'.json': (_, content) => JSON5.parse(content)}});
			({config: tsConfig, filepath: tsConfigPath} = await tsConfigExplorer.search(file) || {});

			fileOptions.tsConfigPath = tsConfigPath;
			tsConfigs[tsConfigPath || ''] = tsConfig;
			fileOptions.ts = true;
		}

		const cacheKey = stringify({xoConfigPath, enginesConfigPath, prettierOptions, hash, tsConfigPath: fileOptions.tsConfigPath, ts: fileOptions.ts});
		const cachedGroup = configs.get(cacheKey);

		configs.set(cacheKey, {
			files: [file, ...(cachedGroup ? cachedGroup.files : [])],
			options: cachedGroup ? cachedGroup.options : fileOptions,
			prettierOptions
		});

		return configs;
	}, new Map())).values()];

	await Promise.all(Object.entries(groupBy(groups.filter(({options}) => Boolean(options.ts)), group => group.options.tsConfigPath || '')).map(
		([tsConfigPath, groups]) => {
			const files = [].concat(...groups.map(group => group.files));
			const cachePath = getTsConfigCachePath(files, tsConfigPath);
			groups.forEach(group => {
				group.options.tsConfigPath = cachePath;
			});
			return outputJson(cachePath, makeTSConfig(tsConfigs[tsConfigPath], tsConfigPath, files));
		}
	));

	return groups;
};

const findApplicableConfig = (file, configFiles) => configFiles.find(({filepath}) => isPathInside(file, path.dirname(filepath)));

/**
Generate a unique and consistent path for the temporary `tsconfig.json`.
Hashing based on https://github.com/eslint/eslint/blob/cf38d0d939b62f3670cdd59f0143fd896fccd771/lib/cli-engine/lint-result-cache.js#L30
*/
const getTsConfigCachePath = (files, tsConfigPath) => path.join(
	cacheLocation,
	`tsconfig.${murmur(`${pkg.version}_${nodeVersion}_${stringify({files: files.sort(), tsConfigPath: tsConfigPath})}`).result().toString(36)}.json`
);

const makeTSConfig = (tsConfig, tsConfigPath, files) => {
	const config = {files: files.filter(isTypescript)};

	if (tsConfig) {
		config.extends = tsConfigPath;
		config.include = arrify(tsConfig.include).map(pattern => toAbsoluteGlob(pattern, {cwd: path.dirname(tsConfigPath)}));
	} else {
		Object.assign(config, TSCONFIG_DEFFAULTS);
	}

	return config;
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

/**
Merge option passed via CLI/API via options founf in config files.
*/
const mergeOptions = (options, xoOptions = {}, enginesOptions = {}) => {
	const mergedOptions = normalizeOptions({
		...xoOptions,
		...(enginesOptions && enginesOptions.node && semver.validRange(enginesOptions.node) ? {nodeVersion: enginesOptions.node} : {}),
		...options
	});

	mergedOptions.extensions = DEFAULT_EXTENSION.concat(options.extensions || []);
	mergedOptions.ignores = getIgnores(mergedOptions);

	return mergedOptions;
};

/**
Transform an XO options into ESLint compatible options:
- Apply rules based on XO options (e.g `spaces` => `indent` rules or `semicolon` => `semi` rule).
- Resolve the extended configurations.
- Apply rules based on Prettier config if `prettier` option is `true`.
*/
const buildConfig = (options, prettierOptions) =>
	flow(
		buildXOConfig(options),
		buildTSConfig(options),
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
		if (options.ts) {
			config.rules['@typescript-eslint/indent'] = ['error', spaces, {SwitchCase: 1}];
		} else {
			config.rules.indent = ['error', spaces, {SwitchCase: 1}];
		}

		// Only apply if the user has the React plugin
		if (options.cwd && resolveFrom.silent(options.cwd, 'eslint-plugin-react')) {
			config.plugins = config.plugins.concat('react');
			config.rules['react/jsx-indent-props'] = ['error', spaces];
			config.rules['react/jsx-indent'] = ['error', spaces];
		}
	}

	if (options.semicolon === false && !options.prettier) {
		if (options.ts) {
			config.rules['@typescript-eslint/semi'] = ['error', 'never'];
		} else {
			config.rules.semi = ['error', 'never'];
		}

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

	if (options.ts) {
		config.rules['unicorn/import-style'] = 'off';
	}

	if (options.rules) {
		Object.assign(config.rules, options.rules);
	}

	if (options.parser) {
		config.baseConfig.parser = options.parser;
	}

	config.baseConfig.settings = options.settings || {};
	config.baseConfig.settings['import/resolver'] = gatherImportResolvers(options);

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

			if (name.startsWith('@')) {
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

		if (options.ts) {
			config.baseConfig.extends = config.baseConfig.extends.concat('prettier/@typescript-eslint');
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

const buildTSConfig = options => config => {
	if (options.ts) {
		config.baseConfig.extends = config.baseConfig.extends.concat('xo-typescript');
		config.baseConfig.parser = require.resolve('@typescript-eslint/parser');
		config.baseConfig.parserOptions = {
			warnOnUnsupportedTypeScriptVersion: false,
			ecmaFeatures: {jsx: true},
			project: options.tsConfigPath,
			projectFolderIgnoreList:
				options.parserOptions && options.parserOptions.projectFolderIgnoreList ?
					options.parserOptions.projectFolderIgnoreList :
					[new RegExp(`/node_modules/(?!.*\\.cache/${CACHE_DIR_NAME})`)]
		};

		delete config.tsConfigPath;
		delete config.ts;
	}

	return config;
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
Builds a list of overrides for a particular path, and a hash value.
The hash value is a binary representation of which elements in the `overrides` array apply to the path.

If `overrides.length === 4`, and only the first and third elements apply, then our hash is: 1010 (in binary)
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

const gatherImportResolvers = options => {
	let resolvers = {};

	const resolverSettings = options.settings && options.settings['import/resolver'];
	if (resolverSettings) {
		if (typeof resolverSettings === 'string') {
			resolvers[resolverSettings] = {};
		} else {
			resolvers = {...resolverSettings};
		}
	}

	let webpackResolverSettings;

	if (options.webpack) {
		webpackResolverSettings = options.webpack === true ? {} : options.webpack;
	} else if (!(options.webpack === false || resolvers.webpack)) {
		// If a webpack config file exists, add the import resolver automatically
		const webpackConfigPath = findUp.sync('webpack.config.js', {cwd: options.cwd});
		if (webpackConfigPath) {
			webpackResolverSettings = {config: webpackConfigPath};
		}
	}

	if (webpackResolverSettings) {
		resolvers = {
			...resolvers,
			webpack: {
				...resolvers.webpack,
				...webpackResolverSettings
			}
		};
	}

	return resolvers;
};

module.exports = {
	findApplicableOverrides,
	mergeWithPrettierConfig,
	normalizeOptions,
	getIgnores,
	mergeWithFileConfigs,
	mergeWithFileConfig,
	buildConfig,
	applyOverrides,
	mergeOptions
};
