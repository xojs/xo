/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */

import _test, {type TestFn} from 'ava'; // eslint-disable-line ava/use-test
import {preProcessXoConfig, matchFilesForTsConfig} from '../../lib/utils.js';
import {type XoConfigItem} from '../../lib/types.js';
import {allFilesGlob, jsFilesGlob, tsFilesGlob} from '../../lib/constants.js';

const test = _test as TestFn<{cwd: string; files: string[]}>;

// These tests are designed to validate the functionality of the utility functions in the `utils.js` file.
// These utility functions are used together in xo in a specific way, so the tests are structured to ensure that they work correctly in that context.
// each test checks the integration of the utility functions together, rather than testing them in isolation.

test.beforeEach(t => {
	// Set a fake working directory for the tests
	t.context.cwd = '/path/to/project';
	// Represents a set of files in a project directory, including all supported TypeScript and JavaScript files.
	t.context.files = [
		'/path/to/project/index.ts',
		'/path/to/project/index.test.ts',
		'/path/to/project/index.mts',
		'/path/to/project/index.cts',
		'/path/to/project/index.tsx',
		'/path/to/project/src/index.ts',
		'/path/to/project/src/index.test.ts',
		'/path/to/project/src/index.mts',
		'/path/to/project/src/index.cts',
		'/path/to/project/index.js',
		'/path/to/project/index.test.js',
		'/path/to/project/index.mjs',
		'/path/to/project/index.cjs',
		'/path/to/project/src/index.js',
		'/path/to/project/src/index.test.js',
		'/path/to/project/src/index.mjs',
		'/path/to/project/src/index.cjs',
		'/path/to/project/index.jsx',
	];
});

test('empty config', t => {
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig([]);

	const globs = [tsFilesGlob, ...additionalTsFilesGlob];

	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);

	t.deepEqual(matchedFiles, [
		'/path/to/project/index.ts',
		'/path/to/project/index.test.ts',
		'/path/to/project/index.mts',
		'/path/to/project/index.cts',
		'/path/to/project/index.tsx',
		'/path/to/project/src/index.ts',
		'/path/to/project/src/index.test.ts',
		'/path/to/project/src/index.mts',
		'/path/to/project/src/index.cts',
	], 'Only TypeScript files should be matched');
});

