export default [
	{
		files: ['test/**'],
		rules: {
			// `node:test`'s `test()` returns a promise that the runner tracks itself and is not meant to be awaited.
			'@typescript-eslint/no-floating-promises': 'off',
		},
	},
];
