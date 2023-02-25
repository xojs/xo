import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import pkg from 'eslint/use-at-your-own-risk'; // eslint-disable-line n/file-extension-in-import
import findCacheDir from 'find-cache-dir';
import {cosmiconfig, defaultLoaders} from 'cosmiconfig';
import {DEFAULT_EXTENSION, CACHE_DIR_NAME, MODULE_NAME} from '../constants.js';
import createConfig from './create-config.js';

const {FlatESLint} = pkg;

// Async loader for es module types
const loadModule = async fp => {
	const {default: module, ignores, tsconfig} = await import(fp);
	module.ignores = ignores;
	module.tsconfig = tsconfig;
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

	const pkgConfigExplorer = cosmiconfig('engines', {searchPlaces: ['package.json'], stopDir: options.cwd});

	if (options.filePath) {
		options.filePath = path.resolve(options.cwd, options.filePath);
	}

	const flatConfigExplorer = cosmiconfig(MODULE_NAME, {
		searchPlaces: [`${MODULE_NAME}.config.js`, `${MODULE_NAME}.config.cjs`, `${MODULE_NAME}.config.mjs`],
		stopDir: options.cwd,
		loaders: {
			'.js': loadModule,
			'.mjs': loadModule,
		},
	});

	const searchPath = options.filePath || options.cwd;

	const [
		{config: globalOptions} = {},
		{config: enginesOptions} = {},
		{config: flatOptions} = {},
	] = await Promise.all([
		globalConfigExplorer.search(searchPath),
		flatConfigExplorer.search(searchPath),
		pkgConfigExplorer.search(searchPath),
	]);

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

	const overrideConfig = await createConfig({
		flatOptions,
		globalOptions,
		enginesOptions,
		cwd: options.cwd,
	});

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
        || path.join(os.homedir() || os.tmpdir(), '.xo-cache/'),
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
		overrideConfig: createConfig(config),
		cache: true,
		cacheLocation: path.join(
			findCacheDir({name: CACHE_DIR_NAME, cwd: options.cwd})
        || path.join(os.homedir() || os.tmpdir(), '.xo-cache/'),
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