test('config with no "files" and @typescript-eslint rules set to "off"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			rules: {
				'@typescript-eslint/no-unused-vars': 'off',
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles, [
		'/path/to/project/index.ts',
		'/path/to/project/index.test.ts',
		'/path/to/project/index.mts',
		'/path/to/project/index.cts',
		'/path/to/project/index.tsx',
		'/path/to/project/src/index.ts',
		'/path/to/project/src/index.test.ts',
		'/path/to/project/src/index.mts',
		'/path/to/project/src/index.cts',
	], 'Only TypeScript files should be matched');
});
test('config with no "files" and @typescript-eslint rules set to "0"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			rules: {
				'@typescript-eslint/no-unused-vars': 0,
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles, [
		'/path/to/project/index.ts',
		'/path/to/project/index.test.ts',
		'/path/to/project/index.mts',
		'/path/to/project/index.cts',
		'/path/to/project/index.tsx',
		'/path/to/project/src/index.ts',
		'/path/to/project/src/index.test.ts',
		'/path/to/project/src/index.mts',
		'/path/to/project/src/index.cts',
	], 'Only TypeScript files should be matched');
});
test('config with no "files" and @typescript-eslint rules set to "[off]"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			rules: {
				'@typescript-eslint/no-unused-vars': ['off'],
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles, [
		'/path/to/project/index.ts',
		'/path/to/project/index.test.ts',
		'/path/to/project/index.mts',
		'/path/to/project/index.cts',
		'/path/to/project/index.tsx',
		'/path/to/project/src/index.ts',
		'/path/to/project/src/index.test.ts',
		'/path/to/project/src/index.mts',
		'/path/to/project/src/index.cts',
	], 'Only TypeScript files should be matched');
});
test('config with no "files" and @typescript-eslint rules set to "[0]"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			rules: {
				'@typescript-eslint/no-unused-vars': [0],
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles, [
		'/path/to/project/index.ts',
		'/path/to/project/index.test.ts',
		'/path/to/project/index.mts',
		'/path/to/project/index.cts',
		'/path/to/project/index.tsx',
		'/path/to/project/src/index.ts',
		'/path/to/project/src/index.test.ts',
		'/path/to/project/src/index.mts',
		'/path/to/project/src/index.cts',
	], 'Only TypeScript files should be matched');
});
test('config with no "files" and @typescript-eslint rules set to "warn"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			rules: {
				'@typescript-eslint/no-unused-vars': 'warn',
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles, t.context.files, 'All files should be matched');
});
test('config with no "files" and @typescript-eslint rules set to "1"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			rules: {
				'@typescript-eslint/no-unused-vars': 1,
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles, t.context.files, 'All files should be matched');
});
test('config with no "files" and @typescript-eslint rules set to "[warn]"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			rules: {
				'@typescript-eslint/no-unused-vars': ['warn'],
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles, t.context.files, 'All files should be matched');
});
test('config with no "files" and @typescript-eslint rules set to "[1]"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			rules: {
				'@typescript-eslint/no-unused-vars': [1],
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles, t.context.files, 'All files should be matched');
});
test('config with no "files" and @typescript-eslint rules set to "error"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			rules: {
				'@typescript-eslint/no-unused-vars': 'error',
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles, t.context.files, 'All files should be matched');
});
test('config with no "files" and @typescript-eslint rules set to "2"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			rules: {
				'@typescript-eslint/no-unused-vars': 2,
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles, t.context.files, 'All files should be matched');
});
test('config with no "files" and @typescript-eslint rules set to "["error"]"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			rules: {
				'@typescript-eslint/no-unused-vars': ['error'],
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles, t.context.files, 'All files should be matched');
});
test('config with no "files" and @typescript-eslint rules set to "[2]"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			rules: {
				'@typescript-eslint/no-unused-vars': [2],
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles, t.context.files, 'All files should be matched');
});

test('config with js "files" glob and @typescript-eslint rules set to "off"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			files: ['**/*.js'],
			rules: {
				'@typescript-eslint/no-unused-vars': 'off',
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles, [
		'/path/to/project/index.ts',
		'/path/to/project/index.test.ts',
		'/path/to/project/index.mts',
		'/path/to/project/index.cts',
		'/path/to/project/index.tsx',
		'/path/to/project/src/index.ts',
		'/path/to/project/src/index.test.ts',
		'/path/to/project/src/index.mts',
		'/path/to/project/src/index.cts',
	], 'Only TypeScript files should be matched');
});

test('config with js "files" glob and @typescript-eslint rules set to "error"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			files: [jsFilesGlob],
			rules: {
				'@typescript-eslint/no-unused-vars': 'error',
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles, t.context.files, 'All files should be matched');
});

test('config with mixed "files" glob and @typescript-eslint rules set to "error"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			files: [allFilesGlob],
			rules: {
				'@typescript-eslint/no-unused-vars': 'error',
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles, t.context.files, 'All files should be matched');
});

test('config with mixed "files" glob filtered and @typescript-eslint rules set to "error"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			files: ['**/*.{js,ts}'],
			rules: {
				'@typescript-eslint/no-unused-vars': 'error',
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles.toSorted(), [
		'/path/to/project/index.ts',
		'/path/to/project/index.test.ts',
		'/path/to/project/index.mts',
		'/path/to/project/index.cts',
		'/path/to/project/index.tsx',
		'/path/to/project/index.js',
		'/path/to/project/index.test.js',
		'/path/to/project/src/index.ts',
		'/path/to/project/src/index.test.ts',
		'/path/to/project/src/index.mts',
		'/path/to/project/src/index.cts',
		'/path/to/project/src/index.js',
		'/path/to/project/src/index.test.js',
	].toSorted(), 'All Ts files and only .js files should be matched');
});

