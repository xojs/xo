
import fs from 'node:fs/promises';
import path from 'node:path';
import test, {beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {type PackageJson} from 'type-fest';
import {resolveXoConfig} from '../lib/resolve-config.js';
import {copyTestProject} from './helpers/copy-test-project.js';

let cwd: string;

beforeEach(async () => {
	cwd = await copyTestProject();
});

afterEach(async () => {
	await fs.rm(cwd, {recursive: true, force: true});
});

test('no config', async () => {
	const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd});
	assert.deepEqual(flatOptions, []);
	assert.equal(flatConfigPath, '');
});

test('resolves xo flat config', async () => {
	const testConfig = `export default [
		{
			space: true,
		},
	];`;
	await fs.writeFile(
		path.join(cwd, 'xo.config.js'),
		testConfig,
		'utf8',
	);
	const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd});

	assert.deepEqual(flatConfigPath, path.join(cwd, 'xo.config.js'));
	assert.deepEqual(flatOptions, [{space: true}]);
});

test('resolves xo object config', async () => {
	const testConfig = `export default {
			space: true,
		};`;
	await fs.writeFile(
		path.join(cwd, 'xo.config.js'),
		testConfig,
		'utf8',
	);
	const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd});

	assert.deepEqual(flatConfigPath, path.join(cwd, 'xo.config.js'));
	assert.deepEqual(flatOptions, [{space: true}]);
});

test('resolves package.json flat config', async () => {
	const pkg = JSON.parse(await fs.readFile(
		path.join(cwd, 'package.json'),
		'utf8',
	)) as PackageJson;

	pkg['xo'] = [{space: true}];

	await fs.rm(
		path.join(cwd, 'xo.config.js'),
		{recursive: true, force: true},
	);

	await fs.writeFile(
		path.join(cwd, 'package.json'),
		JSON.stringify(pkg),
		'utf8',
	);
	const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd});
	assert.deepEqual(flatConfigPath, path.join(cwd, 'package.json'));
	assert.deepEqual(flatOptions, [{space: true}]);
});

test('resolves package.json object config', async () => {
	const pkg = JSON.parse(await fs.readFile(
		path.join(cwd, 'package.json'),
		'utf8',
	)) as PackageJson;

	pkg['xo'] = {space: true};

	await fs.rm(
		path.join(cwd, 'xo.config.js'),
		{recursive: true, force: true},
	);

	await fs.writeFile(
		path.join(cwd, 'package.json'),
		JSON.stringify(pkg),
		'utf8',
	);
	const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd});
	assert.deepEqual(flatConfigPath, path.join(cwd, 'package.json'));
	assert.deepEqual(flatOptions, [{space: true}]);
});

test('resolves all config extensions types', async () => {
	const testConfigEsm = `export default [
		{
			space: true,
		},
	];`;

	const absoluteFiles = ['xo.config.js', 'xo.config.mjs', 'xo.config.ts', 'xo.config.mts'].map(file => path.join(cwd, file));
	const absoluteResults = [];
	for (const file of absoluteFiles) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(file, testConfigEsm, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		absoluteResults.push(await resolveXoConfig({cwd}));
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(file);
	}

	assert.deepEqual(absoluteResults.map(result => result.flatConfigPath), absoluteFiles);
	assert.deepEqual(absoluteResults.map(result => result.flatOptions), absoluteFiles.map(() => [{space: true}]));

	// Relative paths
	const relativeFiles = ['xo.config.js', 'xo.config.mjs', 'xo.config.ts', 'xo.config.mts'];
	const relativeResults = [];
	for (const file of relativeFiles) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(path.join(cwd, file), testConfigEsm, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		relativeResults.push(await resolveXoConfig({cwd, configPath: file}));
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(path.join(cwd, file));
	}

	assert.deepEqual(relativeResults.map(result => result.flatConfigPath), relativeFiles.map(file => path.join(cwd, file)));
	assert.deepEqual(relativeResults.map(result => result.flatOptions), relativeFiles.map(() => [{space: true}]));

	// Relative paths with dot slashes
	const relativeDotFiles = ['./xo.config.js', './xo.config.mjs', './xo.config.ts', './xo.config.mts'];
	const relativeDotResults = [];
	for (const file of relativeDotFiles) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(path.join(cwd, file), testConfigEsm, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		relativeDotResults.push(await resolveXoConfig({cwd, configPath: file}));
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(path.join(cwd, file));
	}

	assert.deepEqual(relativeDotResults.map(result => result.flatConfigPath), relativeDotFiles.map(file => path.join(cwd, file)));
	assert.deepEqual(relativeDotResults.map(result => result.flatOptions), relativeDotFiles.map(() => [{space: true}]));
});

