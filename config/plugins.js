'use strict';
module.exports = {
	plugins: [
		'no-empty-blocks',
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
		'no-empty-blocks/no-empty-blocks': [2, 'allowCatch'],
		'no-use-extend-native/no-use-extend-native': 2,
		'import-order/import-order': 2,
		'promise/param-names': 2
	}
};
