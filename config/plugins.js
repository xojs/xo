'use strict';

module.exports = {
	// Repeated here from eslint-config-xo in case some plugins set something different
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'module',
		ecmaFeatures: {
			jsx: true
		}
	},
	// -- End repeat
	plugins: [
		'no-use-extend-native',
		'ava',
		'unicorn',
		'promise',
		'import',
		'node',
		'eslint-comments'
	],
	extends: [
		'plugin:ava/recommended',
		'plugin:unicorn/recommended'
	],
	settings: {
		'import/core-modules': [
			'electron',
			'atom'
		]
	},
	rules: {
		'no-use-extend-native/no-use-extend-native': 'error',

		// TODO: Enable this again in the minor XO release.
		// TODO: Remove this override at some point.
		// It's just here to ease users into readable variable names.
		// 'unicorn/prevent-abbreviations': [
		// 	'error',
		// 	{
		// 		checkProperties: false,
		// 		checkFilenames: false,
		// 		replacements: {
		// 			args: false
		// 		}
		// 	}
		// ],

		'promise/param-names': 'error',
		'promise/no-return-wrap': [
			'error',
			{
				allowReject: true
			}
		],
		'promise/no-new-statics': 'error',
		'promise/no-return-in-finally': 'error',
		'promise/valid-params': 'error',

		// TODO: Enable this when XO targets Node.js 8
		// 'promise/prefer-await-to-then': 'error',

		'import/default': 'error',
		'import/export': 'error',
		'import/extensions': [
			'error',
			{
				js: 'never',
				jsx: 'never',
				json: 'always'
			}
		],

		// Disabled as it causes problems with TypeScript when you use mixed ESM and CommonJS
		// TODO: Enable again when I target only ESM
		// 'import/first': 'error',

		// Disabled as it doesn't work with TypeScript
		// This issue and some others: https://github.com/benmosher/eslint-plugin-import/issues/1341
		// 'import/named': 'error',

		'import/namespace': [
			'error',
			{
				allowComputed: true
			}
		],
		'import/no-absolute-path': 'error',
		'import/no-webpack-loader-syntax': 'error',
		'import/no-self-import': 'error',

		// Enable this sometime in the future when Node.js has ES2015 module support
		// 'import/no-cycle': 'error'

		'import/no-useless-path-segments': [
			'error',
			{
				noUselessIndex: true
			}
		],

		// Disabled as it doesn't work with TypeScript
		// 'import/newline-after-import': 'error',

		'import/no-amd': 'error',
		'import/no-duplicates': 'error',

		// Enable this sometime in the future when Node.js has ES2015 module support
		// 'import/unambiguous': 'error',

		// Enable this sometime in the future when Node.js has ES2015 module support
		// 'import/no-commonjs': 'error',

		// Looks useful, but too unstable at the moment
		// 'import/no-deprecated': 'error',

		'import/no-extraneous-dependencies': 'error',
		'import/no-mutable-exports': 'error',
		'import/no-named-as-default-member': 'error',
		'import/no-named-as-default': 'error',

		// Disabled because it's buggy and it also doesn't work with TypeScript
		// 'import/no-unresolved': [
		// 	'error',
		// 	{
		// 		commonjs: true
		// 	}
		// ],

		'import/order': 'error',
		'import/no-unassigned-import': [
			'error',
			{
				allow: [
					'@babel/polyfill',
					'@babel/register'
				]
			}
		],

		// Redundant with import/no-extraneous-dependencies
		// 'node/no-extraneous-import': 'error',
		// 'node/no-extraneous-require': 'error',

		// Redundant with import/no-unresolved
		// 'node/no-missing-import': 'error',
		// 'node/no-missing-require': 'error',

		'node/no-unpublished-bin': 'error',

		// Disabled because they're too annoying, see:
		// https://github.com/mysticatea/eslint-plugin-node/issues/105
		// 'node/no-unpublished-import': [
		// 	'error',
		// 	{
		// 		allowModules: [
		// 			'electron',
		// 			'atom'
		// 		]
		// 	}
		// ],
		// 'node/no-unpublished-require': [
		// 	'error',
		// 	{
		// 		allowModules: [
		// 			'electron',
		// 			'atom'
		// 		]
		// 	}
		// ],

		// Disabled as the rule doesn't allow to exclude compiled sources
		// 'node/no-unsupported-features': 'error',

		'node/process-exit-as-throw': 'error',

		// Disabled as the rule doesn't exclude scripts executed with `node` but not referenced in 'bin'. See https://github.com/mysticatea/eslint-plugin-node/issues/96
		// 'node/shebang': 'error',

		'node/no-deprecated-api': 'error',

		// Disabled because it causes too much churn and will be moot when we switch to ES2015 modules
		// 'node/exports-style': [
		// 	'error',
		// 	'module.exports'
		// ]

		'node/prefer-global/buffer': [
			'error',
			'always'
		],
		'node/prefer-global/console': [
			'error',
			'always'
		],
		'node/prefer-global/process': [
			'error',
			'always'
		],
		// TODO: Enable these when XO targets Node.js 10
		// 'node/prefer-global/text-decoder': [
		// 	'error',
		// 	'always'
		// ],
		// 'node/prefer-global/text-encoder': [
		// 	'error',
		// 	'always'
		// ],
		// 'node/prefer-global/url-search-params': [
		// 	'error',
		// 	'always'
		// ],
		// 'node/prefer-global/url': [
		// 	'error',
		// 	'always'
		// ]
		// 'node/prefer-promises/dns': 'error',
		// 'node/prefer-promises/fs': 'error',

		'eslint-comments/disable-enable-pair': [
			'error',
			{
				allowWholeFile: true
			}
		],
		'eslint-comments/no-aggregating-enable': 'error',
		'eslint-comments/no-duplicate-disable': 'error',

		// Disabled as it's already covered by the `unicorn/no-abusive-eslint-disable` rule
		// 'eslint-comments/no-unlimited-disable': 'error',

		'eslint-comments/no-unused-disable': 'error',
		'eslint-comments/no-unused-enable': 'error'
	}
};
