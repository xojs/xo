'use strict';
var path = require('path');
var eslint = require('eslint');
var globby = require('globby');
var objectAssign = require('object-assign');
var arrify = require('arrify');
var pkgConf = require('pkg-conf');
var deepAssign = require('deep-assign');
var resolveFrom = require('resolve-from');
var homeOrTmp = require('home-or-tmp');

var DEFAULT_IGNORE = [
	'node_modules/**',
	'bower_components/**',
	'coverage/**',
	'{tmp,temp}/**',
	'**/*.min.js',
	'**/bundle.js',
	'fixture{-*,}.{js,jsx}',
	'{test/,}fixture{s,}/**',
	'vendor/**',
	'dist/**'
];

var DEFAULT_CONFIG = {
	useEslintrc: false,
	cache: true,
	cacheLocation: path.join(homeOrTmp, '.xo-cache/'),
	baseConfig: {
		extends: 'xo'
	}
};

var DEFAULT_PLUGINS = [
	'no-empty-blocks'
	// https://github.com/dustinspecker/eslint-plugin-no-use-extend-native/issues/16
	// 'no-use-extend-native'
];

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
	opts.extends = opts.extends || opts.extend;

	opts.extends = arrify(opts.extends);
	opts.ignores = DEFAULT_IGNORE.concat(opts.ignores || []);

	opts._config = deepAssign({}, DEFAULT_CONFIG, {
		envs: arrify(opts.envs),
		globals: arrify(opts.globals),
		plugins: DEFAULT_PLUGINS.concat(opts.plugins || []),
		rules: opts.rules,
		fix: opts.fix
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
		opts._config.baseConfig.extends = 'xo/esnext';
	} else {
		// always use the Babel parser so it won't throw
		// on esnext features in normal mode
		opts._config.parser = 'babel-eslint';
		opts._config.plugins = ['babel'].concat(opts._config.plugins);
		opts._config.rules['generator-star-spacing'] = 0;
		opts._config.rules['arrow-parens'] = 0;
		opts._config.rules['object-curly-spacing'] = 0;
		opts._config.rules['babel/object-curly-spacing'] = [2, 'never'];
	}

	if (opts.extends.length > 0) {
		// user's configs must be resolved to their absolute paths
		var configs = opts.extends.map(function (name) {
			if (name.indexOf('eslint-config-') === -1) {
				name = 'eslint-config-' + name;
			}

			return resolveFrom(opts.cwd, name);
		});

		configs.unshift(opts._config.baseConfig.extends);

		opts._config.baseConfig.extends = configs;
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
exports.outputFixes = eslint.CLIEngine.outputFixes;
