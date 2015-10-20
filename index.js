'use strict';
var path = require('path');
var eslint = require('eslint');
var globby = require('globby');
var objectAssign = require('object-assign');
var arrify = require('arrify');
var pkgConf = require('pkg-conf');
var deepAssign = require('deep-assign');

var DEFAULT_IGNORE = [
	'node_modules/**',
	'bower_components/**',
	'coverage/**',
	'{tmp,temp}/**',
	'**/*.min.js',
	'**/bundle.js',
	'fixture.js',
	'{test/,}fixture{s,}/**'
];

var DEFAULT_CONFIG = {
	useEslintrc: false,
	baseConfig: {
		extends: 'xo'
	}
};

function handleOpts(opts) {
	opts = objectAssign({
		cwd: process.cwd()
	}, opts);

	opts = objectAssign({}, pkgConf.sync('xo', opts.cwd), opts);

	// alias to help humans
	opts.envs = opts.envs || opts.env;
	opts.globals = opts.globals || opts.global;
	opts.ignores = opts.ignores || opts.ignore;
	opts.plugins = opts.plugins || opts.plugin;
	opts.rules = opts.rules || opts.rule;

	opts.ignores = DEFAULT_IGNORE.concat(opts.ignores || []);

	opts._config = deepAssign({}, DEFAULT_CONFIG, {
		envs: arrify(opts.envs),
		globals: arrify(opts.globals),
		plugins: arrify(opts.plugins),
		rules: opts.rules
	});

	if (!opts._config.rules) {
		opts._config.rules = {};
	}

	if (opts.space) {
		var spaces = typeof opts.space === 'number' ? opts.space : 2;
		opts._config.rules.indent = [2, spaces, {SwitchCase: 1}];
	}

	if (opts.semicolon === false) {
		opts._config.rules.semi = [2, 'never'];
		opts._config.rules['semi-spacing'] = [2, {before: false, after: true}];
	}

	if (opts.esnext) {
		opts._config.baseConfig = 'xo/esnext';
	}

	return opts;
}

exports.lintText = function (str, opts) {
	opts = handleOpts(opts);

	var engine = new eslint.CLIEngine(opts._config);

	return engine.executeOnText(str, opts.filename);
};

exports.lintFiles = function (patterns, opts) {
	opts = handleOpts(opts);

	if (patterns.length === 0) {
		patterns = '**/*.{js,jsx}';
	}

	return globby(patterns, {ignore: opts.ignores}).then(function (paths) {
		// when users are silly and don't specify an extension in the glob pattern
		paths = paths.filter(function (x) {
			var ext = path.extname(x);
			return ext === '.js' || ext === '.jsx';
		});

		var engine = new eslint.CLIEngine(opts._config);

		return engine.executeOnFiles(paths);
	});
};

exports.getFormatter = eslint.CLIEngine.getFormatter;
exports.getErrorResults = eslint.CLIEngine.getErrorResults;
