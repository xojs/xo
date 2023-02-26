import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import pkg from 'eslint/use-at-your-own-risk'; // eslint-disable-line n/file-extension-in-import
import findCacheDir from 'find-cache-dir';
import {cosmiconfig, defaultLoaders} from 'cosmiconfig';
import {globby} from 'globby';
import pick from 'lodash.pick';
import {DEFAULT_EXTENSION, CACHE_DIR_NAME, MODULE_NAME, TYPESCRIPT_EXTENSION} from '../constants.js';
import {normalizeOptions} from '../options-manager.js';
import createConfig from './create-config.js';

const {FlatESLint} = pkg;

// Async cosmiconfig loader for es module types
const loadModule = async fp => {
	const {default: module} = await import(fp);
	return module;
};

/**
 * Finds the xo config file
 */
const findXoConfig = async options => {
	options.cwd = options.cwd ?? process.cwd();

	const globalConfigExplorer = cosmiconfig(MODULE_NAME, {
		searchPlaces: ['package.json'],
		loaders: {noExt: defaultLoaders['.json']},
		stopDir: options.cwd,
	});

	const pkgConfigExplorer = cosmiconfig('engines', {
		searchPlaces: ['package.json'],
		stopDir: options.cwd,
	});

	const flatConfigExplorer = cosmiconfig(MODULE_NAME, {
		searchPlaces: [`${MODULE_NAME}.config.js`, `${MODULE_NAME}.config.cjs`, `${MODULE_NAME}.config.mjs`],
		stopDir: options.cwd,
		loaders: {
			'.js': loadModule,
			'.mjs': loadModule,
		},
	});

	if (options.filePath) {
		options.filePath = path.resolve(options.cwd, options.filePath);
	}

	const searchPath = options.filePath || options.cwd;

	let [
		{config: globalOptions = {}},
		{config: flatOptions = []},
		{config: enginesOptions = {}},
	] = await Promise.all([
		(async () => await globalConfigExplorer.search(searchPath) || {})(),
		(async () => await flatConfigExplorer.search(searchPath) || {})(),
		(async () => await pkgConfigExplorer.search(searchPath) || {})(),
	]);

	const globalKeys = ['ignores', 'settings', 'parserOptions', 'prettier', 'semicolon', 'space', 'rules', 'env', 'extension'];
	const flatOnlyKeys = ['plugins'];

	globalOptions = pick(normalizeOptions(globalOptions), globalKeys);
	flatOptions = flatOptions.map(conf => pick(normalizeOptions(conf), [...globalKeys, ...flatOnlyKeys]));

	return {
		globalOptions,
		enginesOptions,
		flatOptions,
	};
};

/**
 * Lint a file or files
 */
const lintFiles = async (globs, options) => {
	options.cwd = options.cwd ?? process.cwd();

	const {flatOptions, globalOptions, enginesOptions} = await findXoConfig(options);

	const files = await globby(
		globs,
		{gitignore: true, absolute: true, cwd: options.cwd},
	);

	const includeTs = files.some(file => TYPESCRIPT_EXTENSION.includes(path.extname(file)));

	const overrideConfig = await createConfig({
		flatOptions,
		globalOptions,
		enginesOptions,
		cwd: options.cwd,
		includeTs,
	});

	// Console.log('overrideConfig', overrideConfig);

	const eslint = new FlatESLint({
		cwd: options.cwd,
		overrideConfigFile: true,
		overrideConfig,
		cache: true,
		cacheLocation: path.join(
			findCacheDir({name: CACHE_DIR_NAME, cwd: options.cwd})
        || path.join(os.homedir() || os.tmpdir(), '.xo-cache/'),
			'flat-xo-cache.json',
		),
	});

	if (!globs || (Array.isArray(globs) && globs.length === 0)) {
		globs = `**/*.{${DEFAULT_EXTENSION.join(',')}}`;
	}

	const results = await eslint.lintFiles(globs);
	return {
		results,
		...results[0],
	};
};

/**
 * Lint a string of text
 */
const lintText = async (code, options) => {
	const config = await findXoConfig(options);
	options.cwd = options.cwd ?? process.cwd();
	const overrideConfig = await createConfig(config);
	const eslint = new FlatESLint({
		cwd: options.cwd,
		overrideConfigFile: true,
		overrideConfig,
		cache: true,
		cacheLocation: path.join(
			findCacheDir({name: CACHE_DIR_NAME, cwd: options.cwd})
        || path.join(os.homedir() || os.tmpdir(), '.flat-xo-cache/'),
			'flat-xo-cache.json',
		),
	});

	const results = await eslint.lintText(code, {
		filePath: options.filePath,
		warnIgnored: options.warnIgnored,
	});

	return {
		results,
		...results[0],
	};
};

const outputFixes = async ({results}) => FlatESLint.outputFixes(results);

const getFormatter = async name => {
	const {format} = await new FlatESLint().loadFormatter(name);
	return format;
};

const getConfig = async options => {
	const config = await findXoConfig(options);
	const eslint = new FlatESLint({
		cwd: options.cwd,
		overrideConfigFile: true,
		overrideConfig: await createConfig(config),
		cache: true,
		cacheLocation: path.join(
			findCacheDir({name: CACHE_DIR_NAME, cwd: options.cwd})
        || path.join(os.homedir() || os.tmpdir(), '.flat-xo-cache/'),
			'flat-xo-cache.json',
		),
	});
	return eslint.calculateConfigForFile(options.filePath);
};

const xo = {
	getFormatter,
	getErrorResults: FlatESLint.getErrorResults,
	outputFixes,
	getConfig,
	lintText,
	lintFiles,
};

export default xo;
