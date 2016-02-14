'use strict';
module.exports = {
	// always use the Babel parser so it won't throw
	// on esnext features in normal mode
	parser: 'babel-eslint',
	plugins: ['babel'],
	rules: {
		'generator-star-spacing': 0,
		'arrow-parens': 0,
		'object-curly-spacing': 0,
		'babel/object-curly-spacing': [2, 'never']
	}
};