test('config with mixed relative glob "files" and @typescript-eslint rules set to "error"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			files: ['./src/*.{js,ts}'],
			rules: {
				'@typescript-eslint/no-unused-vars': 'error',
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles.toSorted(), [
		'/path/to/project/index.ts',
		'/path/to/project/index.test.ts',
		'/path/to/project/index.mts',
		'/path/to/project/index.cts',
		'/path/to/project/index.tsx',
		'/path/to/project/src/index.ts',
		'/path/to/project/src/index.test.ts',
		'/path/to/project/src/index.mts',
		'/path/to/project/src/index.cts',
		'/path/to/project/src/index.js',
		'/path/to/project/src/index.test.js',
	].toSorted(), 'All Ts files and only .js files in src dir should be matched');
});

test('config with mixed relative trickier glob "files" and @typescript-eslint rules set to "error"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			files: ['./src/*.{j,t}s'],
			rules: {
				'@typescript-eslint/no-unused-vars': 'error',
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles.toSorted(), [
		'/path/to/project/index.ts',
		'/path/to/project/index.test.ts',
		'/path/to/project/index.mts',
		'/path/to/project/index.cts',
		'/path/to/project/index.tsx',
		'/path/to/project/src/index.ts',
		'/path/to/project/src/index.test.ts',
		'/path/to/project/src/index.mts',
		'/path/to/project/src/index.cts',
		'/path/to/project/src/index.js',
		'/path/to/project/src/index.test.js',
	].toSorted(), 'All Ts files and only .js files in src dir should be matched');
});

test('config with mixed relative filepath "files" and @typescript-eslint rules set to "error"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			files: ['./src/index.js'],
			rules: {
				'@typescript-eslint/no-unused-vars': 'error',
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles.toSorted(), [
		'/path/to/project/index.ts',
		'/path/to/project/index.test.ts',
		'/path/to/project/index.mts',
		'/path/to/project/index.cts',
		'/path/to/project/index.tsx',
		'/path/to/project/src/index.ts',
		'/path/to/project/src/index.test.ts',
		'/path/to/project/src/index.mts',
		'/path/to/project/src/index.cts',
		'/path/to/project/src/index.js',
	].toSorted(), 'All Ts files and single .js files in src dir should be matched');
});

test('config with js glob "files" and @typescript-eslint rules set to "error" and ignores a file', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			files: ['*.js'],
			ignores: ['index.test.js'],
			rules: {
				'@typescript-eslint/no-unused-vars': 'error',
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles.toSorted(), [
		'/path/to/project/index.ts',
		'/path/to/project/index.test.ts',
		'/path/to/project/index.mts',
		'/path/to/project/index.cts',
		'/path/to/project/index.tsx',
		'/path/to/project/src/index.ts',
		'/path/to/project/src/index.test.ts',
		'/path/to/project/src/index.mts',
		'/path/to/project/src/index.cts',
		'/path/to/project/index.js',
	].toSorted(), 'All Ts files and .js files in root dir should be matched');
});

test('config with custom languageOptions and @typescript-eslint rules set to "error"', t => {
	const xoConfig: XoConfigItem[] = [
		// Base config needs to be the first item in the array
		{},
		{
			languageOptions: {
				// @ts-expect-error - This is a test, parserOptions.project just needs to be set
				parser: '@typescript-eslint/parser',
				parserOptions: {
					project: './tsconfig.json',
				},
			},
			rules: {
				'@typescript-eslint/no-unused-vars': 'error',
			},
		},
	];
	const {tsFilesGlob: additionalTsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig(xoConfig);
	const globs = [tsFilesGlob, ...additionalTsFilesGlob];
	const matchedFiles = matchFilesForTsConfig(t.context.cwd, t.context.files, globs, tsFilesIgnoresGlob);
	t.deepEqual(matchedFiles, [], 'No files should be matched');
});
