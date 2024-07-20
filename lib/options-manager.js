import {existsSync, promises as fs} from 'node:fs';
import process from 'node:process';
import os from 'node:os';
import path from 'node:path';
import arrify from 'arrify';
import {mergeWith, flow, pick} from 'lodash-es';
import {findUpSync} from 'find-up-simple';
import findCacheDir from 'find-cache-dir';
import prettier from 'prettier';
import semver from 'semver';
import {cosmiconfig, defaultLoaders} from 'cosmiconfig';
import micromatch from 'micromatch';
import stringify from 'json-stable-stringify-without-jsonify';
import {Legacy} from '@eslint/eslintrc';
import createEsmUtils from 'esm-utils';
import MurmurHash3 from 'imurmurhash';
import slash from 'slash';
import {getTsconfig} from 'get-tsconfig';
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

const {__dirname, require} = createEsmUtils(import.meta);
const {normalizePackageName} = Legacy.naming;
const resolveModule = Legacy.ModuleResolver.resolve;

const resolveFrom = (moduleId, fromDirectory = process.cwd()) => resolveModule(moduleId, path.join(fromDirectory, '__placeholder__.js'));

resolveFrom.silent = (moduleId, fromDirectory) => {
	try {
		return resolveFrom(moduleId, fromDirectory);
	} catch {}
};

const resolveLocalConfig = name => resolveModule(normalizePackageName(name, 'eslint-config'), import.meta.url);

const cacheLocation = cwd => findCacheDir({name: CACHE_DIR_NAME, cwd}) || path.join(os.homedir() || os.tmpdir(), '.xo-cache/');

