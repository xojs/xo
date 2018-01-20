'use strict';
const os = require('os');
const path = require('path');
const arrify = require('arrify');
const mergeWith = require('lodash.mergewith');
const multimatch = require('multimatch');
const pathExists = require('path-exists');
const pkgConf = require('pkg-conf');
const resolveFrom = require('resolve-from');
const prettier = require('prettier');
const semver = require('semver');

const DEFAULT_IGNORE = [
	'**/node_modules/**',
	'**/bower_components/**',
	'flow-typed/**',
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
			path.join(__dirname, '../config/overrides.js'),
			path.join(__dirname, '../config/plugins.js')
		]
	}
};

/**
 * Define the rules that are enabled only for specific version of Node, based on `engines.node` in package.json or the `node-version` option.
 *
 * The keys are rule names and the values are an Object with a valid semver (`4.0.0` is valid `4` is not) as keys and the rule configuration as values.
 * Each entry define the rule configuration and the minimum Node version for which to set it.
 * The entry with the highest version that is compliant with the `engines.node`/`node-version` range will be used.
 *
 * @type {Object}
 *
 * @example
 * ```javascript
 * {
 * 	'plugin/rule': {
 * 		'6.0.0': ['error', {prop: 'node-6-conf'}],
 *		'8.0.0': ['error', {prop: 'node-8-conf'}]
 * 		}
 * }
 *```
 * With `engines.node` set to `>=4` the rule `plugin/rule` will not be used.
 * With `engines.node` set to `>=6` the rule `plugin/rule` will be used with the config `{prop: 'node-6-conf'}`.
 * With `engines.node` set to `>=8` the rule `plugin/rule` will be used with the config `{prop: 'node-8-conf'}`.
 */
const ENGINE_RULES = {
	'promise/prefer-await-to-then': {
		'7.6.0': 'error'
	},
	'prefer-rest-params': {
		'6.0.0': 'error'
	},
	'unicorn/prefer-spread': {
		'5.0.0': 'error'
	},
	'prefer-destructuring': {
		'6.0.0': ['error', {array: true, object: true}, {enforceForRenamedProperties: true}]
	},
	'unicorn/no-new-buffer': {
		'5.10.0': 'error'
	}
};

// Keep the same behaviour in mergeWith as deepAssign
const mergeFn = (prev, val) => {
	if (Array.isArray(prev) && Array.isArray(val)) {
		return val;
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
	const engines = pkgConf.sync('engines', {cwd: opts.cwd});
	return Object.assign({}, conf, {engines}, opts);
};

const normalizeSpaces = opts => {
	return typeof opts.space === 'number' ? opts.space : 2;
};

const mergeWithPrettierConf = opts => {
	return mergeWith(
		{},
		{
			singleQuote: true,
			trailingComma: opts.esnext === false ? 'none' : 'es5',
			bracketSpacing: false,
			jsxBracketSameLine: false
		},
		prettier.resolveConfig.sync(opts.cwd || process.cwd()),
		{tabWidth: normalizeSpaces(opts), useTabs: !opts.space, semi: opts.semicolon !== false},
		mergeFn
	);
};

// Define the shape of deep properties for mergeWith
const emptyOptions = () => ({
	rules: {},
	settings: {},
	globals: [],
	envs: [],
	plugins: [],
	extends: []
});

const buildConfig = opts => {
	const config = mergeWith(
		emptyOptions(),
		DEFAULT_CONFIG,
		opts,
		mergeFn
	);
	const spaces = normalizeSpaces(opts);

	if (opts.engines && opts.engines.node && semver.validRange(opts.engines.node)) {
		for (const rule of Object.keys(ENGINE_RULES)) {
			// Use the rule value for the highest version that is lower or equal to the oldest version of Node supported
			for (const minVersion of Object.keys(ENGINE_RULES[rule]).sort(semver.compare)) {
				if (!semver.intersects(opts.engines.node, `<${minVersion}`)) {
					config.rules[rule] = ENGINE_RULES[rule][minVersion];
				}
			}
		}
	}

	if (opts.space) {
		config.rules.indent = ['error', spaces, {SwitchCase: 1}];

		// Only apply if the user has the React plugin
		if (opts.cwd && resolveFrom.silent(opts.cwd, 'eslint-plugin-react')) {
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
			path.join(__dirname, '../config/plugins.js')
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

	// If the user sets the `prettier` options then add the `prettier` plugin and config
	if (opts.prettier) {
		// The prettier plugin uses Prettier to format the code with `--fix`
		config.plugins = config.plugins.concat('prettier');
		// The prettier config overrides ESLint stylistic rules that are handled by Prettier
		config.baseConfig.extends = config.baseConfig.extends.concat('prettier');
		// The `prettier/prettier` rule reports errors if the code is not formatted in accordance to Prettier
		config.rules['prettier/prettier'] = ['error', mergeWithPrettierConf(opts)];
		// If the user has the React, Flowtype or Standard plugin, add the corresponding Prettier rule overrides
		// See https://github.com/prettier/eslint-config-prettier for the list of plugins overrrides
		for (const override of ['react', 'flowtype', 'standard']) {
			if (opts.cwd && resolveFrom.silent(opts.cwd, `eslint-plugin-${override}`)) {
				config.baseConfig.extends = config.baseConfig.extends.concat(`prettier/${override}`);
			}
		}
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
	applicableOverrides = applicableOverrides.map(override => normalizeOpts(override));
	const overrides = [emptyOptions(), baseOptions].concat(applicableOverrides, mergeFn);
	return mergeWith.apply(null, overrides);
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

const preprocess = opts => {
	opts = mergeWithPkgConf(opts);
	opts = normalizeOpts(opts);
	opts.extensions = DEFAULT_EXTENSION.concat(opts.extensions || []);

	return opts;
};

module.exports.DEFAULT_IGNORE = DEFAULT_IGNORE;
module.exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
module.exports.mergeWithPkgConf = mergeWithPkgConf;
module.exports.mergeWithPrettierConf = mergeWithPrettierConf;
module.exports.normalizeOpts = normalizeOpts;
module.exports.buildConfig = buildConfig;
module.exports.findApplicableOverrides = findApplicableOverrides;
module.exports.mergeApplicableOverrides = mergeApplicableOverrides;
module.exports.groupConfigs = groupConfigs;
module.exports.preprocess = preprocess;
module.exports.emptyOptions = emptyOptions;
