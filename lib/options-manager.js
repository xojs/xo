import process from 'node:process';
import os from 'node:os';
import path from 'node:path';
import fsExtra from 'fs-extra';
import arrify from 'arrify';
import {mergeWith, flow, pick} from 'lodash-es';
import pathExists from 'path-exists';
import findUp from 'find-up';
import findCacheDir from 'find-cache-dir';
import prettier from 'prettier';
import semver from 'semver';
import {cosmiconfig, defaultLoaders} from 'cosmiconfig';
import micromatch from 'micromatch';
import JSON5 from 'json5';
import toAbsoluteGlob from 'to-absolute-glob';
import stringify from 'json-stable-stringify-without-jsonify';
import murmur from 'imurmurhash';
import {Legacy} from '@eslint/eslintrc';
import createEsmUtils from 'esm-utils';
import {
	DEFAULT_IGNORES,
	DEFAULT_EXTENSION,
	TYPESCRIPT_EXTENSION,
	ENGINE_RULES,
	MODULE_NAME,
	CONFIG_FILES,
	MERGE_OPTIONS_CONCAT,
	TSCONFIG_DEFAULTS,
	CACHE_DIR_NAME,
} from './constants.js';

const {__dirname, json, require} = createEsmUtils(import.meta);
const {normalizePackageName} = Legacy.naming;
const resolveModule = Legacy.ModuleResolver.resolve;

const resolveFrom = (moduleId, fromDirectory = process.cwd()) => resolveModule(moduleId, path.join(fromDirectory, '__placeholder__.js'));

resolveFrom.silent = (moduleId, fromDirectory) => {
	try {
		return resolveFrom(moduleId, fromDirectory);
	} catch {}
};

const resolveLocalConfig = name => resolveModule(normalizePackageName(name, 'eslint-config'), import.meta.url);

const nodeVersion = process && process.version;
const cacheLocation = cwd => findCacheDir({name: CACHE_DIR_NAME, cwd}) || path.join(os.homedir() || os.tmpdir(), '.xo-cache/');

const DEFAULT_CONFIG = {
	useEslintrc: false,
	cache: true,
	cacheLocation: path.join(cacheLocation(), 'xo-cache.json'),
	globInputPaths: false,
	baseConfig: {
		extends: [
			resolveLocalConfig('xo'),
			path.join(__dirname, '../config/overrides.cjs'),
			path.join(__dirname, '../config/plugins.cjs'),
		],
	},
};

/**
Define the shape of deep properties for `mergeWith`.
*/
const getEmptyConfig = () => ({
	baseConfig: {
		rules: {},
		settings: {},
		globals: {},
		ignorePatterns: [],
		env: {},
		plugins: [],
		extends: [],
	},
});

const getEmptyXOConfig = () => ({
	rules: {},
	settings: {},
	globals: [],
	envs: [],
	plugins: [],
	extends: [],
});

const mergeFn = (previousValue, value, key) => {
	if (Array.isArray(previousValue)) {
		if (MERGE_OPTIONS_CONCAT.includes(key)) {
			return [...previousValue, ...value];
		}

		return value;
	}
};

const isTypescript = file => TYPESCRIPT_EXTENSION.includes(path.extname(file).slice(1));

/**
Find config for `lintText`.
The config files are searched starting from `options.filePath` if defined or `options.cwd` otherwise.
*/
const mergeWithFileConfig = async options => {
	options.cwd = path.resolve(options.cwd || process.cwd());
	const configExplorer = cosmiconfig(MODULE_NAME, {searchPlaces: CONFIG_FILES, loaders: {noExt: defaultLoaders['.json']}, stopDir: options.cwd});
	const pkgConfigExplorer = cosmiconfig('engines', {searchPlaces: ['package.json'], stopDir: options.cwd});
	if (options.filePath) {
		options.filePath = path.resolve(options.cwd, options.filePath);
	}

	const searchPath = options.filePath || options.cwd;

	const {config: xoOptions, filepath: xoConfigPath} = (await configExplorer.search(searchPath)) || {};
	const {config: enginesOptions} = (await pkgConfigExplorer.search(searchPath)) || {};

	options = mergeOptions(options, xoOptions, enginesOptions);
	options.cwd = xoConfigPath && path.dirname(xoConfigPath) !== options.cwd ? path.resolve(options.cwd, path.dirname(xoConfigPath)) : options.cwd;

	if (options.filePath) {
		({options} = applyOverrides(options.filePath, options));
	}

	const prettierOptions = options.prettier ? await prettier.resolveConfig(searchPath, {editorconfig: true}) || {} : {};

	if (options.filePath && isTypescript(options.filePath)) {
		const tsConfigExplorer = cosmiconfig([], {searchPlaces: ['tsconfig.json'], loaders: {'.json': (_, content) => JSON5.parse(content)}});
		const {config: tsConfig, filepath: tsConfigPath} = (await tsConfigExplorer.search(options.filePath)) || {};

		options.tsConfigPath = await getTsConfigCachePath([options.filePath], options.tsConfigPath, options.cwd);
		options.ts = true;
		await fsExtra.outputJson(options.tsConfigPath, makeTSConfig(tsConfig, tsConfigPath, [options.filePath]));
	}

	return {options, prettierOptions};
};

