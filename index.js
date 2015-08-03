'use strict';
var path = require('path');
var eslint = require('eslint');
var globby = require('globby');
var lookUp = require('look-up');
var objectAssign = require('object-assign');
var arrify = require('arrify');

var DEFAULT_PATTERNS = [
	'**/*.js',
	'**/*.jsx'
];

var DEFAULT_IGNORE = [
	'node_modules/**',
	'bower_components/**',
	'coverage/**',
	'tmp/**',
	'temp/**',
	'**/*.min.js',
	'**/bundle.js'
];

var DEFAULT_CONFIG = {
	useEslintrc: false,
	configFile: path.join(__dirname, 'rc', '.eslintrc')
};

function handleOpts(opts) {
	opts = objectAssign({
		cwd: process.cwd()
	}, opts);

	var pkgOpts = {};

	try {
		pkgOpts = require(lookUp('package.json', {cwd: opts.cwd})).xo;
	} catch (err) {}

	opts = objectAssign({}, pkgOpts, opts);

	// alias to help humans
	opts.envs = opts.envs || opts.env;
	opts.globals = opts.globals || opts.global;
	opts.ignores = opts.ignores || opts.ignore;
	opts.rules = opts.rules || opts.rule;

	opts.ignores = DEFAULT_IGNORE.concat(opts.ignores || []);

	opts._config = objectAssign({}, DEFAULT_CONFIG, {
		envs: arrify(opts.envs),
		globals: arrify(opts.globals),
		rules: opts.rules
	});

	if (opts.space) {
		if (!opts._config.rules) {
			opts._config.rules = {};
		}

		var spaces = typeof opts.space === 'number' ? opts.space : 2;
		opts._config.rules.indent = [2, spaces, {SwitchCase: 1}];
	}

	if (opts.esnext) {
		opts._config.configFile = path.join(__dirname, 'rc', '.eslintrc-esnext');
	}

	return opts;
}

exports.lintText = function (str, opts) {
	opts = handleOpts(opts);

	var engine = new eslint.CLIEngine(opts._config);
	var ret = engine.executeOnText(str);

	ret._getFormatter = engine.getFormatter;

	return ret;
};

exports.lintFiles = function (patterns, opts, cb) {
	if (typeof opts !== 'object') {
		cb = opts;
		opts = {};
	}

	opts = handleOpts(opts);

	if (patterns.length === 0) {
		patterns = DEFAULT_PATTERNS;
	}

	globby(patterns, {ignore: opts.ignores}, function (err, paths) {
		if (err) {
			cb(err);
			return;
		}

		// when users are silly and don't specify an extension in the glob pattern
		paths = paths.filter(function (x) {
			var ext = path.extname(x);
			return ext === '.js' || ext === '.jsx';
		});

		var ret;
		var engine = new eslint.CLIEngine(opts._config);

		try {
			ret = engine.executeOnFiles(paths);
		} catch (err) {
			cb(err);
			return;
		}

		ret._getFormatter = engine.getFormatter;

		cb(null, ret);
	});
};
