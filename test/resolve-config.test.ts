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
});

