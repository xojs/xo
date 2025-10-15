import fs from 'node:fs/promises';
import _test, {type TestFn} from 'ava'; // eslint-disable-line ava/use-test
import {xoToEslintConfig} from '../lib/xo-to-eslint.js';
import {copyTestProject} from './helpers/copy-test-project.js';

const test = _test as TestFn<{cwd: string}>; // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion

test.beforeEach(async t => {
	t.context.cwd = await copyTestProject();
});

test.afterEach.always(async t => {
	await fs.rm(t.context.cwd, {recursive: true, force: true});
});

test('base config rules', t => {
	const flatConfig = xoToEslintConfig(undefined);

	t.deepEqual(flatConfig.find(config => config.name === 'xo/base')?.rules?.['@stylistic/indent'], [
		'error',
		'tab',
		// eslint-disable-next-line @typescript-eslint/naming-convention
		{SwitchCase: 1},
	]);
	t.deepEqual(flatConfig.find(config => config.name === 'xo/base')?.rules?.['@stylistic/semi'], ['error', 'always']);
	t.deepEqual(flatConfig.find(config => config.name === 'xo/base')?.rules?.['@stylistic/quotes'], ['error', 'single']);
});

test('empty config rules', t => {
	const flatConfig = xoToEslintConfig([]);

	t.deepEqual(flatConfig.find(config => config.name === 'xo/base')?.rules?.['@stylistic/indent'], [
		'error',
		'tab',
		// eslint-disable-next-line @typescript-eslint/naming-convention
		{SwitchCase: 1},
	]);
	t.deepEqual(flatConfig.find(config => config.name === 'xo/base')?.rules?.['@stylistic/semi'], ['error', 'always']);
	t.deepEqual(flatConfig.find(config => config.name === 'xo/base')?.rules?.['@stylistic/quotes'], ['error', 'single']);
});

test('config with space option', t => {
	const flatConfig = xoToEslintConfig([{space: true}]);

	t.deepEqual(flatConfig.at(-1)?.rules?.['@stylistic/indent'], [
		'error',
		2,
		// eslint-disable-next-line @typescript-eslint/naming-convention
		{SwitchCase: 1},
	]);
	t.deepEqual(flatConfig.at(-1)?.rules?.['@stylistic/indent-binary-ops'], ['error', 2]);
});

test('config with semi false option', t => {
	const flatConfig = xoToEslintConfig([{semicolon: false}]);

	t.deepEqual(flatConfig.at(-1)?.rules?.['@stylistic/semi'], ['error', 'never']);
});

test('config with rules', t => {
	const flatConfig = xoToEslintConfig([{rules: {'no-console': 'error'}}]);

	t.is(flatConfig.at(-1)?.rules?.['no-console'], 'error');
});

test('with prettier option', t => {
	const flatConfig = xoToEslintConfig([{prettier: true}]);

	const prettierConfigJs = flatConfig.find(config =>
		typeof config?.plugins?.['prettier'] === 'object');

	t.truthy(prettierConfigJs);

	t.deepEqual(prettierConfigJs?.rules?.['prettier/prettier'], [
		'error',
		{
			bracketSameLine: false,
			bracketSpacing: false,
			semi: undefined,
			singleQuote: true,
			tabWidth: 2,
			trailingComma: 'all',
			useTabs: true,
		},
	]);
});

test('with prettier option compat', t => {
	const flatConfig = xoToEslintConfig([{prettier: 'compat'}]);

	t.is(flatConfig.at(-1)?.rules?.['@typescript-eslint/semi'], 'off');

	const prettierConfigJs = flatConfig.find(config =>
		typeof config?.plugins?.['prettier'] === 'object');

	t.falsy(prettierConfigJs, undefined);

	t.is(flatConfig.at(-1)?.rules?.['@stylistic/semi'], 'off');
});

test('with prettier option and space', t => {
	const flatConfig = xoToEslintConfig([{prettier: true, space: true}]);

	const prettierConfigJs = flatConfig.find(config =>
		typeof config?.plugins?.['prettier'] === 'object');

	t.truthy(prettierConfigJs);

	t.deepEqual(prettierConfigJs?.rules?.['prettier/prettier'], [
		'error',
		{
			bracketSameLine: false,
			bracketSpacing: false,
			semi: undefined,
			singleQuote: true,
			tabWidth: 2,
			trailingComma: 'all',
			useTabs: false,
		},
	]);
});

test('with react option', t => {
	const flatConfig = xoToEslintConfig([{react: true}]);

	const reactPlugin = flatConfig.find(config =>
		typeof config?.plugins?.['react'] === 'object');

	const reactHooksPlugin = flatConfig.find(config =>
		typeof config?.plugins?.['react-hooks'] === 'object');

	t.true(reactPlugin instanceof Object);
	t.true(reactHooksPlugin instanceof Object);
	t.is(flatConfig.at(-1)?.rules?.['react/no-danger'], 'error');
});

test('supports files config option as a string', t => {
	const flatConfig = xoToEslintConfig([{files: 'src/**/*.ts'}]);

	t.deepEqual(flatConfig.at(-1)?.files, ['src/**/*.ts']);
});

test('no files config option remains undefined', t => {
	const flatConfig = xoToEslintConfig([{files: undefined, space: true}]);

	t.deepEqual(flatConfig.at(-1)?.files, undefined);
});

test('prettier rules are applied after react rules', t => {
	const flatConfig = xoToEslintConfig([{prettier: 'compat', react: true}]);

	t.is(flatConfig.at(-1)?.rules?.['react/jsx-tag-spacing'], 'off');
});

test('global ignores are respected', t => {
	const flatConfig = xoToEslintConfig([
		{ignores: ['**/test']},
	]);

	t.deepEqual(flatConfig.at(-1), {ignores: ['**/test']});
});

test('global ignores as strings are respected', t => {
	const flatConfig = xoToEslintConfig([
		{ignores: '**/test'},
	]);

	t.deepEqual(flatConfig.at(-1), {ignores: ['**/test']});
});

test('global ignores with names are respected', t => {
	const flatConfig = xoToEslintConfig([
		{name: 'test-ignores', ignores: '**/test'},
	]);

	t.deepEqual(flatConfig.at(-1), {name: 'test-ignores', ignores: ['**/test']});
});

test('empty configs are filtered', t => {
	const flatConfig = xoToEslintConfig([
		{name: 'test-ignores', ignores: '**/test'},
		{},
		{},
		{},
		{rules: {}},
	]);

	t.deepEqual(flatConfig.at(-2), {name: 'test-ignores', ignores: ['**/test']});
});