const DEFAULT_CONFIG = {
	useEslintrc: false,
	cache: true,
	cacheLocation: path.join(cacheLocation(), 'xo-cache.json'),
	globInputPaths: false,
	resolvePluginsRelativeTo: __dirname,
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

const mergeFunction = (previousValue, value, key) => {
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

	const configExplorer = cosmiconfig(MODULE_NAME, {
		searchPlaces: CONFIG_FILES,
		loaders: {noExt: defaultLoaders['.json']},
		stopDir: options.cwd,
	});

	const packageConfigExplorer = cosmiconfig('engines', {searchPlaces: ['package.json'], stopDir: options.cwd});
	options.filePath &&= path.resolve(options.cwd, options.filePath);

	const searchPath = options.filePath || options.cwd;
	const {config: xoOptions, filepath: xoConfigPath} = (await configExplorer.search(searchPath)) || {};
	const {config: enginesOptions} = (await packageConfigExplorer.search(searchPath)) || {};

	options = normalizeOptions({
		...xoOptions,
		...(enginesOptions && enginesOptions.node && semver.validRange(enginesOptions.node) ? {nodeVersion: enginesOptions.node} : {}),
		...options,
	});
	options.extensions = [...DEFAULT_EXTENSION, ...(options.extensions || [])];
	options.ignores = getIgnores(options);
	options.cwd = xoConfigPath && path.dirname(xoConfigPath) !== options.cwd ? path.resolve(options.cwd, path.dirname(xoConfigPath)) : options.cwd;

	// Ensure eslint is ran minimal times across all linted files, once for each unique configuration
	// incremental hash of: xo config path + override hash + tsconfig path
	// ensures unique configurations
	options.eslintConfigId = new MurmurHash3(xoConfigPath);
	if (options.filePath) {
		const overrides = applyOverrides(options.filePath, options);
		options = overrides.options;

		if (overrides.hash) {
			options.eslintConfigId = options.eslintConfigId.hash(`${overrides.hash}`);
		}
	}

	const prettierOptions = options.prettier ? await prettier.resolveConfig(searchPath, {editorconfig: true}) || {} : {};

	if (options.filePath && isTypescript(options.filePath)) {
		options = await handleTSConfig(options);
	}

	// Ensure this field ends up as a string
	options.eslintConfigId = options.eslintConfigId.result();

	return {options, prettierOptions};
};

/**
 * Find the tsconfig or create a default config
 * If a config is found but it doesn't cover the file as needed by parserOptions.project
 * we create a temp config for that file that extends the found config. If no config is found
 * for a file we apply a default config.
 */
const handleTSConfig = async options => {
	// We can skip looking up the tsconfig if we have it defined
	// in our parser options already. Otherwise we can look it up and create it as normal
	options.ts = true;
	options.tsConfig = {};
	options.tsConfigPath = '';

	const {project: tsConfigProjectPath} = options.parserOptions || {};

	if (tsConfigProjectPath) {
		options.tsConfigPath = path.resolve(options.cwd, tsConfigProjectPath);
		options.tsConfig = tsConfigResolvePaths(getTsconfig(options.tsConfigPath).config, options.tsConfigPath);
	} else {
		const {config: tsConfig, path: filepath} = getTsconfig(options.filePath) || {};
		options.tsConfigPath = filepath;
		options.tsConfig = tsConfig;
		if (options.tsConfigPath) {
			options.tsConfig = tsConfigResolvePaths(tsConfig, options.tsConfigPath);
		} else {
			delete options.tsConfig;
		}
	}

	let hasMatch;

	// If there is no files or include property - ts uses **/* as default so all TS files are matched
	// in tsconfig, excludes override includes - so we need to prioritize that matching logic
	if (
		options.tsConfig
		&& !options.tsConfig.include
		&& !options.tsConfig.files
	) {
		// If we have an excludes property, we need to check it
		// If we match on excluded, then we definitively know that there is no tsconfig match
		if (Array.isArray(options.tsConfig.exclude)) {
			const exclude = options.tsConfig && Array.isArray(options.tsConfig.exclude) ? options.tsConfig.exclude : [];
			hasMatch = !micromatch.contains(options.filePath, exclude);
		} else {
			// Not explicitly excluded and included by tsconfig defaults
			hasMatch = true;
		}
	} else {
		// We have either and include or a files property in tsconfig
		const include = options.tsConfig && Array.isArray(options.tsConfig.include) ? options.tsConfig.include : [];
		const files = options.tsConfig && Array.isArray(options.tsConfig.files) ? options.tsConfig.files : [];
		const exclude = options.tsConfig && Array.isArray(options.tsConfig.exclude) ? options.tsConfig.exclude : [];
		// If we also have an exlcude we need to check all the arrays, (files, include, exclude)
		// this check not excluded and included in one of the file/include array
		hasMatch = !micromatch.contains(options.filePath, exclude)
			&& micromatch.contains(options.filePath, [...include, ...files]);
	}

	if (!hasMatch) {
		// Only use our default tsconfig if no other tsconfig is found - otherwise extend the found config for linting
		options.tsConfig = options.tsConfigPath ? {extends: options.tsConfigPath} : TSCONFIG_DEFAULTS;
		options.tsConfigHash = new MurmurHash3(stringify(options.tsConfig)).result();
		options.tsConfigPath = path.join(
			cacheLocation(options.cwd),
			`tsconfig.${options.tsConfigHash}.json`,
		);
	}

	options.eslintConfigId = options.eslintConfigId.hash(options.tsConfigPath);

	return options;
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
	)(mergeWith(getEmptyConfig(), DEFAULT_CONFIG, mergeFunction));
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
		config.baseConfig.rules['n/no-unsupported-features/es-builtins'] ??= ['error', {version: options.nodeVersion}];
		config.baseConfig.rules['n/no-unsupported-features/es-syntax'] ??= ['error', {version: options.nodeVersion, ignores: ['modules']}];
		config.baseConfig.rules['n/no-unsupported-features/node-builtins'] ??= ['error', {version: options.nodeVersion}];
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

		// Disabled as it doesn't work with TypeScript.
		// This issue and some others: https://github.com/benmosher/eslint-plugin-import/issues/1341
		config.baseConfig.rules['import/named'] = 'off';
	}

	config.baseConfig.settings['import/resolver'] = gatherImportResolvers(options);

	return config;
};

