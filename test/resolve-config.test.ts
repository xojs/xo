import fs from 'node:fs/promises';
import path from 'node:path';
import _test, {type TestFn} from 'ava'; // eslint-disable-line ava/use-test
import {type PackageJson} from 'type-fest';
import {resolveXoConfig} from '../lib/resolve-config.js';
import {copyTestProject} from './helpers/copy-test-project.js';

const test = _test as TestFn<{cwd: string}>;

test.beforeEach(async t => {
	t.context.cwd = await copyTestProject();
});

test.afterEach.always(async t => {
	await fs.rm(t.context.cwd, {recursive: true, force: true});
});

test('no config', async t => {
	const {flatOptions, flatConfigPath} = await resolveXoConfig({
		cwd: t.context.cwd,
	});
	t.deepEqual(flatOptions, []);
	t.is(flatConfigPath, '');
});

test('resolves xo flat config', async t => {
	const testConfig = `export default [
		{
			space: true,
		},
	];`;
	await fs.writeFile(
		path.join(t.context.cwd, 'xo.config.js'),
		testConfig,
		'utf8',
	);
	const {flatOptions, flatConfigPath} = await resolveXoConfig({
		cwd: t.context.cwd,
	});

	t.deepEqual(flatConfigPath, path.join(t.context.cwd, 'xo.config.js'));
	t.deepEqual(flatOptions, [{space: true}]);
});

test('resolves xo object config', async t => {
	const testConfig = `export default {
			space: true,
		};`;
	await fs.writeFile(
		path.join(t.context.cwd, 'xo.config.js'),
		testConfig,
		'utf8',
	);
	const {flatOptions, flatConfigPath} = await resolveXoConfig({
		cwd: t.context.cwd,
	});

	t.deepEqual(flatConfigPath, path.join(t.context.cwd, 'xo.config.js'));
	t.deepEqual(flatOptions, [{space: true}]);
});

test('resolves package.json flat config', async t => {
	const pkg = JSON.parse(await fs.readFile(
		path.join(t.context.cwd, 'package.json'),
		'utf8',
	)) as PackageJson;

	pkg['xo'] = [{space: true}];

	await fs.rm(
		path.join(t.context.cwd, 'xo.config.js'),
		{recursive: true, force: true},
	);

	await fs.writeFile(
		path.join(t.context.cwd, 'package.json'),
		JSON.stringify(pkg),
		'utf8',
	);
	const {flatOptions, flatConfigPath} = await resolveXoConfig({
		cwd: t.context.cwd,
	});
	t.deepEqual(flatConfigPath, path.join(t.context.cwd, 'package.json'));
	t.deepEqual(flatOptions, [{space: true}]);
});

test('resolves package.json object config', async t => {
	const pkg = JSON.parse(await fs.readFile(
		path.join(t.context.cwd, 'package.json'),
		'utf8',
	)) as PackageJson;

	pkg['xo'] = {space: true};

	await fs.rm(
		path.join(t.context.cwd, 'xo.config.js'),
		{recursive: true, force: true},
	);

	await fs.writeFile(
		path.join(t.context.cwd, 'package.json'),
		JSON.stringify(pkg),
		'utf8',
	);
	const {flatOptions, flatConfigPath} = await resolveXoConfig({
		cwd: t.context.cwd,
	});
	t.deepEqual(flatConfigPath, path.join(t.context.cwd, 'package.json'));
	t.deepEqual(flatOptions, [{space: true}]);
});

test('resolves all config extensions types', async t => {
	const testConfigEsm = `export default [
		{
			space: true,
		},
	];`;

	const testConfigCjs = `module.exports = [
		{
			space: true,
		},
	];`;

	const jsFile = path.join(t.context.cwd, 'xo.config.js');
	const cjsFile = path.join(t.context.cwd, 'xo.config.cjs');
	const mjsFile = path.join(t.context.cwd, 'xo.config.mjs');
	const tsFile = path.join(t.context.cwd, 'xo.config.ts');
	const ctsFile = path.join(t.context.cwd, 'xo.config.cts');
	const mjsFile2 = path.join(t.context.cwd, 'xo.config.mjs');

	for (const file of [jsFile, mjsFile, tsFile, mjsFile2]) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(file, testConfigEsm, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd: t.context.cwd});
		t.deepEqual(flatConfigPath, file);
		t.deepEqual(flatOptions, [{space: true}]);
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(file);
	}

	for (const file of [cjsFile, ctsFile]) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(file, testConfigCjs, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd: t.context.cwd});
		t.deepEqual(flatConfigPath, file);
		t.deepEqual(flatOptions, [{space: true}]);
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(file);
	}

	// Relative paths
	const jsFileRelative = 'xo.config.js';
	const cjsFileRelative = 'xo.config.cjs';
	const mjsFileRelative = 'xo.config.mjs';
	const tsFileRelative = 'xo.config.ts';
	const ctsFileRelative = 'xo.config.cts';
	const mjsFile2Relative = 'xo.config.mjs';

	for (const file of [jsFileRelative, mjsFileRelative, tsFileRelative, mjsFile2Relative]) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(path.join(t.context.cwd, file), testConfigEsm, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd: t.context.cwd, configPath: file});
		t.deepEqual(flatConfigPath, path.join(t.context.cwd, file), 'Config path should match' + file);
		t.deepEqual(flatOptions, [{space: true}], 'Flat options should match expected value' + file);
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(path.join(t.context.cwd, file));
	}

	for (const file of [cjsFileRelative, ctsFileRelative]) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(path.join(t.context.cwd, file), testConfigCjs, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd: t.context.cwd, configPath: file});
		t.deepEqual(flatConfigPath, path.join(t.context.cwd, file), 'Config path should match' + file);
		t.deepEqual(flatOptions, [{space: true}], 'Flat options should match expected value' + file);
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(path.join(t.context.cwd, file));
	}

	// Relative paths with dot slashes
	const jsFileRelativeDot = './xo.config.js';
	const cjsFileRelativeDot = './xo.config.cjs';
	const mjsFileRelativeDot = './xo.config.mjs';
	const tsFileRelativeDot = './xo.config.ts';
	const ctsFileRelativeDot = './xo.config.cts';
	const mjsFile2RelativeDot = './xo.config.mjs';

	for (const file of [jsFileRelativeDot, mjsFileRelativeDot, tsFileRelativeDot, mjsFile2RelativeDot]) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(path.join(t.context.cwd, file), testConfigEsm, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd: t.context.cwd, configPath: file});
		t.deepEqual(flatConfigPath, path.join(t.context.cwd, file), 'Config path should match' + file);
		t.deepEqual(flatOptions, [{space: true}], 'Flat options should match expected value' + file);
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(path.join(t.context.cwd, file));
	}

	for (const file of [cjsFileRelativeDot, ctsFileRelativeDot]) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(path.join(t.context.cwd, file), testConfigCjs, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd: t.context.cwd, configPath: file});
		t.deepEqual(flatConfigPath, path.join(t.context.cwd, file), 'Config path should match' + file);
		t.deepEqual(flatOptions, [{space: true}], 'Flat options should match expected value' + file);
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(path.join(t.context.cwd, file));
	}
});

