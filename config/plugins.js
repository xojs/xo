'use strict';
module.exports = {
	plugins: [
		'no-empty-blocks',
		'no-use-extend-native',
		'import-order',
		'ava'
	],
	extends: 'plugin:ava/recommended',
	rules: {
		'no-empty-blocks/no-empty-blocks': [2, 'allowCatch'],
		'no-use-extend-native/no-use-extend-native': 2,
		'import-order/import-order': 2
	}
};
