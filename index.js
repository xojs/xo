'use strict';
var path = require('path');
var eslint = require('eslint');
var globby = require('globby');
var optsHandler = require('./opts');

function optsToConfig(opts) {
	opts = optsHandler.mergeWithPkgConf(opts);
	opts = optsHandler.normalizeOpts(opts);
	opts.ignores = opts.ignore = optsHandler.DEFAULT_IGNORE.concat(opts.ignores || []);
	return optsHandler.buildConfig(opts);
}

exports.lintText = function (str, opts) {
	opts = optsToConfig(opts);

	var engine = new eslint.CLIEngine(opts);

	return engine.executeOnText(str, opts.filename);
};

exports.lintFiles = function (patterns, opts) {
	opts = optsToConfig(opts);

	if (patterns.length === 0) {
		patterns = '**/*.{js,jsx}';
	}

	return globby(patterns, {ignore: opts.ignores}).then(function (paths) {
		// when users are silly and don't specify an extension in the glob pattern
		paths = paths.filter(function (x) {
			var ext = path.extname(x);
			return ext === '.js' || ext === '.jsx';
		});

		var engine = new eslint.CLIEngine(opts);

		return engine.executeOnFiles(paths);
	});
};

exports.getFormatter = eslint.CLIEngine.getFormatter;
exports.getErrorResults = eslint.CLIEngine.getErrorResults;
exports.outputFixes = eslint.CLIEngine.outputFixes;
