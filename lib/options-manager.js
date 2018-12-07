'use strict';
const os = require('os');
const path = require('path');
const arrify = require('arrify');
const mergeWith = require('lodash.mergewith');
const multimatch = require('multimatch');
const pathExists = require('path-exists');
const pkgConf = require('pkg-conf');
const findCacheDir = require('find-cache-dir');
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
	cacheLocation: findCacheDir({name: 'xo'}) || path.join(os.homedir() || os.tmpdir(), '.xo-cache/'),
	globInputPaths: false,
	baseConfig: {
		extends: [
			'xo',
			path.join(__dirname, '../config/overrides.js'),
			path.join(__dirname, '../config/plugins.js')
		]
	}
};

/**
 * Define the rules that are enabled only for specific version of Node.js based on `engines.node` in package.json or the `node-version` option.
 *
 * The keys are rule names and the values are an Object with a valid semver (`4.0.0` is valid `4` is not) as keys and the rule configuration as values.
 *
 * Each entry define the rule config and the minimum Node.js version for which to set it.
 * The entry with the highest version that is compliant with the `engines.node`/`node-version` range will be used.
 *
 * @type {Object}
 *
 * @example
 * ```js
 * {
 * 	'plugin/rule': {
 * 		'6.0.0': ['error', {prop: 'node-6-conf'}],
 * 		'8.0.0': ['error', {prop: 'node-8-conf'}]
 * 	}
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
	'prefer-object-spread': {
		'8.0.0': 'error'
	},
	'node/prefer-global/text-decoder': {
		'11.0.0': [
			'error',
			'always'
		]
	},
	'node/prefer-global/text-encoder': {
		'11.0.0': [
			'error',
			'always'
		]
	},
	'node/prefer-global/url-search-params': {
		'10.0.0': [
			'error',
			'always'
		]
	},
	'node/prefer-global/url': {
		'10.0.0': [
			'error',
			'always'
		]
	}
};

// Keep the same behaviour in mergeWith as deepAssign
const mergeFn = (previousValue, value) => {
	if (Array.isArray(previousValue) && Array.isArray(value)) {
		return value;
	}
};

const normalizeOptions = options => {
	options = Object.assign({}, options);

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
		let value = options[plural] || options[singular];

		delete options[singular];

		if (value === undefined) {
			continue;
		}

		if (singular !== 'rule' && singular !== 'setting') {
			value = arrify(value);
		}

		options[plural] = value;
	}

	return options;
};

const mergeWithPkgConf = options => {
	options = Object.assign({cwd: process.cwd()}, options);
	options.cwd = path.resolve(options.cwd);
	const conf = pkgConf.sync('xo', {cwd: options.cwd, skipOnFalse: true});
	const engines = pkgConf.sync('engines', {cwd: options.cwd});
	return Object.assign({}, conf, {nodeVersion: engines && engines.node && semver.validRange(engines.node)}, options);
};

const normalizeSpaces = options => typeof options.space === 'number' ? options.space : 2;

const mergeWithPrettierConf = (options, prettierOptions) => {
	if ((options.semicolon === true && prettierOptions.semi === false) ||
		(options.semicolon === false && prettierOptions.semi === true)) {
		throw new Error(`The Prettier config \`semi\` is ${prettierOptions.semi} while XO \`semicolon\` is ${options.semicolon}`);
	}

	if (((options.space === true || typeof options.space === 'number') && prettierOptions.useTabs === true) ||
		((options.space === false) && prettierOptions.useTabs === false)) {
		throw new Error(`The Prettier config \`useTabs\` is ${prettierOptions.useTabs} while XO \`space\` is ${options.space}`);
	}

	if (typeof options.space === 'number' && typeof prettierOptions.tabWidth === 'number' && options.space !== prettierOptions.tabWidth) {
		throw new Error(`The Prettier config \`tabWidth\` is ${prettierOptions.tabWidth} while XO \`space\` is ${options.space}`);
	}

	return mergeWith(
		{},
		{
			singleQuote: true,
			bracketSpacing: false,
			jsxBracketSameLine: false,
			trailingComma: 'none',
			tabWidth: normalizeSpaces(options),
			useTabs: !options.space,
			semi: options.semicolon !== false
		},
		prettierOptions,
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

const buildConfig = options => {
	const config = mergeWith(
		emptyOptions(),
		DEFAULT_CONFIG,
		options,
		mergeFn
	);
	const spaces = normalizeSpaces(options);

	// Copy options, since it will be modified
	options = Object.assign({}, options);

	// Reading options.extends should be done first
	if (options.extends && options.extends.length > 0) {
		// TODO: This logic needs to be improved, preferably use the same code as ESLint
		// user's configs must be resolved to their absolute paths
		const configs = options.extends.map(name => {
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

			const ret = resolveFrom(options.cwd, name);

			if (!ret) {
				throw new Error(`Couldn't find ESLint config: ${name}`);
			}

			return ret;
		});

		// Loop through extends and read its xo value.
		// If a xo field exists, copy its value to options.
		configs
			// Skip non-objects (this means xo configs cannot be put inside unresolved extends).
			.filter(config => typeof config === 'object')
			// Pick the xo fields.
			.map(({xo}) => xo || {})
			.forEach(({
				space,
				semicolon,
				prettier,
				nodeVersion,
				// TODO Extensions are not currently handled, I'm unsure on how to do it.
				// extensions,
				esnext
			}) => {
				Object.assign(options, {space, semicolon, prettier, nodeVersion, esnext});
			});

		config.baseConfig.extends = config.baseConfig.extends.concat(configs);
	}

	if (options.nodeVersion) {
		for (const rule of Object.keys(ENGINE_RULES)) {
			// Use the rule value for the highest version that is lower or equal to the oldest version of Node.js supported
			for (const minVersion of Object.keys(ENGINE_RULES[rule]).sort(semver.compare)) {
				if (!semver.intersects(options.nodeVersion, `<${minVersion}`)) {
					config.rules[rule] = ENGINE_RULES[rule][minVersion];
				}
			}
		}
	}

	if (options.space && !options.prettier) {
		config.rules.indent = ['error', spaces, {SwitchCase: 1}];

		// Only apply if the user has the React plugin
		if (options.cwd && resolveFrom.silent(options.cwd, 'eslint-plugin-react')) {
			config.plugins = config.plugins.concat('react');
			config.rules['react/jsx-indent-props'] = ['error', spaces];
			config.rules['react/jsx-indent'] = ['error', spaces];
		}
	}

	if (options.semicolon === false && !options.prettier) {
		config.rules.semi = ['error', 'never'];
		config.rules['semi-spacing'] = ['error', {
			before: false,
			after: true
		}];
	}

	if (options.esnext !== false) {
		config.baseConfig.extends = [
			'xo/esnext',
			path.join(__dirname, '../config/plugins.js')
		];
	}

	if (options.rules) {
		Object.assign(config.rules, options.rules);
	}

	if (options.settings) {
		config.baseConfig.settings = options.settings;
	}

	if (options.parser) {
		config.baseConfig.parser = options.parser;
	}

	// If the user sets the `prettier` options then add the `prettier` plugin and config
	if (options.prettier) {
		// Disable formatting rules conflicting with Prettier
		config.rules['unicorn/number-literal-case'] = 'off';
		// The prettier plugin uses Prettier to format the code with `--fix`
		config.plugins = config.plugins.concat('prettier');
		// The prettier config overrides ESLint stylistic rules that are handled by Prettier
		config.baseConfig.extends = config.baseConfig.extends.concat('prettier');
		// The `prettier/prettier` rule reports errors if the code is not formatted in accordance to Prettier
		config.rules['prettier/prettier'] = [
			'error', mergeWithPrettierConf(options, prettier.resolveConfig.sync(options.cwd || process.cwd()) || {})
		];
		// If the user has the React, Flowtype, or Standard plugin, add the corresponding Prettier rule overrides
		// See https://github.com/prettier/eslint-config-prettier for the list of plugins overrrides
		for (const override of ['react', 'flowtype', 'standard']) {
			if (options.cwd && resolveFrom.silent(options.cwd, `eslint-plugin-${override}`)) {
				config.baseConfig.extends = config.baseConfig.extends.concat(`prettier/${override}`);
			}
		}
	}

	return config;
};

// Builds a list of overrides for a particular path, and a hash value.
// The hash value is a binary representation of which elements in the `overrides` array apply to the path.
//
// If `overrides.length === 4`, and only the first and third elements apply, then our hash is: 1010 (in binary)
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
	applicableOverrides = applicableOverrides.map(override => normalizeOptions(override));
	const overrides = [emptyOptions(), baseOptions].concat(applicableOverrides, mergeFn);
	return mergeWith(...overrides);
};

// Creates grouped sets of merged options together with the paths they apply to.
const groupConfigs = (paths, baseOptions, overrides) => {
	const map = {};
	const array = [];

	for (const x of paths) {
		const data = findApplicableOverrides(x, overrides);

		if (!map[data.hash]) {
			const mergedOptions = mergeApplicableOverrides(baseOptions, data.applicable);
			delete mergedOptions.files;

			array.push(map[data.hash] = {
				options: mergedOptions,
				paths: []
			});
		}

		map[data.hash].paths.push(x);
	}

	return array;
};

const getIgnores = options => {
	options.ignores = DEFAULT_IGNORE.concat(options.ignores || []);
	return options;
};

const preprocess = options => {
	options = mergeWithPkgConf(options);
	options = normalizeOptions(options);
	options = getIgnores(options);
	options.extensions = DEFAULT_EXTENSION.concat(options.extensions || []);
	return options;
};

module.exports.DEFAULT_IGNORE = DEFAULT_IGNORE;
module.exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
module.exports.mergeWithPkgConf = mergeWithPkgConf;
module.exports.mergeWithPrettierConf = mergeWithPrettierConf;
module.exports.normalizeOptions = normalizeOptions;
module.exports.buildConfig = buildConfig;
module.exports.findApplicableOverrides = findApplicableOverrides;
module.exports.mergeApplicableOverrides = mergeApplicableOverrides;
module.exports.groupConfigs = groupConfigs;
module.exports.preprocess = preprocess;
module.exports.emptyOptions = emptyOptions;
module.exports.getIgnores = getIgnores;
