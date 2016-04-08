'use strict';
var path = require('path');
var arrify = require('arrify');
var pkgConf = require('pkg-conf');
var deepAssign = require('deep-assign');
var objectAssign = require('object-assign');
var homeOrTmp = require('home-or-tmp');
var multimatch = require('multimatch');
var resolveFrom = require('resolve-from');
var pathExists = require('path-exists');

var DEFAULT_IGNORE = [
	'**/node_modules/**',
	'**/bower_components/**',
	'coverage/**',
	'{tmp,temp}/**',
	'**/*.min.js',
	'**/bundle.js',
	'fixture{-*,}.{js,jsx}',
	'fixture{s,}/**',
	'{test,tests,spec,__tests__}/fixture{s,}/**',
	'vendor/**',
	'dist/**'
];

var DEFAULT_CONFIG = {
	useEslintrc: false,
	cache: true,
	cacheLocation: path.join(homeOrTmp, '.xo-cache/'),
	baseConfig: {
		extends: [
			'xo',
			path.join(__dirname, 'config/overrides.js'),
			path.join(__dirname, 'config/plugins.js')
		]
	}
};

function normalizeOpts(opts) {
	opts = objectAssign({}, opts);

	// alias to help humans
	[
		'env',
		'global',
		'ignore',
		'plugin',
		'rule',
		'extend'
	].forEach(function (singular) {
		var plural = singular + 's';
		var value = opts[plural] || opts[singular];

		delete opts[singular];

		if (value === undefined) {
			return;
		}

		if (singular !== 'rule') {
			value = arrify(value);
		}

		opts[plural] = value;
	});

	return opts;
}

function mergeWithPkgConf(opts) {
	opts = objectAssign({cwd: process.cwd()}, opts);

	return objectAssign({}, pkgConf.sync('xo', opts.cwd), opts);
}

function buildConfig(opts) {
	var config = deepAssign({}, DEFAULT_CONFIG, {
		envs: opts.envs,
		globals: opts.globals,
		plugins: opts.plugins,
		rules: {},
		fix: opts.fix
	});

	if (opts.space) {
		var spaces = typeof opts.space === 'number' ? opts.space : 2;
		config.rules.indent = [2, spaces, {SwitchCase: 1}];
	}

	if (opts.semicolon === false) {
		config.rules.semi = [2, 'never'];
		config.rules['semi-spacing'] = [2, {before: false, after: true}];
	}

	if (opts.esnext) {
		config.baseConfig.extends = ['xo/esnext', path.join(__dirname, 'config/plugins.js')];
	}

	if (opts.rules) {
		objectAssign(config.rules, opts.rules);
	}

	if (opts.extends && opts.extends.length > 0) {
		// TODO: this logic needs to be improved, preferably use the same code as ESLint
		// user's configs must be resolved to their absolute paths
		var configs = opts.extends.map(function (name) {
			// don't do anything if it's a filepath
			if (pathExists.sync(name)) {
				return name;
			}

			if (name.indexOf('eslint-config-') === -1) {
				name = 'eslint-config-' + name;
			}

			return resolveFrom(opts.cwd, name);
		});

		config.baseConfig.extends = config.baseConfig.extends.concat(configs);
	}

	return config;
}

// Builds a list of overrides for a particular path, and a hash value.
// The hash value is a binary representation of which elements in the `overrides` array apply to the path.
//
// If overrides.length === 4, and only the first and third elements apply, then our hash is: 1010 (in binary)
function findApplicableOverrides(path, overrides) {
	var hash = 0;
	var applicable = [];

	overrides.forEach(function (override) {
		hash <<= 1;

		if (multimatch(path, override.files).length > 0) {
			applicable.push(override);
			hash |= 1;
		}
	});

	return {
		hash: hash,
		applicable: applicable
	};
}

// Creates grouped sets of merged options together with the paths they apply to.
function groupConfigs(paths, baseOptions, overrides) {
	var map = {};
	var arr = [];

	paths.forEach(function (x) {
		var data = findApplicableOverrides(x, overrides);

		if (!map[data.hash]) {
			var mergedOpts = deepAssign.apply(null, [{}, baseOptions].concat(data.applicable));
			delete mergedOpts.files;

			arr.push(map[data.hash] = {
				opts: mergedOpts,
				paths: []
			});
		}

		map[data.hash].paths.push(x);
	});

	return arr;
}

function preprocess(opts) {
	opts = mergeWithPkgConf(opts);
	opts = normalizeOpts(opts);
	opts.ignores = DEFAULT_IGNORE.concat(opts.ignores || []);
	return opts;
}

exports.DEFAULT_IGNORE = DEFAULT_IGNORE;
exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
exports.mergeWithPkgConf = mergeWithPkgConf;
exports.normalizeOpts = normalizeOpts;
exports.buildConfig = buildConfig;
exports.findApplicableOverrides = findApplicableOverrides;
exports.groupConfigs = groupConfigs;
exports.preprocess = preprocess;
