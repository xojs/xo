'use strict';

module.exports = {
	// Repeated here from eslint-config-xo in case some plugins set something different
	parserOptions: {
		ecmaVersion: 2021,
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

		// TODO: Remove this override at some point.
		// It's just here to ease users into readable variable names.
		'unicorn/prevent-abbreviations': [
			'error',
			{
				checkFilenames: false,
				checkDefaultAndNamespaceImports: false,
				checkShorthandImports: false,
				extendDefaultReplacements: false,
				replacements: {
					// https://thenextweb.com/dd/2020/07/13/linux-kernel-will-no-longer-use-terms-blacklist-and-slave/
					whitelist: {
						allowList: true
					},
					blacklist: {
						denyList: true
					},
					master: {
						main: true
					},
					slave: {
						secondary: true
					},

					// Not part of `eslint-plugin-unicorn`
					application: {
						app: true
					},
					applications: {
						apps: true
					},

					// Part of `eslint-plugin-unicorn`
					arr: {
						array: true
					},
					e: {
						error: true,
						event: true
					},
					el: {
						element: true
					},
					elem: {
						element: true
					},
					len: {
						length: true
					},
					msg: {
						message: true
					},
					num: {
						number: true
					},
					obj: {
						object: true
					},
					opts: {
						options: true
					},
					param: {
						parameter: true
					},
					params: {
						parameters: true
					},
					prev: {
						previous: true
					},
					req: {
						request: true
					},
					res: {
						response: true,
						result: true
					},
					ret: {
						returnValue: true
					},
					str: {
						string: true
					},
					temp: {
						temporary: true
					},
					tmp: {
						temporary: true
					},
					val: {
						value: true
					},
					err: {
						error: true
					}
				}
			}
		],

		// TODO: Restore when it becomes safer: https://github.com/sindresorhus/eslint-plugin-unicorn/issues/681
		// 'unicorn/string-content': [
		// 	'error',
		// 	{
		// 		patterns: {
		// 			'': '’',
		// 			[/\.\.\./.source]: '…',
		// 			'->': '→',
		// 			[/^http:\/\//.source]: 'http://'
		// 		}
		// 	}
		// ],

		// The character class sorting is a bit buggy at the moment.
		'unicorn/better-regex': [
			'error',
			{
				sortCharacterClasses: false
			}
		],

		// TODO: Disabled for now until it becomes more stable: https://github.com/sindresorhus/eslint-plugin-unicorn/search?q=consistent-destructuring+is:issue&state=open&type=issues
		'unicorn/consistent-destructuring': 'off',

		// TODO: Disabled for now as I don't have time to deal with the backslash that might come from this. Try to enable this rule in 2021.
		'unicorn/no-null': 'off',

		// We only enforce it for single-line statements to not be too opinionated.
		'unicorn/prefer-ternary': [
			'error',
			'only-single-line'
		],

		// TODO: Remove this override when the rule is more stable.
		'unicorn/consistent-function-scoping': 'off',

		// TODO: Temporarily disabled until it becomes more mature.
		'unicorn/no-useless-undefined': 'off',

		// TODO: Temporarily disabled as the rule is buggy.
		'function-call-argument-newline': 'off',

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
		'promise/prefer-await-to-then': 'error',
		'import/default': 'error',
		'import/export': 'error',
		'import/extensions': [
			'error',
			'always',
			{
				ignorePackages: true,
				// TypeScript doesn't yet support using extensions and fails with error TS2691.
				pattern: {
					ts: 'never',
					tsx: 'never'
				}
			}
		],

		// Disabled as it causes problems with TypeScript when you use mixed ESM and CommonJS.
		// TODO: Enable again when I target only ESM.
		// 'import/first': 'error',

		// Disabled as it doesn't work with TypeScript.
		// This issue and some others: https://github.com/benmosher/eslint-plugin-import/issues/1341
		// 'import/named': 'error',

		'import/namespace': [
			'error',
			{
				allowComputed: true
			}
		],
		'import/no-absolute-path': 'error',
		'import/no-anonymous-default-export': 'error',
		'import/no-named-default': 'error',
		'import/no-webpack-loader-syntax': 'error',
		'import/no-self-import': 'error',

		// Enable this sometime in the future when Node.js has ES2015 module support
		// 'import/no-cycle': 'error'

		'import/no-useless-path-segments': 'error',

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
		// 		commonjs: false
		// 	}
		// ],

		// Disabled because of https://github.com/benmosher/eslint-plugin-import/pull/1651 and other issues.
		// 'import/order': 'error',

		'import/no-unassigned-import': [
			'error',
			{
				allow: [
					'@babel/polyfill',
					'**/register',
					'**/register.*',
					'**/register/**',
					'**/register/**.*',
					'**/*.css',
					'**/*.scss',
					'**/*.sass',
					'**/*.less'
				]
			}
		],

		// Redundant with `import/no-extraneous-dependencies`.
		// 'node/no-extraneous-import': 'error',
		// 'node/no-extraneous-require': 'error',

		// Redundant with `import/no-unresolved`.
		// 'node/no-missing-import': 'error',
		// 'node/no-missing-require': 'error',

		'node/no-unpublished-bin': 'error',

		// We have this enabled in addition to `import/extensions` as this one has an auto-fix.
		'node/file-extension-in-import': [
			'error',
			'always',
			{
				// TypeScript doesn't yet support using extensions and fails with error TS2691.
				'.ts': 'never',
				'.tsx': 'never'
			}
		],
		'node/no-mixed-requires': [
			'error',
			{
				grouping: true,
				allowCall: true
			}
		],
		'node/no-new-require': 'error',
		'node/no-path-concat': 'error',

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
		'node/prefer-global/text-decoder': [
			'error',
			'always'
		],
		'node/prefer-global/text-encoder': [
			'error',
			'always'
		],

		'node/prefer-global/url-search-params': [
			'error',
			'always'
		],
		'node/prefer-global/url': [
			'error',
			'always'
		],
		'node/prefer-promises/dns': 'error',
		'node/prefer-promises/fs': 'error',
		'eslint-comments/disable-enable-pair': [
			'error',
			{
				allowWholeFile: true
			}
		],
		'eslint-comments/no-aggregating-enable': 'error',
		'eslint-comments/no-duplicate-disable': 'error',

		// Disabled as it's already covered by the `unicorn/no-abusive-eslint-disable` rule.
		// 'eslint-comments/no-unlimited-disable': 'error',

		'eslint-comments/no-unused-disable': 'error',
		'eslint-comments/no-unused-enable': 'error'
	}
};
