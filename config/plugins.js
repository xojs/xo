'use strict';
module.exports = {
	plugins: [
		'no-use-extend-native',
		'import-order',
		'ava',
		'xo',
		'promise'
	],
	extends: [
		'plugin:ava/recommended',
		'plugin:xo/recommended'
	],
	rules: {
		'no-use-extend-native/no-use-extend-native': 2,
		'import-order/import-order': 2,
		'promise/param-names': 2
	}
};
