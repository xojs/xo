'use strict';
var path = require('path');
var eslint = require('eslint');
var globby = require('globby');
var optionsManager = require('./options-manager');

exports.lintText = function (str, opts) {
	// need to grab filename here as `buildConfig` excludes unknown options for some reason
	// TODO: find a better way to handle this
	opts = opts || {};
	var filename = opts.filename;

	opts = optionsManager.preprocess(opts);
	opts = optionsManager.buildConfig(opts);

	var engine = new eslint.CLIEngine(opts);

	return engine.executeOnText(str, filename);
};

exports.lintFiles = function (patterns, opts) {
	opts = optionsManager.preprocess(opts);

	if (patterns.length === 0) {
		patterns = '**/*.{js,jsx}';
	}

	return globby(patterns, {ignore: opts.ignores}).then(function (paths) {
		// when users are silly and don't specify an extension in the glob pattern
		paths = paths.filter(function (x) {
			var ext = path.extname(x);
			return ext === '.js' || ext === '.jsx';
		});

		if (!(opts.overrides && opts.overrides.length)) {
			return runEslint(paths, opts);
		}

		var overrides = opts.overrides;
		delete opts.overrides;

		var grouped = optionsManager.groupConfigs(paths, opts, overrides);

		return mergeReports(grouped.map(function (data) {
			return runEslint(data.paths, data.opts);
		}));
	});
};

function mergeReports(reports) {
	// merge multiple reports into a single report
	var results = [];
	var errorCount = 0;
	var warningCount = 0;

	reports.forEach(function (report) {
		results = results.concat(report.results);
		errorCount += report.errorCount;
		warningCount += report.warningCount;
	});

	return {
		errorCount: errorCount,
		warningCount: warningCount,
		results: results
	};
}

function runEslint(paths, opts) {
	var config = optionsManager.buildConfig(opts);
	var engine = new eslint.CLIEngine(config);
	return engine.executeOnFiles(paths, config);
}

exports.getFormatter = eslint.CLIEngine.getFormatter;
exports.getErrorResults = eslint.CLIEngine.getErrorResults;
exports.outputFixes = eslint.CLIEngine.outputFixes;
