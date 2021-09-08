'use strict';

module.exports = {
	// Repeated here from eslint-config-xo in case some plugins set something different
	parserOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module',
		ecmaFeatures: {
			jsx: true,
		},
	},
	// -- End repeat
	plugins: [
		'no-use-extend-native',
		'ava',
		'unicorn',
		'promise',
		'import',
		'node',
		'eslint-comments',
	],
	extends: [
		'plugin:ava/recommended',
		'plugin:unicorn/recommended',
	],
	settings: {
		'import/core-modules': [
			'electron',
			'atom',
		],
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
						allowList: true,
					},
					blacklist: {
						denyList: true,
					},
					master: {
						main: true,
					},
					slave: {
						secondary: true,
					},

					// Not part of `eslint-plugin-unicorn`
					application: {
						app: true,
					},
					applications: {
						apps: true,
					},

					// Part of `eslint-plugin-unicorn`
					arr: {
						array: true,
					},
					e: {
						error: true,
						event: true,
					},
					el: {
						element: true,
					},
					elem: {
						element: true,
					},
					len: {
						length: true,
					},
					msg: {
						message: true,
					},
					num: {
						number: true,
					},
					obj: {
						object: true,
					},
					opts: {
						options: true,
					},
					param: {
						parameter: true,
					},
					params: {
						parameters: true,
					},
					prev: {
						previous: true,
					},
					req: {
						request: true,
					},
					res: {
						response: true,
						result: true,
					},
					ret: {
						returnValue: true,
					},
					str: {
						string: true,
					},
					temp: {
						temporary: true,
					},
					tmp: {
						temporary: true,
					},
					val: {
						value: true,
					},
					err: {
						error: true,
					},
				},
			},
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
				sortCharacterClasses: false,
			},
		],

		// TODO: Disabled for now until it becomes more stable: https://github.com/sindresorhus/eslint-plugin-unicorn/search?q=consistent-destructuring+is:issue&state=open&type=issues
		'unicorn/consistent-destructuring': 'off',

		// TODO: Disabled for now as I don't have time to deal with the backslash that might come from this. Try to enable this rule in 2021.
		'unicorn/no-null': 'off',

		// We only enforce it for single-line statements to not be too opinionated.
		'unicorn/prefer-ternary': [
			'error',
			'only-single-line',
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
				allowReject: true,
			},
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
					tsx: 'never',
				},
			},
		],
		'import/first': 'error',

		// Enabled, but disabled on TypeScript (https://github.com/xojs/xo/issues/576)
		'import/named': 'error',

		'import/namespace': [
			'error',
			{
				allowComputed: true,
			},
		],
		'import/no-absolute-path': 'error',
		'import/no-anonymous-default-export': 'error',
		'import/no-named-default': 'error',
		'import/no-webpack-loader-syntax': 'error',
		'import/no-self-import': 'error',
		'import/no-cycle': [
			'error',
			{
				ignoreExternal: true,
			},
		],
		'import/no-useless-path-segments': 'error',
		'import/newline-after-import': 'error',
		'import/no-amd': 'error',
		'import/no-duplicates': 'error',

		// We use `unicorn/prefer-module` instead.
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

		'import/order': 'error',
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
					'**/*.less',
				],
			},
		],

		// Redundant with `import/no-extraneous-dependencies`.
		// 'node/no-extraneous-import': 'error',
		// 'node/no-extraneous-require': 'error',

		// Redundant with `import/no-unresolved`.
		// 'node/no-missing-import': 'error', // This rule is also buggy and doesn't support `node:`.
		// 'node/no-missing-require': 'error',

		'node/no-unpublished-bin': 'error',

		// We have this enabled in addition to `import/extensions` as this one has an auto-fix.
		'node/file-extension-in-import': [
			'error',
			'always',
			{
				// TypeScript doesn't yet support using extensions and fails with error TS2691.
				'.ts': 'never',
				'.tsx': 'never',
			},
		],
		'node/no-mixed-requires': [
			'error',
			{
				grouping: true,
				allowCall: true,
			},
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
		'node/prefer-global/buffer': [
			'error',
			'never',
		],
		'node/prefer-global/console': [
			'error',
			'always',
		],
		'node/prefer-global/process': [
			'error',
			'never',
		],
		'node/prefer-global/text-decoder': [
			'error',
			'always',
		],
		'node/prefer-global/text-encoder': [
			'error',
			'always',
		],
		'node/prefer-global/url-search-params': [
			'error',
			'always',
		],
		'node/prefer-global/url': [
			'error',
			'always',
		],
		'node/prefer-promises/dns': 'error',
		'node/prefer-promises/fs': 'error',
		'eslint-comments/disable-enable-pair': [
			'error',
			{
				allowWholeFile: true,
			},
		],
		'eslint-comments/no-aggregating-enable': 'error',
		'eslint-comments/no-duplicate-disable': 'error',

		// Disabled as it's already covered by the `unicorn/no-abusive-eslint-disable` rule.
		// 'eslint-comments/no-unlimited-disable': 'error',

		'eslint-comments/no-unused-disable': 'error',
		'eslint-comments/no-unused-enable': 'error',
	},
};
