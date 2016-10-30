'use strict';
const path = require('path');
const eslint = require('eslint');
const globby = require('globby');
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

	const engine = new eslint.CLIEngine(opts);
	const report = engine.executeOnText(str, opts.filename);

	return processReport(report, opts);
};

exports.lintFiles = (patterns, opts) => {
	opts = optionsManager.preprocess(opts);

	if (patterns.length === 0) {
		patterns = '**/*';
	}

	return globby(patterns, {'ignore': opts.ignores, 'no-dir': true}).then(paths => {
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
