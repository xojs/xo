'use strict';
const path = require('path');
const eslint = require('eslint');
const globby = require('globby');
const isEqual = require('lodash/isEqual');
const micromatch = require('micromatch');
const arrify = require('arrify');
const {DEFAULT_EXTENSION} = require('./lib/constants');
const {
	normalizeOptions,
	getIgnores,
	mergeWithFileConfig,
	mergeWithFileConfigs,
	buildConfig
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

const lintFiles = async (patterns, options) => {
	options = normalizeOptions(options);

	const isEmptyPatterns = patterns.length === 0;
	const defaultPattern = `**/*.{${DEFAULT_EXTENSION.concat(options.extensions || []).join(',')}}`;

	const paths = await globby(
		isEmptyPatterns ? [defaultPattern] : arrify(patterns),
		{
			ignore: getIgnores(options),
			gitignore: true,
			cwd: options.cwd || process.cwd()
		}
	);

	return mergeReports((await mergeWithFileConfigs(paths, options)).map(
		({files, options, prettierOptions}) => runEslint(files, buildConfig(options, prettierOptions)))
	);
};

module.exports = {
	getFormatter: eslint.CLIEngine.getFormatter,
	getErrorResults: eslint.CLIEngine.getErrorResults,
	outputFixes: eslint.CLIEngine.outputFixes,
	lintText,
	lintFiles
};
