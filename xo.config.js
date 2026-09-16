export default [
	{
		files: ['test/**'],
		rules: {
			// `node:test`'s `test()` returns a promise that the runner tracks itself and is not meant to be awaited.
			'@typescript-eslint/no-floating-promises': 'off',
			// Tests run with an explicit `dist/test/**/*.test.js` glob, so helpers in `test/helpers` are never picked up as test files.
			'node-test/no-import-test-files': 'off',
		},
	},
];
