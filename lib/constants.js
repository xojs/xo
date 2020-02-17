const DEFAULT_IGNORES = [
	'**/node_modules/**',
	'**/bower_components/**',
	'flow-typed/**',
	'coverage/**',
	'{tmp,temp}/**',
	'**/*.min.js',
	'vendor/**',
	'dist/**',
	'tap-snapshots/*.js'
];

const DEFAULT_EXTENSION = ['js', 'jsx'];

/**
 * Define the rules config that are overwritten only for specific version of Node.js based on `engines.node` in package.json or the `node-version` option.
 *
 * The keys are rule names and the values are an Object with a valid semver (`4.0.0` is valid `4` is not) as keys and the rule configuration as values.
 *
 * Each entry define the rule config and the maximum Node.js version for which to set it.
 * The entry with the lowest version that is compliant with the `engines.node`/`node-version` range will be used.
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
	'unicorn/prefer-spread': {
		'5.0.0': 'off'
	},
	'unicorn/no-new-buffer': {
		'5.10.0': 'off'
	},
	'prefer-rest-params': {
		'6.0.0': 'off'
	},
	'prefer-destructuring': {
		'6.0.0': 'off'
	},
	'promise/prefer-await-to-then': {
		'7.6.0': 'off'
	},
	'prefer-object-spread': {
		'8.3.0': 'off'
	},
	'node/prefer-global/url-search-params': {
		'10.0.0': 'off'
	},
	'node/prefer-global/url': {
		'10.0.0': 'off'
	},
	'no-useless-catch': {
		'10.0.0': 'off'
	},
	'prefer-named-capture-group': {
		'10.0.0': 'off'
	},
	'node/prefer-global/text-encoder': {
		'11.0.0': 'off'
	},
	'node/prefer-global/text-decoder': {
		'11.0.0': 'off'
	},
	'unicorn/prefer-flat-map': {
		'11.0.0': 'off'
	},
	'node/prefer-promises/dns': {
		'11.14.0': 'off'
	},
	'node/prefer-promises/fs': {
		'11.14.0': 'off'
	}
};

const PRETTIER_CONFIG_OVERRIDE = {
	'@typescript-eslint/eslint-plugin': 'prettier/@typescript-eslint',
	'eslint-plugin-babel': 'prettier/babel',
	'eslint-plugin-flowtype': 'prettier/flowtype',
	'eslint-plugin-react': 'prettier/react',
	'eslint-plugin-standard': 'prettier/standard',
	'eslint-plugin-vue': 'prettier/vue'
};

const MODULE_NAME = 'xo';

const CONFIG_FILES = [
	'package.json',
	`.${MODULE_NAME}rc`,
	`.${MODULE_NAME}rc.json`,
	`.${MODULE_NAME}rc.js`,
	`${MODULE_NAME}.config.js`
];

module.exports = {DEFAULT_IGNORES, DEFAULT_EXTENSION, ENGINE_RULES, PRETTIER_CONFIG_OVERRIDE, MODULE_NAME, CONFIG_FILES};