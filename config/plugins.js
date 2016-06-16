'use strict';
module.exports = {
	plugins: [
		'no-use-extend-native',
		'ava',
		'xo',
		'promise',
		'import'
	],
	extends: [
		'plugin:ava/recommended',
		'plugin:xo/recommended'
	],
	settings: {
		'import/extensions': ['.js'] // TODO: remove this when eslint-plugin-import@2 is out
	},
	rules: {
		'no-use-extend-native/no-use-extend-native': 2,
		'promise/param-names': 2,
		// disabled because of https://github.com/benmosher/eslint-plugin-import/issues/268
		// 'import/default': 2,
		'import/export': 2,
		'import/extensions': [2, {
			js: 'never',
			json: 'never',
			jsx: 'never'
		}],
		'import/imports-first': 2,
		// disabled because of https://github.com/benmosher/eslint-plugin-import/issues/268
		// 'import/named': 2,
		'import/namespace': 2,
		'import/newline-after-import': 2,
		'import/no-amd': 2,
		// enable this sometime in the future when Node.js has ES2015 module support
		// 'import/no-commonjs': 2,
		// looks useful, but too unstable at the moment
		// 'import/no-deprecated': 2,
		'import/no-extraneous-dependencies': 2,
		'import/no-mutable-exports': 2,
		'import/no-named-as-default-member': 2,
		'import/no-named-as-default': 2,
		// disabled because of https://github.com/benmosher/eslint-plugin-import/issues/275
		// 'import/no-unresolved': [2, {commonjs: true}],
		'import/order': 2
	}
};
