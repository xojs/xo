import fs from 'node:fs/promises';
import _test, {type TestFn} from 'ava'; // eslint-disable-line ava/use-test
import {xoToEslintConfig} from '../lib/xo-to-eslint.js';
import {allFilesGlob} from '../lib/constants.js';
import {copyTestProject} from './helpers/copy-test-project.js';
import {getJsRule} from './helpers/get-rule.js';

const test = _test as TestFn<{cwd: string}>;

test.beforeEach(async t => {
	t.context.cwd = await copyTestProject();
});

test.afterEach.always(async t => {
	await fs.rm(t.context.cwd, {recursive: true, force: true});
});

test('base config rules', t => {
	const flatConfig = xoToEslintConfig(undefined);

	t.deepEqual(getJsRule(flatConfig, '@stylistic/indent'), [
		'error',
		'tab',
		// eslint-disable-next-line @typescript-eslint/naming-convention
		{SwitchCase: 1},
	]);
	t.deepEqual(getJsRule(flatConfig, '@stylistic/semi'), ['error', 'always']);
	t.deepEqual(getJsRule(flatConfig, '@stylistic/quotes'), ['error', 'single']);
});

test('empty config rules', t => {
	const flatConfig = xoToEslintConfig([]);

	t.deepEqual(getJsRule(flatConfig, '@stylistic/indent'), [
		'error',
		'tab',
		// eslint-disable-next-line @typescript-eslint/naming-convention
		{SwitchCase: 1},
	]);
	t.deepEqual(getJsRule(flatConfig, '@stylistic/semi'), ['error', 'always']);
	t.deepEqual(getJsRule(flatConfig, '@stylistic/quotes'), ['error', 'single']);
});

test('config with space option', t => {
	const flatConfig = xoToEslintConfig([{space: true}]);

	t.deepEqual(getJsRule(flatConfig, '@stylistic/indent'), [
		'error',
		2,
		// eslint-disable-next-line @typescript-eslint/naming-convention
		{SwitchCase: 1},
	]);
});

test('config with semi false option', t => {
	const flatConfig = xoToEslintConfig([{semicolon: false}]);

	t.deepEqual(getJsRule(flatConfig, '@stylistic/semi'), ['error', 'never']);
});

test('config with rules', t => {
	const flatConfig = xoToEslintConfig([{rules: {'no-console': 'error'}}]);

	t.is(getJsRule(flatConfig, 'no-console'), 'error');
});

test('with prettier option', t => {
	const flatConfig = xoToEslintConfig([{prettier: true}]);

	const prettierConfigTs = flatConfig.find(config =>
		typeof config?.plugins?.['prettier'] === 'object'
		&& config?.files?.[0]?.includes('ts'));

	t.truthy(prettierConfigTs);

	const prettierConfigJs = flatConfig.find(config =>
		typeof config?.plugins?.['prettier'] === 'object'
		&& config?.files?.[0]?.includes('js'));

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

	t.deepEqual(prettierConfigTs?.rules?.['prettier/prettier'], [
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

	const prettierConfigTs = flatConfig.find(config =>
		typeof config?.plugins?.['prettier'] === 'object'
		&& config?.files?.[0]?.includes('ts'));

	t.is(prettierConfigTs, undefined);

	t.is(getJsRule(flatConfig, '@typescript-eslint/semi'), 'off');

	const prettierConfigJs = flatConfig.find(config =>
		typeof config?.plugins?.['prettier'] === 'object'
		&& config?.files?.[0]?.includes('js'));

	t.falsy(prettierConfigJs, undefined);

	t.is(getJsRule(flatConfig, '@stylistic/semi'), 'off');
});

test('with prettier option and space', t => {
	const flatConfig = xoToEslintConfig([{prettier: true, space: true}]);

	const prettierConfigTs = flatConfig.find(config =>
		typeof config?.plugins?.['prettier'] === 'object'
		&& config?.files?.[0]?.includes('ts'));

	t.truthy(prettierConfigTs);

	const prettierConfigJs = flatConfig.find(config =>
		typeof config?.plugins?.['prettier'] === 'object'
		&& config?.files?.[0]?.includes('js'));

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

	t.deepEqual(prettierConfigTs?.rules?.['prettier/prettier'], [
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
	t.is(getJsRule(flatConfig, 'react/no-danger'), 'error');
});

test('supports files config option as a string', t => {
	const flatConfig = xoToEslintConfig([{files: 'src/**/*.ts'}]);

	t.deepEqual(flatConfig.at(-1)?.files, ['src/**/*.ts']);
});

test('no files config option defaults to allFilesGlob', t => {
	const flatConfig = xoToEslintConfig([{files: undefined}]);

	t.deepEqual(flatConfig.at(-1)?.files, [allFilesGlob]);
});

test('prettier rules are applied after react rules', t => {
	const flatConfig = xoToEslintConfig([{prettier: 'compat', react: true}]);

	t.is(getJsRule(flatConfig, 'react/jsx-tag-spacing'), 'off');
});
