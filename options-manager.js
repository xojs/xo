'use strict';
const os = require('os');
const path = require('path');
const arrify = require('arrify');
const pkgConf = require('pkg-conf');
const deepAssign = require('deep-assign');
const multimatch = require('multimatch');
const resolveFrom = require('resolve-from');
const pathExists = require('path-exists');
const parseGitignore = require('parse-gitignore');
const globby = require('globby');

const DEFAULT_IGNORE = [
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

const DEFAULT_EXTENSION = [
	'js',
	'jsx'
];

const DEFAULT_EXTENDERS = [
	'xo',
	path.join(__dirname, 'config/overrides.js'),
	path.join(__dirname, 'config/plugins.js')
];

const DEFAULT_CONFIG = {
	useEslintrc: false,
	cache: true,
	cacheLocation: path.join(os.homedir() || os.tmpdir(), '.xo-cache/'),
	baseConfig: {
		extends: []
	}
};

function normalizeOpts(opts) {
	opts = Object.assign({}, opts);

	// alias to help humans
	[
		'env',
		'global',
		'ignore',
		'plugin',
		'rule',
		'setting',
		'extend',
		'extension'
	].forEach(singular => {
		const plural = singular + 's';
		let value = opts[plural] || opts[singular];

		delete opts[singular];

		if (value === undefined) {
			return;
		}

		if (singular !== 'rule' && singular !== 'setting') {
			value = arrify(value);
		}

		opts[plural] = value;
	});

	return opts;
}

function mergeWithPkgConf(opts) {
	opts = Object.assign({cwd: process.cwd()}, opts);
	const conf = pkgConf.sync('xo', {cwd: opts.cwd, skipOnFalse: true});
	return Object.assign({}, conf, opts);
}

// define the shape of deep properties for deepAssign
function emptyOptions() {
	return {
		rules: {},
		settings: {},
		globals: [],
		envs: [],
		plugins: [],
		extends: []
	};
}

function buildConfig(opts) {
	const config = deepAssign(
		emptyOptions(),
		DEFAULT_CONFIG,
		opts
	);

	if (opts.space) {
		const spaces = typeof opts.space === 'number' ? opts.space : 2;
		config.rules.indent = ['error', spaces, {SwitchCase: 1}];

		// only apply if the user has the React plugin
		if (opts.cwd && resolveFrom(opts.cwd, 'eslint-plugin-react')) {
			config.plugins = config.plugins.concat('react');
			config.rules['react/jsx-indent-props'] = ['error', spaces];
			config.rules['react/jsx-indent'] = ['error', spaces];
		}
	}

	if (opts.semicolon === false) {
		config.rules.semi = ['error', 'never'];
		config.rules['semi-spacing'] = ['error', {
			before: false,
			after: true
		}];
	}

	if (opts.esnext !== false) {
		config.baseConfig.extends = ['xo/esnext', path.join(__dirname, 'config/plugins.js')];
	}

	if (opts.rules) {
		Object.assign(config.rules, opts.rules);
	}

	if (opts.settings) {
		config.baseConfig.settings = opts.settings;
	}

	if (opts.parser) {
		config.baseConfig.parser = opts.parser;
	}

	if (!opts.skipDefaultExtenders) {
		config.baseConfig.extends = config.baseConfig.extends.concat(DEFAULT_EXTENDERS);
	}

	if (opts.extends && opts.extends.length > 0) {
		// TODO: this logic needs to be improved, preferably use the same code as ESLint
		// user's configs must be resolved to their absolute paths
		const configs = opts.extends.map(name => {
			// don't do anything if it's a filepath
			if (pathExists.sync(name)) {
				return name;
			}

			// don't do anything if it's a config from a plugin
			if (name.startsWith('plugin:')) {
				return name;
			}

			if (!name.includes('eslint-config-')) {
				name = `eslint-config-${name}`;
			}

			const ret = resolveFrom(opts.cwd, name);

			if (!ret) {
				throw new Error(`Couldn't find ESLint config: ${name}`);
			}

			return ret;
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
	let hash = 0;
	const applicable = [];

	overrides.forEach(override => {
		hash <<= 1;

		if (multimatch(path, override.files).length > 0) {
			applicable.push(override);
			hash |= 1;
		}
	});

	return {
		hash,
		applicable
	};
}

function mergeApplicableOverrides(baseOptions, applicableOverrides) {
	return deepAssign.apply(null, [emptyOptions(), baseOptions].concat(applicableOverrides.map(normalizeOpts)));
}

// Creates grouped sets of merged options together with the paths they apply to.
function groupConfigs(paths, baseOptions, overrides) {
	const map = {};
	const arr = [];

	paths.forEach(x => {
		const data = findApplicableOverrides(x, overrides);

		if (!map[data.hash]) {
			const mergedOpts = mergeApplicableOverrides(baseOptions, data.applicable);
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

function getIgnores(opts) {
	opts.ignores = DEFAULT_IGNORE.concat(opts.ignores || []);

	const gitignores = globby.sync('**/.gitignore', {
		ignore: opts.ignores,
		cwd: opts.cwd || process.cwd()
	});

	const ignores = gitignores
		.map(pathToGitignore => {
			const patterns = parseGitignore(pathToGitignore);
			const base = path.dirname(pathToGitignore);

			return patterns.map(file => path.join(base, file));
		})
		.reduce((a, b) => a.concat(b), []);

	opts.ignores = opts.ignores.concat(ignores);

	return opts;
}

function preprocess(opts) {
	opts = mergeWithPkgConf(opts);
	opts = normalizeOpts(opts);
	opts = getIgnores(opts);
	opts.extensions = DEFAULT_EXTENSION.concat(opts.extensions || []);

	return opts;
}

exports.DEFAULT_IGNORE = DEFAULT_IGNORE;
exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
exports.mergeWithPkgConf = mergeWithPkgConf;
exports.normalizeOpts = normalizeOpts;
exports.buildConfig = buildConfig;
exports.findApplicableOverrides = findApplicableOverrides;
exports.mergeApplicableOverrides = mergeApplicableOverrides;
exports.groupConfigs = groupConfigs;
exports.preprocess = preprocess;
exports.emptyOptions = emptyOptions;
exports.getIgnores = getIgnores;