/**
Generate a unique and consistent path for the temporary `tsconfig.json`.
Hashing based on https://github.com/eslint/eslint/blob/cf38d0d939b62f3670cdd59f0143fd896fccd771/lib/cli-engine/lint-result-cache.js#L30
*/
const getTsConfigCachePath = async (files, tsConfigPath, cwd) => {
	const {version} = await json.load('../package.json');
	return path.join(
		cacheLocation(cwd),
		`tsconfig.${murmur(`${version}_${nodeVersion}_${stringify({files: files.sort(), tsConfigPath})}`).result().toString(36)}.json`,
	);
};

const makeTSConfig = (tsConfig, tsConfigPath, files) => {
	const config = {files: files.filter(file => isTypescript(file))};

	if (tsConfig) {
		config.extends = tsConfigPath;
		config.include = arrify(tsConfig.include).map(pattern => toAbsoluteGlob(pattern, {cwd: path.dirname(tsConfigPath)}));
	} else {
		Object.assign(config, TSCONFIG_DEFAULTS);
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
		'extension',
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
Merge option passed via CLI/API via options found in config files.
*/
const mergeOptions = (options, xoOptions = {}, enginesOptions = {}) => {
	const mergedOptions = normalizeOptions({
		...xoOptions,
		...(enginesOptions && enginesOptions.node && semver.validRange(enginesOptions.node) ? {nodeVersion: enginesOptions.node} : {}),
		...options,
	});

	mergedOptions.extensions = DEFAULT_EXTENSION.concat(mergedOptions.extensions || []);
	mergedOptions.ignores = getIgnores(mergedOptions);

	return mergedOptions;
};

/**
Transform an XO options into ESLint compatible options:
- Apply rules based on XO options (e.g `spaces` => `indent` rules or `semicolon` => `semi` rule).
- Resolve the extended configurations.
- Apply rules based on Prettier config if `prettier` option is `true`.
*/
const buildConfig = (options, prettierOptions) => {
	options = normalizeOptions(options);

	if (options.useEslintrc) {
		throw new Error('The `useEslintrc` option is not supported');
	}

	return flow(
		buildESLintConfig(options),
		buildXOConfig(options),
		buildTSConfig(options),
		buildExtendsConfig(options),
		buildPrettierConfig(options, prettierOptions),
	)(mergeWith(getEmptyConfig(), DEFAULT_CONFIG, mergeFn));
};

const toValueMap = (array, value = true) => Object.fromEntries(array.map(item => [item, value]));

const buildESLintConfig = options => config => {
	if (options.rules) {
		config.baseConfig.rules = {
			...config.baseConfig.rules,
			...options.rules,
		};
	}

	if (options.parser) {
		config.baseConfig.parser = options.parser;
	}

	if (options.processor) {
		config.baseConfig.processor = options.processor;
	}

	config.baseConfig.settings = options.settings || {};

	if (options.envs) {
		config.baseConfig.env = {
			...config.baseConfig.env,
			...toValueMap(options.envs),
		};
	}

	if (options.globals) {
		config.baseConfig.globals = {
			...config.baseConfig.globals,
			...toValueMap(options.globals, 'readonly'),
		};
	}

	if (options.plugins) {
		config.baseConfig.plugins = [
			...config.baseConfig.plugins,
			...options.plugins,
		];
	}

	if (options.ignores) {
		config.baseConfig.ignorePatterns = [
			...config.baseConfig.ignorePatterns,
			...options.ignores,
		];
	}

	if (options.parserOptions) {
		config.baseConfig.parserOptions = {
			...config.baseConfig.parserOptions,
			...options.parserOptions,
		};
	}

	return {
		...config,
		...pick(options, ['cwd', 'filePath', 'fix']),
	};
};

const buildXOConfig = options => config => {
	const spaces = normalizeSpaces(options);

	for (const [rule, ruleConfig] of Object.entries(ENGINE_RULES)) {
		for (const minVersion of Object.keys(ruleConfig).sort(semver.rcompare)) {
			if (!options.nodeVersion || semver.intersects(options.nodeVersion, `<${minVersion}`)) {
				config.baseConfig.rules[rule] = ruleConfig[minVersion];
			}
		}
	}

	if (options.nodeVersion) {
		config.baseConfig.rules['node/no-unsupported-features/es-builtins'] = ['error', {version: options.nodeVersion}];
		config.baseConfig.rules['node/no-unsupported-features/es-syntax'] = ['error', {version: options.nodeVersion, ignores: ['modules']}];
		config.baseConfig.rules['node/no-unsupported-features/node-builtins'] = ['error', {version: options.nodeVersion}];
	}

	if (options.space && !options.prettier) {
		if (options.ts) {
			config.baseConfig.rules['@typescript-eslint/indent'] = ['error', spaces, {SwitchCase: 1}];
		} else {
			config.baseConfig.rules.indent = ['error', spaces, {SwitchCase: 1}];
		}

		// Only apply if the user has the React plugin
		if (options.cwd && resolveFrom.silent('eslint-plugin-react', options.cwd)) {
			config.baseConfig.plugins.push('react');
			config.baseConfig.rules['react/jsx-indent-props'] = ['error', spaces];
			config.baseConfig.rules['react/jsx-indent'] = ['error', spaces];
		}
	}

	if (options.semicolon === false && !options.prettier) {
		if (options.ts) {
			config.baseConfig.rules['@typescript-eslint/semi'] = ['error', 'never'];
		} else {
			config.baseConfig.rules.semi = ['error', 'never'];
		}

		config.baseConfig.rules['semi-spacing'] = ['error', {
			before: false,
			after: true,
		}];
	}

	if (options.ts) {
		config.baseConfig.rules['unicorn/import-style'] = 'off';
		config.baseConfig.rules['node/file-extension-in-import'] = 'off';

		// Disabled because of https://github.com/benmosher/eslint-plugin-import/issues/1590
		config.baseConfig.rules['import/export'] = 'off';

		// Does not work when the TS definition exports a default const.
		config.baseConfig.rules['import/default'] = 'off';
	}

	config.baseConfig.settings['import/resolver'] = gatherImportResolvers(options);

	return config;
};

const buildExtendsConfig = options => config => {
	if (options.extends && options.extends.length > 0) {
		const configs = options.extends.map(name => {
			// Don't do anything if it's a filepath
			if (pathExists.sync(name)) {
				return name;
			}

			// Don't do anything if it's a config from a plugin or an internal eslint config
			if (name.startsWith('eslint:') || name.startsWith('plugin:')) {
				return name;
			}

			const returnValue = resolveFrom(normalizePackageName(name, 'eslint-config'), options.cwd);

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
		config.baseConfig.plugins.push('prettier');

		// The prettier plugin overrides ESLint stylistic rules that are handled by Prettier
		config.baseConfig.extends.push('plugin:prettier/recommended');

		// The `prettier/prettier` rule reports errors if the code is not formatted in accordance to Prettier
		config.baseConfig.rules['prettier/prettier'] = ['error', mergeWithPrettierConfig(options, prettierConfig)];
	}

	return config;
};

const mergeWithPrettierConfig = (options, prettierOptions) => {
	if ((options.semicolon === true && prettierOptions.semi === false)
		|| (options.semicolon === false && prettierOptions.semi === true)) {
		throw new Error(`The Prettier config \`semi\` is ${prettierOptions.semi} while XO \`semicolon\` is ${options.semicolon}`);
	}

	if (((options.space === true || typeof options.space === 'number') && prettierOptions.useTabs === true)
		|| ((options.space === false) && prettierOptions.useTabs === false)) {
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
			trailingComma: 'all',
			tabWidth: normalizeSpaces(options),
			useTabs: !options.space,
			semi: options.semicolon !== false,
		},
		prettierOptions,
		mergeFn,
	);
};

const buildTSConfig = options => config => {
	if (options.ts) {
		config.baseConfig.extends.push('xo-typescript');
		config.baseConfig.parser = require.resolve('@typescript-eslint/parser');
		config.baseConfig.parserOptions = {
			...config.baseConfig.parserOptions,
			warnOnUnsupportedTypeScriptVersion: false,
			ecmaFeatures: {jsx: true},
			project: options.tsConfigPath,
			projectFolderIgnoreList:
				options.parserOptions && options.parserOptions.projectFolderIgnoreList
					? options.parserOptions.projectFolderIgnoreList
					: [new RegExp(`/node_modules/(?!.*\\.cache/${CACHE_DIR_NAME})`)],
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

		const {applicable, hash} = findApplicableOverrides(path.relative(options.cwd, file), overrides);

		options = mergeWith(getEmptyXOConfig(), options, ...applicable.map(override => normalizeOptions(override)), mergeFn);
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
		applicable,
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
				...webpackResolverSettings,
			},
		};
	}

	return resolvers;
};

const parseOptions = async options => {
	options = normalizeOptions(options);
	const {options: foundOptions, prettierOptions} = await mergeWithFileConfig(options);
	const {filePath, warnIgnored, ...eslintOptions} = buildConfig(foundOptions, prettierOptions);
	return {
		filePath,
		warnIgnored,
		isQuiet: options.quiet,
		eslintOptions,
	};
};

export {
	parseOptions,
	getIgnores,
	mergeWithFileConfig,

	// For tests
	applyOverrides,
	findApplicableOverrides,
	mergeWithPrettierConfig,
	normalizeOptions,
	buildConfig,
};
