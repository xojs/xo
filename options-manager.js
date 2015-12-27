'use strict';
var path = require('path');
var arrify = require('arrify');
var pkgConf = require('pkg-conf');
var deepAssign = require('deep-assign');
var resolveFrom = require('resolve-from');
var objectAssign = require('object-assign');
var homeOrTmp = require('home-or-tmp');
var mutlimatch = require('multimatch');

var DEFAULT_IGNORE = [
	'**/node_modules/**',
	'**/bower_components/**',
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
	'no-empty-blocks',
	'no-use-extend-native'
];

function normalizeOpts(opts) {
	opts = objectAssign({}, opts);
	// alias to help humans
	['env', 'global', 'ignore', 'plugin', 'rule', 'extend'].forEach(function (singular) {
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
	opts = objectAssign({
		cwd: process.cwd()
	}, opts);

	return objectAssign({}, pkgConf.sync('xo', opts.cwd), opts);
}

function buildConfig(opts) {
	var config = deepAssign({}, DEFAULT_CONFIG, {
		envs: opts.envs,
		globals: opts.globals,
		plugins: DEFAULT_PLUGINS.concat(opts.plugins || []),
		rules: opts.rules,
		fix: opts.fix
	});

	if (!config.rules) {
		config.rules = {};
	}

	if (opts.space) {
		var spaces = typeof opts.space === 'number' ? opts.space : 2;
		config.rules.indent = [2, spaces, {SwitchCase: 1}];
	}

	if (opts.semicolon === false) {
		config.rules.semi = [2, 'never'];
		config.rules['semi-spacing'] = [2, {before: false, after: true}];
	}

	if (opts.esnext) {
		config.baseConfig.extends = 'xo/esnext';
	} else {
		// always use the Babel parser so it won't throw
		// on esnext features in normal mode
		config.parser = 'babel-eslint';
		config.plugins = ['babel'].concat(config.plugins);
		config.rules['generator-star-spacing'] = 0;
		config.rules['arrow-parens'] = 0;
		config.rules['object-curly-spacing'] = 0;
		config.rules['babel/object-curly-spacing'] = [2, 'never'];
	}

	if (opts.extends && opts.extends.length > 0) {
		// user's configs must be resolved to their absolute paths
		var configs = opts.extends.map(function (name) {
			if (name.indexOf('eslint-config-') === -1) {
				name = 'eslint-config-' + name;
			}

			return resolveFrom(opts.cwd, name);
		});

		configs.unshift(config.baseConfig.extends);

		config.baseConfig.extends = configs;
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
		if (mutlimatch(path, override.files).length > 0) {
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
