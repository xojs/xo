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
	const report = engine.executeOnFiles(paths, config);
	return processReport(report, options);
};

module.exports.lintText = (str, options) => {
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

	if (options.filename) {
		const filename = path.relative(options.cwd, options.filename);

		if (
			multimatch(filename, options.ignores).length > 0 ||
			globby.gitignore.sync({cwd: options.cwd, ignore: options.ignores})(options.filename)
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

	const engine = new eslint.CLIEngine(options);
	const report = engine.executeOnText(str, options.filename);

	return processReport(report, options);
};

module.exports.lintFiles = (patterns, options) => {
	options = optionsManager.preprocess(options);

	const isEmptyPatterns = patterns.length === 0;
	const defaultPattern = `**/*.{${options.extensions.join(',')}}`;

	return globby(
		isEmptyPatterns ? [defaultPattern] : arrify(patterns),
		{
			ignore: options.ignores,
			gitignore: true,
			cwd: options.cwd
		}
	).then(paths => {
		// Filter out unwanted file extensions
		// For silly users that don't specify an extension in the glob pattern
		if (!isEmptyPatterns) {
			paths = paths.filter(filePath => {
				const ext = path.extname(filePath).replace('.', '');
				return options.extensions.includes(ext);
			});
		}

		if (!(options.overrides && options.overrides.length > 0)) {
			return runEslint(paths, options);
		}

		const {overrides} = options;
		delete options.overrides;

		const grouped = optionsManager.groupConfigs(paths, options, overrides);

		return mergeReports(grouped.map(data => runEslint(data.paths, data.options)));
	});
};

module.exports.debugInformation = options => {
	const extensionOptions = optionsManager.getExtensions(options);
	const extensions = extensionOptions.extensions.concat(extensionOptions.extension || []);
	console.log('EXTENSIONS: ' + extensions.join(' | '));

	const ignores = optionsManager.getIgnores(options).ignore; // Display only files ignored by the user
	if (ignores !== undefined) {
		globby(ignores).then(files => {
			files.forEach(file => {
				console.log('IGNORED FILE: ' + file);
			});
		});
	}

	if (options.extend !== undefined) {
		options.extends = [options.extend];
	} else if (Array.isArray(options.extend)) {
		options.extends = [...options.extend];
	} else {
		options.extends = [];
	}

	options.cwd = options.cwd || process.cwd();
	const eslintExtends = optionsManager.buildConfig(options).baseConfig.extends;
	eslintExtends.forEach(extend => {
		console.log('ESLINT EXTENDS: ' + extend);
	});
};

module.exports.getFormatter = eslint.CLIEngine.getFormatter;
module.exports.getErrorResults = eslint.CLIEngine.getErrorResults;
module.exports.outputFixes = eslint.CLIEngine.outputFixes;