test('loading TypeScript config does not create temporary files', async () => {
	const testConfig = `export default [
		{
			space: true,
		},
	];`;

	const results = [];
	for (const extension of ['.ts', '.mts']) {
		const configFile = path.join(cwd, `xo.config${extension}`);
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(configFile, testConfig, 'utf8');

		// eslint-disable-next-line no-await-in-loop
		const filesBefore = await fs.readdir(cwd);
		// eslint-disable-next-line no-await-in-loop
		const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd});
		// eslint-disable-next-line no-await-in-loop
		const filesAfter = await fs.readdir(cwd);

		results.push({
			configFile, flatOptions, flatConfigPath, filesBefore, filesAfter,
		});

		// eslint-disable-next-line no-await-in-loop
		await fs.rm(configFile);
	}

	assert.deepEqual(results.map(result => result.flatConfigPath), results.map(result => result.configFile));
	assert.deepEqual(results.map(result => result.flatOptions), results.map(() => [{space: true}]));
	assert.deepEqual(results.map(result => result.filesAfter), results.map(result => result.filesBefore), 'No temporary files should be created when loading a TypeScript config');
});

test('resolves all custom config extensions types', async () => {
	const testConfigEsm = `export default [
		{
			space: true,
		},
	];`;

	const absoluteFiles = ['custom.xo.config.js', 'custom.xo.config.mjs', 'custom.xo.config.ts', 'custom.xo.config.mts'].map(file => path.join(cwd, file));
	const absoluteResults = [];
	for (const file of absoluteFiles) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(file, testConfigEsm, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		absoluteResults.push(await resolveXoConfig({cwd, configPath: file}));
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(file);
	}

	assert.deepEqual(absoluteResults.map(result => result.flatConfigPath), absoluteFiles);
	assert.deepEqual(absoluteResults.map(result => result.flatOptions), absoluteFiles.map(() => [{space: true}]));

	const relativeFiles = ['custom.xo.config.js', 'custom.xo.config.mjs', 'custom.xo.config.ts', 'custom.xo.config.mts'];
	const relativeResults = [];
	for (const file of relativeFiles) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(path.join(cwd, file), testConfigEsm, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		relativeResults.push(await resolveXoConfig({cwd, configPath: file}));
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(path.join(cwd, file));
	}

	assert.deepEqual(relativeResults.map(result => result.flatConfigPath), relativeFiles.map(file => path.join(cwd, file)));
	assert.deepEqual(relativeResults.map(result => result.flatOptions), relativeFiles.map(() => [{space: true}]));

	// Relative paths with dot slashes
	const relativeDotFiles = ['./custom.xo.config.js', './custom.xo.config.mjs', './custom.xo.config.ts', './custom.xo.config.mts'];
	const relativeDotResults = [];
	for (const file of relativeDotFiles) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(path.join(cwd, file), testConfigEsm, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		relativeDotResults.push(await resolveXoConfig({cwd, configPath: file}));
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(path.join(cwd, file));
	}

	assert.deepEqual(relativeDotResults.map(result => result.flatConfigPath), relativeDotFiles.map(file => path.join(cwd, file)));
	assert.deepEqual(relativeDotResults.map(result => result.flatOptions), relativeDotFiles.map(() => [{space: true}]));
});
