'use strict';
module.exports = {
	// always use the Babel parser so it won't throw
	// on esnext features in normal mode
	parser: 'babel-eslint',
	plugins: ['babel'],
	rules: {
		'new-cap': 0,
		'array-bracket-spacing': 0,
		'object-curly-spacing': 0,
		'arrow-parens': 0,
		'babel/new-cap': [2, {newIsCap: true, capIsNew: true}],
		'babel/array-bracket-spacing': [2, 'never'],
		'babel/object-curly-spacing': [2, 'never'],
		'babel/arrow-parens': [2, 'as-needed']
	}
};