test('resolves all custom config extensions types', async t => {
	const testConfigEsm = `export default [
		{
			space: true,
		},
	];`;

	const testConfigCjs = `module.exports = [
		{
			space: true,
		},
	];`;

	const jsFile = path.join(t.context.cwd, 'custom.xo.config.js');
	const cjsFile = path.join(t.context.cwd, 'custom.xo.config.cjs');
	const mjsFile = path.join(t.context.cwd, 'custom.xo.config.mjs');
	const tsFile = path.join(t.context.cwd, 'custom.xo.config.ts');
	const ctsFile = path.join(t.context.cwd, 'custom.xo.config.cts');
	const mjsFile2 = path.join(t.context.cwd, 'custom.xo.config.mjs');

	for (const file of [jsFile, mjsFile, tsFile, mjsFile2]) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(file, testConfigEsm, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd: t.context.cwd, configPath: file});
		t.deepEqual(flatConfigPath, file, 'Config path should match' + file);
		t.deepEqual(flatOptions, [{space: true}], 'Flat options should match expected value' + file);
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(file);
	}

	for (const file of [cjsFile, ctsFile]) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(file, testConfigCjs, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd: t.context.cwd, configPath: file});
		t.deepEqual(flatConfigPath, file, 'Config path should match' + file);
		t.deepEqual(flatOptions, [{space: true}], 'Flat options should match expected value' + file);
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(file);
	}

	const jsFileRelative = 'custom.xo.config.js';
	const cjsFileRelative = 'custom.xo.config.cjs';
	const mjsFileRelative = 'custom.xo.config.mjs';
	const tsFileRelative = 'custom.xo.config.ts';
	const ctsFileRelative = 'custom.xo.config.cts';
	const mjsFile2Relative = 'custom.xo.config.mjs';

	for (const file of [jsFileRelative, mjsFileRelative, tsFileRelative, mjsFile2Relative]) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(path.join(t.context.cwd, file), testConfigEsm, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd: t.context.cwd, configPath: file});
		t.deepEqual(flatConfigPath, path.join(t.context.cwd, file), 'Config path should match' + file);
		t.deepEqual(flatOptions, [{space: true}], 'Flat options should match expected value' + file);
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(path.join(t.context.cwd, file));
	}

	for (const file of [cjsFileRelative, ctsFileRelative]) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(path.join(t.context.cwd, file), testConfigCjs, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd: t.context.cwd, configPath: file});
		t.deepEqual(flatConfigPath, path.join(t.context.cwd, file), 'Config path should match' + file);
		t.deepEqual(flatOptions, [{space: true}], 'Flat options should match expected value' + file);
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(path.join(t.context.cwd, file));
	}

	// Relative paths with dot slashes
	const jsFileRelativeDot = './custom.xo.config.js';
	const cjsFileRelativeDot = './custom.xo.config.cjs';
	const mjsFileRelativeDot = './custom.xo.config.mjs';
	const tsFileRelativeDot = './custom.xo.config.ts';
	const ctsFileRelativeDot = './custom.xo.config.cts';
	const mjsFile2RelativeDot = './custom.xo.config.mjs';

	for (const file of [jsFileRelativeDot, mjsFileRelativeDot, tsFileRelativeDot, mjsFile2RelativeDot]) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(path.join(t.context.cwd, file), testConfigEsm, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd: t.context.cwd, configPath: file});
		t.deepEqual(flatConfigPath, path.join(t.context.cwd, file), 'Config path should match' + file);
		t.deepEqual(flatOptions, [{space: true}], 'Flat options should match expected value' + file);
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(path.join(t.context.cwd, file));
	}

	for (const file of [cjsFileRelativeDot, ctsFileRelativeDot]) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(path.join(t.context.cwd, file), testConfigCjs, 'utf8');
		// eslint-disable-next-line no-await-in-loop
		const {flatOptions, flatConfigPath} = await resolveXoConfig({cwd: t.context.cwd, configPath: file});
		t.deepEqual(flatConfigPath, path.join(t.context.cwd, file), 'Config path should match' + file);
		t.deepEqual(flatOptions, [{space: true}], 'Flat options should match expected value' + file);
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(path.join(t.context.cwd, file));
	}
});
