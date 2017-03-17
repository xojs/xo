'use strict';
const path = require('path');
const eslint = require('eslint');
const globby = require('globby');
const isEqual = require('lodash.isequal');
const multimatch = require('multimatch');
const optionsManager = require('./options-manager');

exports.lintText = (str, opts) => {
	opts = optionsManager.preprocess(opts);

	if (opts.overrides && opts.overrides.length > 0) {
		const overrides = opts.overrides;
		delete opts.overrides;

		const filename = path.relative(opts.cwd, opts.filename);

		const foundOverrides = optionsManager.findApplicableOverrides(filename, overrides);
		opts = optionsManager.mergeApplicableOverrides(opts, foundOverrides.applicable);
	}

	opts = optionsManager.buildConfig(opts);
	const defaultIgnores = optionsManager.getIgnores({}).ignores;

	if (opts.ignores && !isEqual(defaultIgnores, opts.ignores) && typeof opts.filename !== 'string') {
		throw new Error('The `ignores` option requires the `filename` option to be defined.');
	}

	if (opts.filename) {
		const gitIgnores = optionsManager.getGitIgnores(opts);
		const filename = path.relative(opts.cwd, opts.filename);
		const glob = [filename].concat(gitIgnores);

		if (multimatch(glob, opts.ignores).length > 0) {
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

	const engine = new eslint.CLIEngine(opts);
	const report = engine.executeOnText(str, opts.filename);

	return processReport(report, opts);
};

exports.lintFiles = (pattern, opts) => {
	opts = optionsManager.preprocess(opts);

	if (pattern.length === 0) {
		pattern = '**/*';
	}

	const gitIgnores = optionsManager.getGitIgnores(opts);
	const patterns = Array.isArray(pattern) ? pattern : [pattern];
	const glob = patterns.concat(gitIgnores);

	return globby(glob, {ignore: opts.ignores}).then(paths => {
		// filter out unwanted file extensions
		// for silly users that don't specify an extension in the glob pattern
		paths = paths.filter(x => {
			// Remove dot before the actual extension
			const ext = path.extname(x).replace('.', '');
			return opts.extensions.indexOf(ext) !== -1;
		});

		if (!(opts.overrides && opts.overrides.length > 0)) {
			return runEslint(paths, opts);
		}

		const overrides = opts.overrides;
		delete opts.overrides;

		const grouped = optionsManager.groupConfigs(paths, opts, overrides);

		return mergeReports(grouped.map(data => runEslint(data.paths, data.opts)));
	});
};

function mergeReports(reports) {
	// merge multiple reports into a single report
	let results = [];
	let errorCount = 0;
	let warningCount = 0;

	reports.forEach(report => {
		results = results.concat(report.results);
		errorCount += report.errorCount;
		warningCount += report.warningCount;
	});

	return {
		errorCount,
		warningCount,
		results
	};
}

function runEslint(paths, opts) {
	const config = optionsManager.buildConfig(opts);
	const engine = new eslint.CLIEngine(config);
	const report = engine.executeOnFiles(paths, config);

	return processReport(report, opts);
}

function processReport(report, opts) {
	report.results = opts.quiet ? eslint.CLIEngine.getErrorResults(report.results) : report.results;
	return report;
}

exports.getFormatter = eslint.CLIEngine.getFormatter;
exports.getErrorResults = eslint.CLIEngine.getErrorResults;
exports.outputFixes = eslint.CLIEngine.outputFixes;