const buildExtendsConfig = options => config => {
	if (options.extends && options.extends.length > 0) {
		const configs = options.extends.map(name => {
			// Don't do anything if it's a filepath
			if (existsSync(path.resolve(options.cwd || process.cwd(), name))) {
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
			bracketSameLine: false,
			trailingComma: 'all',
			tabWidth: normalizeSpaces(options),
			useTabs: !options.space,
			semi: options.semicolon !== false,
		},
		prettierOptions,
		mergeFunction,
	);
};

const buildTSConfig = options => config => {
	if (options.ts) {
		config.baseConfig.extends.push(require.resolve('eslint-config-xo-typescript'));
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
	}

	return config;
};

const applyOverrides = (file, options) => {
	if (options.overrides && options.overrides.length > 0) {
		const {overrides} = options;
		delete options.overrides;

		const {applicable, hash} = findApplicableOverrides(path.relative(options.cwd, file), overrides);

		options = mergeWith(getEmptyXOConfig(), options, ...applicable.map(override => normalizeOptions(override)), mergeFunction);
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
		hash <<= 1; // eslint-disable-line no-bitwise -- Intentional bitwise usage

		if (micromatch.isMatch(path, override.files)) {
			applicable.push(override);
			hash |= 1; // eslint-disable-line no-bitwise -- Intentional bitwise usage
		}
	}

	return {
		hash,
		applicable,
	};
};

const getIgnores = ({ignores}) => [...DEFAULT_IGNORES, ...(ignores || [])];

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
		const webpackConfigPath = findUpSync('webpack.config.js', {cwd: options.cwd});
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
	const {eslintConfigId, tsConfigHash, tsConfig, tsConfigPath} = foundOptions;
	const {filePath, warnIgnored, ...eslintOptions} = buildConfig(foundOptions, prettierOptions);
	return {
		filePath,
		warnIgnored,
		isQuiet: options.quiet,
		eslintOptions,
		eslintConfigId,
		tsConfigHash,
		tsConfigPath,
		tsConfig,
	};
};

const getOptionGroups = async (files, options) => {
	const allOptions = await Promise.all(
		arrify(files).map(filePath => parseOptions({...options, filePath})),
	);

	const tsGroups = {};
	const optionGroups = {};
	for (const options of allOptions) {
		if (Array.isArray(optionGroups[options.eslintConfigId])) {
			optionGroups[options.eslintConfigId].push(options);
		} else {
			optionGroups[options.eslintConfigId] = [options];
		}

		if (options.tsConfigHash) {
			if (Array.isArray(tsGroups[options.tsConfigHash])) {
				tsGroups[options.tsConfigHash].push(options);
			} else {
				tsGroups[options.tsConfigHash] = [options];
			}
		}
	}

	await Promise.all(Object.values(tsGroups).map(async tsGroup => {
		await fs.mkdir(path.dirname(tsGroup[0].tsConfigPath), {recursive: true});
		await fs.writeFile(tsGroup[0].tsConfigPath, JSON.stringify({
			...tsGroup[0].tsConfig,
			files: tsGroup.map(o => o.filePath),
			include: [],
			exclude: [],
		}));
	}));

	// Files with same `xoConfigPath` can lint together
	// https://github.com/xojs/xo/issues/599
	return optionGroups;
};

// Convert all include, files, and exclude to absolute paths
// and or globs. This works because ts only allows simple glob subset
const tsConfigResolvePaths = (tsConfig, tsConfigPath) => {
	const tsConfigDirectory = path.dirname(tsConfigPath);

	if (Array.isArray(tsConfig.files)) {
		tsConfig.files = tsConfig.files.map(
			filePath => slash(path.resolve(tsConfigDirectory, filePath)),
		);
	}

	if (Array.isArray(tsConfig.include)) {
		tsConfig.include = tsConfig.include.map(
			globPath => slash(path.resolve(tsConfigDirectory, globPath)),
		);
	}

	if (Array.isArray(tsConfig.exclude)) {
		tsConfig.exclude = tsConfig.exclude.map(
			globPath => slash(path.resolve(tsConfigDirectory, globPath)),
		);
	}

	return tsConfig;
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
	getOptionGroups,
	handleTSConfig,
	tsConfigResolvePaths,
};
