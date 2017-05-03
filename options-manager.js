'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const arrify = require('arrify');
const deepAssign = require('deep-assign');
const globby = require('globby');
const gitIgnore = require('ignore');
const multimatch = require('multimatch');
const pathExists = require('path-exists');
const pkgConf = require('pkg-conf');
const resolveFrom = require('resolve-from');
const slash = require('slash');

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

const DEFAULT_CONFIG = {
	useEslintrc: false,
	cache: true,
	cacheLocation: path.join(os.homedir() || os.tmpdir(), '.xo-cache/'),
	baseConfig: {
		extends: [
			'xo',
			path.join(__dirname, 'config/overrides.js'),
			path.join(__dirname, 'config/plugins.js')
		]
	}
};

const normalizeOpts = opts => {
	opts = Object.assign({}, opts);

	// Aliases for humans
	const aliases = [
		'env',
		'global',
		'ignore',
		'plugin',
		'rule',
		'setting',
		'extend',
		'extension'
	];

	for (const singular of aliases) {
		const plural = singular + 's';
		let value = opts[plural] || opts[singular];

		delete opts[singular];

		if (value === undefined) {
			continue;
		}

		if (singular !== 'rule' && singular !== 'setting') {
			value = arrify(value);
		}

		opts[plural] = value;
	}

	return opts;
};

const mergeWithPkgConf = opts => {
	opts = Object.assign({cwd: process.cwd()}, opts);
	opts.cwd = path.resolve(opts.cwd);
	const conf = pkgConf.sync('xo', {cwd: opts.cwd, skipOnFalse: true});
	return Object.assign({}, conf, opts);
};

// Define the shape of deep properties for deepAssign
const emptyOptions = () => ({
	rules: {},
	settings: {},
	globals: [],
	envs: [],
	plugins: [],
	extends: []
});

const buildConfig = opts => {
	const config = deepAssign(
		emptyOptions(),
		DEFAULT_CONFIG,
		opts
	);

	if (opts.space) {
		const spaces = typeof opts.space === 'number' ? opts.space : 2;
		config.rules.indent = ['error', spaces, {SwitchCase: 1}];

		// Only apply if the user has the React plugin
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
		config.baseConfig.extends = [
			'xo/esnext',
			path.join(__dirname, 'config/plugins.js')
		];
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

	if (opts.extends && opts.extends.length > 0) {
		// TODO: This logic needs to be improved, preferably use the same code as ESLint
		// user's configs must be resolved to their absolute paths
		const configs = opts.extends.map(name => {
			// Don't do anything if it's a filepath
			if (pathExists.sync(name)) {
				return name;
			}

			// Don't do anything if it's a config from a plugin
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
};

// Builds a list of overrides for a particular path, and a hash value.
// The hash value is a binary representation of which elements in the `overrides` array apply to the path.
//
// If overrides.length === 4, and only the first and third elements apply, then our hash is: 1010 (in binary)
const findApplicableOverrides = (path, overrides) => {
	let hash = 0;
	const applicable = [];

	for (const override of overrides) {
		hash <<= 1;

		if (multimatch(path, override.files).length > 0) {
			applicable.push(override);
			hash |= 1;
		}
	}

	return {
		hash,
		applicable
	};
};

const mergeApplicableOverrides = (baseOptions, applicableOverrides) => {
	applicableOverrides = applicableOverrides.map(normalizeOpts);
	const overrides = [emptyOptions(), baseOptions].concat(applicableOverrides);
	return deepAssign.apply(null, overrides);
};

// Creates grouped sets of merged options together with the paths they apply to.
const groupConfigs = (paths, baseOptions, overrides) => {
	const map = {};
	const arr = [];

	for (const x of paths) {
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
	}

	return arr;
};

const getIgnores = opts => {
	opts.ignores = DEFAULT_IGNORE.concat(opts.ignores || []);
	return opts;
};

const mapGitIgnorePatternTo = base => ignore => {
	const negated = ignore.charAt(0) === '!';
	const pattern = path.posix.join(base, negated ? ignore.slice(1) : ignore);
	return negated ? '!' + pattern : pattern;
};

const parseGitIgnore = (content, opts) => {
	const base = slash(path.relative(opts.cwd, path.dirname(opts.fileName)));

	return content
		.split(/\r?\n/)
		.filter(Boolean)
		.filter(l => l.charAt(0) !== '#')
		.map(mapGitIgnorePatternTo(base));
};

const getGitIgnoreFilter = opts => {
	const ignore = opts.ignores || [];
	const cwd = opts.cwd || process.cwd();

	const i = globby.sync('**/.gitignore', {ignore, cwd})
		.reduce((ignores, file) => {
			const fileName = path.join(cwd, file);
			const content = fs.readFileSync(fileName, 'utf8');
			ignores.add(parseGitIgnore(content, {cwd, fileName}));
			return ignores;
		}, gitIgnore());

	return p => !i.ignores(slash(path.relative(cwd, p)));
};

const preprocess = opts => {
	opts = mergeWithPkgConf(opts);
	opts = normalizeOpts(opts);
	opts = getIgnores(opts);
	opts.extensions = DEFAULT_EXTENSION.concat(opts.extensions || []);

	return opts;
};

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
exports.getGitIgnoreFilter = getGitIgnoreFilter;
