
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

test('resolves parent package.json config from nested package cwd', async () => {
	const pkg = JSON.parse(await fs.readFile(
		path.join(cwd, 'package.json'),
		'utf8',
	)) as PackageJson;

	pkg['xo'] = {space: true};

	await fs.writeFile(
		path.join(cwd, 'package.json'),
		JSON.stringify(pkg),
		'utf8',
	);

	const packageCwd = path.join(cwd, 'packages', 'app');
	await fs.mkdir(packageCwd, {recursive: true});
	await fs.writeFile(
		path.join(packageCwd, 'package.json'),
		JSON.stringify({name: 'app'}),
		'utf8',
	);

	const {flatOptions, flatConfigPath} = await resolveXoConfig({
		cwd: packageCwd,
	});

	assert.deepEqual(flatConfigPath, path.join(cwd, 'package.json'));
	assert.deepEqual(flatOptions, [{space: true}]);
});

test('resolves all config extensions types', async () => {
	const testConfigEsm = `export default [
		{
			space: true,
		},
	];`;

	const jsFile = path.join(cwd, 'xo.config.js');
	const mjsFile = path.join(cwd, 'xo.config.mjs');
	const tsFile = path.join(cwd, 'xo.config.ts');
	const mtsFile = path.join(cwd, 'xo.config.mts');

	for (const file of [jsFile, mjsFile, tsFile, mtsFile]) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(file, testConfigEsm, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd});
		assert.deepEqual(flatConfigPath, file);
		assert.deepEqual(flatOptions, [{space: true}]);
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(file);
	}

	// Relative paths
	const jsFileRelative = 'xo.config.js';
	const mjsFileRelative = 'xo.config.mjs';
	const tsFileRelative = 'xo.config.ts';
	const mtsFileRelative = 'xo.config.mts';

	for (const file of [jsFileRelative, mjsFileRelative, tsFileRelative, mtsFileRelative]) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(path.join(cwd, file), testConfigEsm, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd, configPath: file});
		assert.deepEqual(flatConfigPath, path.join(cwd, file), 'Config path should match' + file);
		assert.deepEqual(flatOptions, [{space: true}], 'Flat options should match expected value' + file);
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(path.join(cwd, file));
	}

	// Relative paths with dot slashes
	const jsFileRelativeDot = './xo.config.js';
	const mjsFileRelativeDot = './xo.config.mjs';
	const tsFileRelativeDot = './xo.config.ts';
	const mtsFileRelativeDot = './xo.config.mts';

	for (const file of [jsFileRelativeDot, mjsFileRelativeDot, tsFileRelativeDot, mtsFileRelativeDot]) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(path.join(cwd, file), testConfigEsm, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd, configPath: file});
		assert.deepEqual(flatConfigPath, path.join(cwd, file), 'Config path should match' + file);
		assert.deepEqual(flatOptions, [{space: true}], 'Flat options should match expected value' + file);
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(path.join(cwd, file));
	}
});

test('loading TypeScript config does not create temporary files', async () => {
	const testConfig = `export default [
		{
			space: true,
		},
	];`;

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

		assert.deepEqual(flatConfigPath, configFile);
		assert.deepEqual(flatOptions, [{space: true}]);
		assert.deepEqual(filesAfter, filesBefore, `No temporary files should be created when loading xo.config${extension}`);

		// eslint-disable-next-line no-await-in-loop
		await fs.rm(configFile);
	}
});

test('resolves all custom config extensions types', async () => {
	const testConfigEsm = `export default [
		{
			space: true,
		},
	];`;

	const jsFile = path.join(cwd, 'custom.xo.config.js');
	const mjsFile = path.join(cwd, 'custom.xo.config.mjs');
	const tsFile = path.join(cwd, 'custom.xo.config.ts');
	const mtsFile = path.join(cwd, 'custom.xo.config.mts');

	for (const file of [jsFile, mjsFile, tsFile, mtsFile]) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(file, testConfigEsm, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd, configPath: file});
		assert.deepEqual(flatConfigPath, file, 'Config path should match' + file);
		assert.deepEqual(flatOptions, [{space: true}], 'Flat options should match expected value' + file);
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(file);
	}

	const jsFileRelative = 'custom.xo.config.js';
	const mjsFileRelative = 'custom.xo.config.mjs';
	const tsFileRelative = 'custom.xo.config.ts';
	const mtsFileRelative = 'custom.xo.config.mts';

	for (const file of [jsFileRelative, mjsFileRelative, tsFileRelative, mtsFileRelative]) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(path.join(cwd, file), testConfigEsm, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd, configPath: file});
		assert.deepEqual(flatConfigPath, path.join(cwd, file), 'Config path should match' + file);
		assert.deepEqual(flatOptions, [{space: true}], 'Flat options should match expected value' + file);
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(path.join(cwd, file));
	}

	// Relative paths with dot slashes
	const jsFileRelativeDot = './custom.xo.config.js';
	const mjsFileRelativeDot = './custom.xo.config.mjs';
	const tsFileRelativeDot = './custom.xo.config.ts';
	const mtsFileRelativeDot = './custom.xo.config.mts';

	for (const file of [jsFileRelativeDot, mjsFileRelativeDot, tsFileRelativeDot, mtsFileRelativeDot]) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(path.join(cwd, file), testConfigEsm, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd, configPath: file});
		assert.deepEqual(flatConfigPath, path.join(cwd, file), 'Config path should match' + file);
		assert.deepEqual(flatOptions, [{space: true}], 'Flat options should match expected value' + file);
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(path.join(cwd, file));
	}
});
