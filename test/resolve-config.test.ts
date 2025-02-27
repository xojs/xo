import fs from 'node:fs/promises';
import path from 'node:path';
import _test, {type TestFn} from 'ava'; // eslint-disable-line ava/use-test
import {resolveXoConfig} from '../lib/resolve-config.js';
import {copyTestProject} from './helpers/copy-test-project.js';

const test = _test as TestFn<{cwd: string}>;

test.beforeEach(async t => {
	t.context.cwd = await copyTestProject();
});

test.afterEach.always(async t => {
	await fs.rm(t.context.cwd, {recursive: true, force: true});
});

test('resolveXoConfig > no config', async t => {
	const {enginesOptions, flatOptions, flatConfigPath} = await resolveXoConfig({
		cwd: t.context.cwd,
	});
	t.deepEqual(enginesOptions, {});
	t.deepEqual(flatOptions, []);
	t.is(flatConfigPath, '');
});

test('resolveXoConfig > resolves xo config', async t => {
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
	const {enginesOptions, flatOptions, flatConfigPath} = await resolveXoConfig({
		cwd: t.context.cwd,
	});

	t.deepEqual(enginesOptions, {});
	t.deepEqual(flatConfigPath, path.join(t.context.cwd, 'xo.config.js'));
	t.deepEqual(flatOptions, [{space: true}]);
});

test('resolveXoConfig > resolves xo config with engines', async t => {
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
	await fs.writeFile(
		path.join(t.context.cwd, 'package.json'),
		JSON.stringify({
			engines: {node: '>=16'},
			...JSON.parse(await fs.readFile(path.join(t.context.cwd, 'package.json'), 'utf8')),
		}),
		'utf8',
	);
	const {enginesOptions, flatOptions, flatConfigPath} = await resolveXoConfig({
		cwd: t.context.cwd,
	});

	t.is(flatConfigPath, path.join(t.context.cwd, 'xo.config.js'));
	t.deepEqual(flatOptions, [{space: true}]);
	t.deepEqual(enginesOptions, {node: '>=16'});

	t.pass();
});
