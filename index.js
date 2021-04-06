'use strict';
const path = require('path');
const eslint = require('eslint');
const globby = require('globby');
const isEqual = require('lodash/isEqual');
const uniq = require('lodash/uniq');
const micromatch = require('micromatch');
const arrify = require('arrify');
const pReduce = require('p-reduce');
const {cosmiconfig, defaultLoaders} = require('cosmiconfig');
const {CONFIG_FILES, MODULE_NAME, DEFAULT_IGNORES} = require('./lib/constants');
const {
	normalizeOptions,
	getIgnores,
	mergeWithFileConfig,
	mergeWithFileConfigs,
	buildConfig,
	mergeOptions
} = require('./lib/options-manager');

const mergeReports = reports => {
	// Merge multiple reports into a single report
	let results = [];
	let errorCount = 0;
	let warningCount = 0;

	for (const report of reports) {
		results = results.concat(report.results);
		errorCount += report.errorCount;
		warningCount += report.warningCount;
	}

	return {
		errorCount,
		warningCount,
		results
	};
};

const processReport = (report, options) => {
	report.results = options.quiet ? eslint.CLIEngine.getErrorResults(report.results) : report.results;
	return report;
};

const runEslint = (paths, options) => {
	const engine = new eslint.CLIEngine(options);
	const report = engine.executeOnFiles(
		paths.filter(path => !engine.isPathIgnored(path)),
		options
	);
	return processReport(report, options);
};

const globFiles = async (patterns, {ignores, extensions, cwd}) => (
	await globby(
		patterns.length === 0 ? [`**/*.{${extensions.join(',')}}`] : arrify(patterns),
		{ignore: ignores, gitignore: true, cwd}
	)).filter(file => extensions.includes(path.extname(file).slice(1))).map(file => path.resolve(cwd, file));

const getConfig = options => {
	const {options: foundOptions, prettierOptions} = mergeWithFileConfig(normalizeOptions(options));
	options = buildConfig(foundOptions, prettierOptions);
	const engine = new eslint.CLIEngine(options);
	return engine.getConfigForFile(options.filename);
};

const lintText = (string, options) => {
	const {options: foundOptions, prettierOptions} = mergeWithFileConfig(normalizeOptions(options));
	options = buildConfig(foundOptions, prettierOptions);

	if (options.ignores && !isEqual(getIgnores({}), options.ignores) && typeof options.filename !== 'string') {
		throw new Error('The `ignores` option requires the `filename` option to be defined.');
	}

	const engine = new eslint.CLIEngine(options);

	if (options.filename) {
		const filename = path.relative(options.cwd, options.filename);

		if (
			micromatch.isMatch(filename, options.ignores) ||
			globby.gitignore.sync({cwd: options.cwd, ignore: options.ignores})(options.filename) ||
			engine.isPathIgnored(options.filename)
		) {
			return {
				errorCount: 0,
				warningCount: 0,
				results: [{
					errorCount: 0,
					filePath: filename,
					messages: [],
					warningCount: 0
				}]
			};
		}
	}

	const report = engine.executeOnText(string, options.filename);

	return processReport(report, options);
};

const lintFiles = async (patterns, options = {}) => {
	options.cwd = path.resolve(options.cwd || process.cwd());
	const configExplorer = cosmiconfig(MODULE_NAME, {searchPlaces: CONFIG_FILES, loaders: {noExt: defaultLoaders['.json']}, stopDir: options.cwd});

	const configFiles = (await Promise.all(
		(await globby(
			CONFIG_FILES.map(configFile => `**/${configFile}`),
			{ignore: DEFAULT_IGNORES, gitignore: true, cwd: options.cwd}
		)).map(async configFile => configExplorer.load(path.resolve(options.cwd, configFile)))
	)).filter(Boolean);

	const paths = configFiles.length > 0 ?
		await pReduce(
			configFiles,
			async (paths, {filepath, config}) =>
				[...paths, ...(await globFiles(patterns, {...mergeOptions(options, config), cwd: path.dirname(filepath)}))],
			[]) :
		await globFiles(patterns, mergeOptions(options));

	return mergeReports((await mergeWithFileConfigs(uniq(paths), options, configFiles)).map(
		({files, options, prettierOptions}) => runEslint(files, buildConfig(options, prettierOptions)))
	);
};

module.exports = {
	getFormatter: eslint.CLIEngine.getFormatter,
	getErrorResults: eslint.CLIEngine.getErrorResults,
	outputFixes: eslint.CLIEngine.outputFixes,
	getConfig,
	lintText,
	lintFiles
};
