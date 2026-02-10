import fs from 'node:fs/promises';
import _test, {type TestFn} from 'ava'; // eslint-disable-line ava/use-test
import {type Linter} from 'eslint';
import micromatch from 'micromatch';
import {xoToEslintConfig} from '../lib/xo-to-eslint.js';
import {frameworkExtensions} from '../lib/constants.js';
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

	const prettierPluginConfig = flatConfig.find(config =>
		typeof config?.plugins?.['prettier'] === 'object');

	t.truthy(prettierPluginConfig);

	const prettierRuleConfig = flatConfig.find(config =>
		config?.rules?.['prettier/prettier'] !== undefined);

	t.deepEqual(prettierRuleConfig?.rules?.['prettier/prettier'], [
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

	const prettierPluginConfig = flatConfig.find(config =>
		typeof config?.plugins?.['prettier'] === 'object');

	t.truthy(prettierPluginConfig);

	const prettierRuleConfig = flatConfig.find(config =>
		config?.rules?.['prettier/prettier'] !== undefined);

	t.deepEqual(prettierRuleConfig?.rules?.['prettier/prettier'], [
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

test('react hooks config works with react option', t => {
	const userReactHooksPlugin = {rules: {}};

	const flatConfig = xoToEslintConfig([
		{react: true},
		{
			plugins: {'react-hooks': userReactHooksPlugin},
			rules: {
				'react-hooks/rules-of-hooks': 'error',
			},
		},
	]);

	const reactHooksPlugins = flatConfig.filter(config =>
		typeof config?.plugins?.['react-hooks'] === 'object');

	t.is(reactHooksPlugins.length, 1);
	t.is(reactHooksPlugins[0]?.plugins?.['react-hooks'], userReactHooksPlugin);
	t.is(flatConfig.at(-1)?.rules?.['react-hooks/rules-of-hooks'], 'error');
});

test('user plugin overrides win regardless of order', t => {
	const userReactHooksPlugin = {rules: {}};

	const flatConfig = xoToEslintConfig([
		{
			plugins: {'react-hooks': userReactHooksPlugin},
		},
		{react: true},
	]);

	const reactHooksPlugins = flatConfig.filter(config =>
		typeof config?.plugins?.['react-hooks'] === 'object');

	t.is(reactHooksPlugins.length, 1);
	t.is(reactHooksPlugins[0]?.plugins?.['react-hooks'], userReactHooksPlugin);
});

test('all plugins are consolidated into a single config entry', t => {
	const flatConfig = xoToEslintConfig([{react: true, prettier: true}]);

	const pluginConfigs = flatConfig.filter(config => config.plugins && Object.keys(config.plugins).length > 0);

	t.is(pluginConfigs.length, 1);
	t.is(pluginConfigs[0]?.name, 'xo/plugins');
	t.truthy(pluginConfigs[0]?.plugins?.['react']);
	t.truthy(pluginConfigs[0]?.plugins?.['react-hooks']);
	t.truthy(pluginConfigs[0]?.plugins?.['prettier']);
});

test('non-js/ts plugin is hoisted without affecting file-scoped rules', t => {
	const jsonPlugin = {rules: {'no-duplicate-keys': {create: () => ({})}}};

	const flatConfig = xoToEslintConfig([
		{
			plugins: {json: jsonPlugin},
			files: ['**/*.json'],
			rules: {
				'json/no-duplicate-keys': 'error',
			},
		},
	]);

	// Plugin should be hoisted into the single plugins entry
	const pluginConfigs = flatConfig.filter(config => config.plugins && Object.keys(config.plugins).length > 0);
	t.is(pluginConfigs.length, 1);
	t.is(pluginConfigs[0]?.plugins?.['json'], jsonPlugin);

	// The rule should still be scoped to the correct files
	const jsonRuleConfig = flatConfig.find(config =>
		config?.rules?.['json/no-duplicate-keys'] !== undefined);
	t.deepEqual(jsonRuleConfig?.files, ['**/*.json']);
});

test('supports files config option as a string', t => {
	const flatConfig = xoToEslintConfig([{files: 'src/**/*.ts'}]);

	t.deepEqual(flatConfig.at(-1)?.files, ['src/**/*.ts']);
});

test('no files config option remains undefined', t => {
	const flatConfig = xoToEslintConfig([{files: undefined, space: true}]);

	t.is(flatConfig.at(-1)?.files, undefined);
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

test('supports ESLint-native files format with nested arrays', t => {
	const flatConfig = xoToEslintConfig([{files: ['**/*.svelte', ['**/*.test.*', '**/*.spec.*']]}]);

	t.deepEqual(flatConfig.at(-1)?.files, ['**/*.svelte', ['**/*.test.*', '**/*.spec.*']]);
});

test('Linter.Config objects are accepted as XoConfigItem', t => {
	// Simulates spreading an ESLint plugin config (typed as Linter.Config) into XO config
	const eslintPluginConfig: Linter.Config = {
		files: ['**/*.svelte'],
		rules: {'no-console': 'warn'},
	};

	const flatConfig = xoToEslintConfig([eslintPluginConfig]);

	t.deepEqual(flatConfig.at(-1)?.files, ['**/*.svelte']);
	t.is(flatConfig.at(-1)?.rules?.['no-console'], 'warn');
});

test('base config applies to framework file types', t => {
	const flatConfig = xoToEslintConfig(undefined);
	const baseConfig = flatConfig.find(config => config.name === 'xo/base');
	const filesGlob = baseConfig?.files?.[0];

	if (typeof filesGlob !== 'string') {
		t.fail('expected xo/base files[0] to be a string glob');
		return;
	}

	for (const extension of frameworkExtensions) {
		t.true(
			micromatch.isMatch(`test.${extension}`, filesGlob),
			`base config should match .${extension} files`,
		);
	}
});
