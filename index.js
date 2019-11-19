'use strict';
const path = require('path');
const eslint = require('eslint');
const globby = require('globby');
const isEqual = require('lodash.isequal');
const multimatch = require('multimatch');
const arrify = require('arrify');
const optionsManager = require('./lib/options-manager');

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
	const config = optionsManager.buildConfig(options);
	const engine = new eslint.CLIEngine(config);
	const report = engine.executeOnFiles(
		paths.filter(path => !engine.isPathIgnored(path)),
		config
	);
	return processReport(report, options);
};

module.exports.lintText = (string, options) => {
	options = optionsManager.preprocess(options);

	if (options.overrides && options.overrides.length > 0) {
		const {overrides} = options;
		delete options.overrides;

		const filename = path.relative(options.cwd, options.filename);

		const foundOverrides = optionsManager.findApplicableOverrides(filename, overrides);
		options = optionsManager.mergeApplicableOverrides(options, foundOverrides.applicable);
	}

	options = optionsManager.buildConfig(options);
	const defaultIgnores = optionsManager.getIgnores({}).ignores;

	if (options.ignores && !isEqual(defaultIgnores, options.ignores) && typeof options.filename !== 'string') {
		throw new Error('The `ignores` option requires the `filename` option to be defined.');
	}

	const engine = new eslint.CLIEngine(options);

	if (options.filename) {
		const filename = path.relative(options.cwd, options.filename);

		if (
			multimatch(filename, options.ignores).length > 0 ||
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

module.exports.lintFiles = async (patterns, options) => {
	options = optionsManager.preprocess(options);

	const isEmptyPatterns = patterns.length === 0;
	const defaultPattern = `**/*.{${options.extensions.join(',')}}`;

	let paths = await globby(
		isEmptyPatterns ? [defaultPattern] : arrify(patterns),
		{
			ignore: options.ignores,
			gitignore: true,
			cwd: options.cwd
		}
	);
	paths = paths.map(x => path.relative(options.cwd, path.resolve(options.cwd, x)));

	// Filter out unwanted file extensions
	// For silly users that don't specify an extension in the glob pattern
	if (!isEmptyPatterns) {
		paths = paths.filter(filePath => {
			const extension = path.extname(filePath).replace('.', '');
			return options.extensions.includes(extension);
		});
	}

	if (!(options.overrides && options.overrides.length > 0)) {
		return runEslint(paths, options);
	}

	const {overrides} = options;
	delete options.overrides;

	const grouped = optionsManager.groupConfigs(paths, options, overrides);

	return mergeReports(grouped.map(data => runEslint(data.paths, data.options)));
};

module.exports.getFormatter = eslint.CLIEngine.getFormatter;
module.exports.getErrorResults = eslint.CLIEngine.getErrorResults;
module.exports.outputFixes = eslint.CLIEngine.outputFixes;
