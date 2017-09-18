'use strict';
module.exports = {
	// Repeated here from eslint-config-xo in case some plugins set something different
	parserOptions: {
		ecmaVersion: 2017,
		sourceType: 'module',
		ecmaFeatures: {
			jsx: true,
			experimentalObjectRestSpread: true
		}
	},
	// -- end repeat
	plugins: [
		'no-use-extend-native',
		'ava',
		'unicorn',
		'promise',
		'import',
		'no-shit'
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
		'promise/param-names': 'error',
		// Enable this sometime in the future when Node.js has async/await support
		// 'promise/prefer-await-to-then': 'error',
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
		'import/newline-after-import': 'error',
		'import/no-amd': 'error',
		'import/no-duplicates': 'error',
		// Enable this sometime in the future when Node.js has ES2015 module support
		// 'import/unambiguous': 'error',
		// enable this sometime in the future when Node.js has ES2015 module support
		// 'import/no-commonjs': 'error',
		// looks useful, but too unstable at the moment
		// 'import/no-deprecated': 'error',
		'import/no-extraneous-dependencies': 'error',
		'import/no-mutable-exports': 'error',
		'import/no-named-as-default-member': 'error',
		'import/no-named-as-default': 'error',
		'import/no-unresolved': ['error', {commonjs: true}],
		'import/order': 'error',
		'import/prefer-default-export': 'error',
		'import/no-unassigned-import': 'error',
		'no-shit/be-polite': ['warn', {nsfw: true}]
	}
};
