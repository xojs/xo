'use strict';
module.exports = {
	// repeated here from eslint-config-xo in case some plugins set something different
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
		'import'
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
		'no-use-extend-native/no-use-extend-native': 2,
		'promise/param-names': 2,
		'import/default': 2,
		'import/export': 2,
		'import/extensions': [2, {
			js: 'never',
			json: 'never',
			jsx: 'never'
		}],
		'import/first': 2,
		'import/named': 2,
		'import/namespace': [2, {allowComputed: true}],
		'import/no-absolute-path': 2,
		'import/no-dynamic-require': 2,
		'import/no-webpack-loader-syntax': 2,
		'import/newline-after-import': 2,
		'import/no-amd': 2,
		// enable this sometime in the future when Node.js has ES2015 module support
		// 'import/unambiguous': 2,
		// enable this sometime in the future when Node.js has ES2015 module support
		// 'import/no-commonjs': 2,
		// looks useful, but too unstable at the moment
		// 'import/no-deprecated': 2,
		'import/no-extraneous-dependencies': 2,
		'import/no-mutable-exports': 2,
		'import/no-named-as-default-member': 2,
		'import/no-named-as-default': 2,
		'import/no-unresolved': [2, {commonjs: true}],
		'import/order': 2,
		'import/prefer-default-export': 2,
		'import/no-unassigned-import': 2
	}
};
