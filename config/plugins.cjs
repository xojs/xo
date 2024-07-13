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
		'n', // eslint-plugin-node's successor
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
				extendDefaultReplacements: true,
				replacements: {
					// https://thenextweb.com/dd/2020/07/13/linux-kernel-will-no-longer-use-terms-blacklist-and-slave/
					whitelist: {
						include: true,
					},
					blacklist: {
						exclude: true,
					},
					master: {
						main: true,
					},
					slave: {
						secondary: true,
					},

					// Reverse.
					application: {
						app: true,
					},
					applications: {
						apps: true,
					},

					// Disable some that may be too annoying.
					env: false,
					i: false, // Do it at some point, but not ready for it yet. Maybe 2025.

					// Not part of `eslint-plugin-unicorn`. Upstream them at some point.
					bin: {
						binary: true,
					},
					eof: {
						endOfFile: true,
					},
					impl: {
						implement: true,
						implementation: true,
					},
					anim: {
						animation: true,
					},
					calc: {
						calculate: true,
					},
					dict: {
						dictionary: true,
					},
					dup: {
						duplicate: true,
					},
					enc: {
						encode: true,
						encryption: true,
					},
					gen: {
						generate: true,
						general: true,
					},
					gfx: {
						graphics: true,
					},
					inc: {
						increment: true,
					},
					iter: {
						iterate: true,
						iterator: true,
					},
					nav: {
						navigate: true,
						navigation: true,
					},
					norm: {
						normalize: true,
					},
					notif: {
						notification: true,
					},
					perf: {
						performance: true,
					},
					proc: {
						process: true,
					},
					rand: {
						random: true,
					},
					sys: {
						system: true,
					},
					temp: {
						temporary: true,
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

		// Temporarily disabled because of https://github.com/sindresorhus/eslint-plugin-unicorn/issues/2218
		'unicorn/no-empty-file': 'off',

		// TODO: Disabled for now as I don't have time to deal with the backslash that might come from this. Try to enable this rule in 2025.
		'unicorn/no-null': 'off',

		// We only enforce it for single-line statements to not be too opinionated.
		'unicorn/prefer-ternary': [
			'error',
			'only-single-line',
		],

		// It will be disabled in the next version of eslint-plugin-unicorn.
		'unicorn/prefer-json-parse-buffer': 'off',

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
		'import/newline-after-import': [
			'error',
			{
				// TODO: Buggy.
				// considerComments: true,
			},
		],
		'import/no-amd': 'error',
		'import/no-duplicates': [
			'error',
			{
				'prefer-inline': true,
			},
		],

		// We use `unicorn/prefer-module` instead.
		// 'import/no-commonjs': 'error',

		// Looks useful, but too unstable at the moment
		// 'import/no-deprecated': 'error',

		'import/no-empty-named-blocks': 'error',
		'import/no-extraneous-dependencies': [
			'error',
			{
				includeTypes: true,
			},
		],
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

		'import/order': [
			'error',
			{
				groups: [
					'builtin',
					'external',
					'parent',
					'sibling',
					'index',
				],
				'newlines-between': 'never',
				warnOnUnassignedImports: true,
			},
		],
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
		// 'n/no-extraneous-import': 'error',
		// 'n/no-extraneous-require': 'error',

		// Redundant with `import/no-unresolved`.
		// 'n/no-missing-import': 'error', // This rule is also buggy and doesn't support `node:`.
		// 'n/no-missing-require': 'error',

		'n/no-unpublished-bin': 'error',

		// We have this enabled in addition to `import/extensions` as this one has an auto-fix.
		'n/file-extension-in-import': [
			'error',
			'always',
			{
				// TypeScript doesn't yet support using extensions and fails with error TS2691.
				'.ts': 'never',
				'.tsx': 'never',
				'.mts': 'never',
				'.cts': 'never',
			},
		],
		'n/no-mixed-requires': [
			'error',
			{
				grouping: true,
				allowCall: true,
			},
		],
		'n/no-new-require': 'error',
		'n/no-path-concat': 'error',

		// Disabled because they're too annoying, see:
		// https://github.com/mysticatea/eslint-plugin-node/issues/105
		// 'n/no-unpublished-import': [
		// 	'error',
		// 	{
		// 		allowModules: [
		// 			'electron',
		// 			'atom'
		// 		]
		// 	}
		// ],
		// 'n/no-unpublished-require': [
		// 	'error',
		// 	{
		// 		allowModules: [
		// 			'electron',
		// 			'atom'
		// 		]
		// 	}
		// ],

		'n/process-exit-as-throw': 'error',

		// Disabled as the rule doesn't exclude scripts executed with `node` but not referenced in 'bin'. See https://github.com/mysticatea/eslint-plugin-node/issues/96
		// 'n/shebang': 'error',

		'n/no-deprecated-api': 'error',

		// We no longer enforce this as we don't want to use Buffer at all, but sometimes we need to conditionally use the `Buffer` global, but we then don't want the import so the module works cross-platform.
		// 'n/prefer-global/buffer': [
		// 	'error',
		// 	'never',
		// ],

		'n/prefer-global/console': [
			'error',
			'always',
		],
		'n/prefer-global/process': [
			'error',
			'never',
		],
		'n/prefer-global/text-decoder': [
			'error',
			'always',
		],
		'n/prefer-global/text-encoder': [
			'error',
			'always',
		],
		'n/prefer-global/url-search-params': [
			'error',
			'always',
		],
		'n/prefer-global/url': [
			'error',
			'always',
		],
		'n/prefer-promises/dns': 'error',
		'n/prefer-promises/fs': 'error',
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
