'use strict';
module.exports = {
	// Repeated here from eslint-config-xo in case some plugins set something different
	parserOptions: {
		ecmaVersion: 2018,
		sourceType: 'module',
		ecmaFeatures: {
			jsx: true
		}
	},
	// -- end repeat
	plugins: [
		'no-use-extend-native',
		'ava',
		'unicorn',
		'promise',
		'import',
		'node'
	],
	extends: [
		'plugin:ava/recommended',
		'plugin:unicorn/recommended'
	],
	settings: {
		'import/core-modules': [
			'electron',
			'atom'
		],
		'import/resolver': {
			'node': {
				'extensions': [
					'.js',
					'.jsx',
					'.ts',
					'.tsx'
				]
			}
		}
	},
	rules: {
		'no-use-extend-native/no-use-extend-native': 'error',
		'promise/param-names': 'error',
		'promise/no-return-wrap': ['error', {allowReject: true}],
		'promise/no-new-statics': 'error',
		'promise/no-return-in-finally': 'error',
		'promise/valid-params': 'error',
		'import/default': 'error',
		'import/export': 'error',
		'import/extensions': ['error', {
			js: 'never',
			json: 'never',
			jsx: 'never'
		}],
		'import/first': 'error',
		'import/named': 'error',
		'import/namespace': ['error', {allowComputed: true}],
		'import/no-absolute-path': 'error',
		'import/no-webpack-loader-syntax': 'error',
		'import/no-self-import': 'error',
		'import/no-useless-path-segments': 'error',
		'import/newline-after-import': 'error',
		'import/no-amd': 'error',
		'import/no-duplicates': 'error',
		// Enable this sometime in the future when Node.js has ES2015 module support
		// 'import/unambiguous': 'error',
		// enable this sometime in the future when Node.js has ES2015 module support
		// 'import/no-commonjs': 'error',
		// Looks useful, but too unstable at the moment
		// 'import/no-deprecated': 'error',
		'import/no-extraneous-dependencies': 'error',
		'import/no-mutable-exports': 'error',
		'import/no-named-as-default-member': 'error',
		'import/no-named-as-default': 'error',
		'import/no-unresolved': ['error', {commonjs: true}],
		'import/order': 'error',
		'import/no-unassigned-import': ['error', {
			allow: ['babel-polyfill', '@babel/polyfill', 'babel-register', '@babel/register']
		}],
		// Redundant with import/no-extraneous-dependencies
		// 'node/no-extraneous-import': 'error',
		// 'node/no-extraneous-require': 'error',
		// Redundant with import/no-unresolved
		// 'node/no-missing-import': 'error',
		// 'node/no-missing-require': 'error',
		'node/no-unpublished-bin': 'error',
		// Disabled because they're too annoying, see:
		// https://github.com/mysticatea/eslint-plugin-node/issues/105
		// 'node/no-unpublished-import': ['error', {allowModules: ['electron', 'atom']}],
		// 'node/no-unpublished-require': ['error', {allowModules: ['electron', 'atom']}],
		// Disabled as the rule doesn't allow to exclude compiled sources
		// 'node/no-unsupported-features': 'error',
		'node/process-exit-as-throw': 'error',
		// Disabled as the rule doesn't exclude scripts executed with `node` but not referenced in "bin". See https://github.com/mysticatea/eslint-plugin-node/issues/96
		// 'node/shebang': 'error',
		'node/no-deprecated-api': 'error'
		// Disabled because it causes too much churn and will be moot when we switch to ES2015 modules
		// 'node/exports-style': ['error', 'module.exports']
	}
};
