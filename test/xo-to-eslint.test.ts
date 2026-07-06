import test from 'node:test';
import assert from 'node:assert/strict';
import {Linter} from 'eslint';
import micromatch from 'micromatch';
import {xoToEslintConfig} from '../lib/xo-to-eslint.js';
import {frameworkExtensions} from '../lib/constants.js';

test('base config rules', () => {
	const flatConfig = xoToEslintConfig(undefined);

	assert.deepEqual(flatConfig.find(config => config.name === 'xo/base')?.rules?.['@stylistic/indent'], [
		'error',
		'tab',
		// eslint-disable-next-line @typescript-eslint/naming-convention
		{SwitchCase: 1},
	]);
	assert.deepEqual(flatConfig.find(config => config.name === 'xo/base')?.rules?.['@stylistic/semi'], ['error', 'always']);
	assert.deepEqual(flatConfig.find(config => config.name === 'xo/base')?.rules?.['@stylistic/quotes'], ['error', 'single']);
});

test('empty config rules', () => {
	const flatConfig = xoToEslintConfig([]);

	assert.deepEqual(flatConfig.find(config => config.name === 'xo/base')?.rules?.['@stylistic/indent'], [
		'error',
		'tab',
		// eslint-disable-next-line @typescript-eslint/naming-convention
		{SwitchCase: 1},
	]);
	assert.deepEqual(flatConfig.find(config => config.name === 'xo/base')?.rules?.['@stylistic/semi'], ['error', 'always']);
	assert.deepEqual(flatConfig.find(config => config.name === 'xo/base')?.rules?.['@stylistic/quotes'], ['error', 'single']);
});

test('config with space option', () => {
	const flatConfig = xoToEslintConfig([{space: true}]);

	assert.deepEqual(flatConfig.at(-1)?.rules?.['@stylistic/indent'], [
		'error',
		2,
		// eslint-disable-next-line @typescript-eslint/naming-convention
		{SwitchCase: 1},
	]);
	assert.deepEqual(flatConfig.at(-1)?.rules?.['@stylistic/indent-binary-ops'], ['error', 2]);
});

test('config with semi false option', () => {
	const flatConfig = xoToEslintConfig([{semicolon: false}]);

	assert.deepEqual(flatConfig.at(-1)?.rules?.['@stylistic/semi'], ['error', 'never']);
	assert.deepEqual(flatConfig.at(-1)?.rules?.['@stylistic/member-delimiter-style'], [
		'error',
		{
			multiline: {delimiter: 'none'},
			singleline: {delimiter: 'comma', requireLast: false},
		},
	]);
});

test('config with rules', () => {
	const flatConfig = xoToEslintConfig([{rules: {'no-console': 'error'}}]);

	assert.equal(flatConfig.at(-1)?.rules?.['no-console'], 'error');
});

test('with prettier option', () => {
	const flatConfig = xoToEslintConfig([{prettier: true}]);

	const prettierPluginConfig = flatConfig.find(config =>
		typeof config?.plugins?.['prettier'] === 'object');

	assert.ok(prettierPluginConfig);

	const prettierRuleConfig = flatConfig.find(config =>
		config?.rules?.['prettier/prettier'] !== undefined);

	assert.deepEqual(prettierRuleConfig?.rules?.['prettier/prettier'], [
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

test('with prettier option compat', () => {
	const flatConfig = xoToEslintConfig([{prettier: 'compat'}]);

	assert.equal(flatConfig.at(-1)?.rules?.['@typescript-eslint/semi'], 'off');

	const hasPrettierPlugin = flatConfig.some(config =>
		typeof config?.plugins?.['prettier'] === 'object');

	assert.ok(!hasPrettierPlugin);

	assert.equal(flatConfig.at(-1)?.rules?.['@stylistic/semi'], 'off');
});

test('with prettier option and space', () => {
	const flatConfig = xoToEslintConfig([{prettier: true, space: true}]);

	const prettierPluginConfig = flatConfig.find(config =>
		typeof config?.plugins?.['prettier'] === 'object');

	assert.ok(prettierPluginConfig);

	const prettierRuleConfig = flatConfig.find(config =>
		config?.rules?.['prettier/prettier'] !== undefined);

	assert.deepEqual(prettierRuleConfig?.rules?.['prettier/prettier'], [
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

test('prettier compat option without files does not set files property', () => {
	const flatConfig = xoToEslintConfig([{prettier: 'compat'}]);

	const compatConfig = flatConfig.find(config =>
		config?.rules?.['@stylistic/semi'] === 'off');
	assert.ok(compatConfig);
	assert.ok(!('files' in compatConfig), 'prettier compat config should not have a files property when no files are specified');
});

test('user plugin overrides win regardless of order', () => {
	const userPrettierPlugin = {rules: {}};

	const flatConfig = xoToEslintConfig([
		{
			plugins: {prettier: userPrettierPlugin},
		},
		{prettier: true},
	]);

	const prettierPlugins = flatConfig.filter(config =>
		typeof config?.plugins?.['prettier'] === 'object');

	assert.equal(prettierPlugins.length, 1);
	assert.equal(prettierPlugins[0]?.plugins?.['prettier'], userPrettierPlugin);
});

test('all plugins are consolidated into a single config entry', () => {
	const jsonPlugin = {rules: {}};

	const flatConfig = xoToEslintConfig([{plugins: {json: jsonPlugin}, prettier: true}]);

	const pluginConfigs = flatConfig.filter(config => config.plugins && Object.keys(config.plugins).length > 0);

	assert.equal(pluginConfigs.length, 1);
	assert.equal(pluginConfigs[0]?.name, 'xo/plugins');
	assert.ok(pluginConfigs[0]?.plugins?.['json']);
	assert.ok(pluginConfigs[0]?.plugins?.['prettier']);
});

test('non-js/ts plugin is hoisted without affecting file-scoped rules', () => {
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
	assert.equal(pluginConfigs.length, 1);
	assert.equal(pluginConfigs[0]?.plugins?.['json'], jsonPlugin);

	// The rule should still be scoped to the correct files
	const jsonRuleConfig = flatConfig.find(config =>
		config?.rules?.['json/no-duplicate-keys'] !== undefined);
	assert.deepEqual(jsonRuleConfig?.files, ['**/*.json']);
});

test('supports files config option as a string', () => {
	const flatConfig = xoToEslintConfig([{files: 'src/**/*.ts'}]);

	assert.deepEqual(flatConfig.at(-1)?.files, ['src/**/*.ts']);
});

test('no files config option remains undefined', () => {
	const flatConfig = xoToEslintConfig([{files: undefined, space: true}]);

	assert.equal(flatConfig.at(-1)?.files, undefined);
});

test('prettier: true preserves special rules but keeps non-special formatting rules off', () => {
	const flatConfig = xoToEslintConfig([{prettier: true}]);

	const prettierRuleConfig = flatConfig.find(config =>
		config?.rules?.['prettier/prettier'] !== undefined);

	// Special rules are re-enabled
	assert.equal(prettierRuleConfig?.rules?.['curly'], 'error');
	assert.equal(prettierRuleConfig?.rules?.['no-unexpected-multiline'], 'error');
	assert.deepEqual(prettierRuleConfig?.rules?.['@stylistic/quotes'], ['error', 'single', {avoidEscape: true}]);
	assert.deepEqual(prettierRuleConfig?.rules?.['@stylistic/no-mixed-operators'], [
		'error',
		{
			groups: [
				['+', '-', '*', '/', '%', '**', '??'],
				['&', '|', '^', '~', '<<', '>>', '>>>', '??'],
				['==', '!=', '===', '!==', '>', '>=', '<', '<=', '??'],
				['&&', '||', '??'],
				['in', 'instanceof', '??'],
			],
		},
	]);
	assert.deepEqual(prettierRuleConfig?.rules?.['prefer-arrow-callback'], ['error', {allowNamedFunctions: true}]);
	assert.equal(prettierRuleConfig?.rules?.['arrow-body-style'], 'error');

	// Non-special formatting rules remain off
	assert.equal(prettierRuleConfig?.rules?.['@stylistic/semi'], 'off');
	assert.equal(prettierRuleConfig?.rules?.['@stylistic/indent'], 'off');
});

test('prettier: compat preserves special rules while keeping formatting rules off', () => {
	const flatConfig = xoToEslintConfig([{prettier: 'compat'}]);

	const compatConfig = flatConfig.find(config =>
		config?.rules?.['@stylistic/semi'] === 'off');

	assert.ok(compatConfig);
	assert.equal(compatConfig?.rules?.['@stylistic/indent'], 'off');
	assert.equal(compatConfig?.rules?.['curly'], 'error');
	assert.equal(compatConfig?.rules?.['no-unexpected-multiline'], 'error');
	// `eslint-config-prettier` disables quotes in compat mode since the user's own Prettier config controls quote style.
	assert.equal(compatConfig?.rules?.['@stylistic/quotes'], 0);
	assert.deepEqual(compatConfig?.rules?.['@stylistic/no-mixed-operators'], [
		'error',
		{
			groups: [
				['+', '-', '*', '/', '%', '**', '??'],
				['&', '|', '^', '~', '<<', '>>', '>>>', '??'],
				['==', '!=', '===', '!==', '>', '>=', '<', '<=', '??'],
				['&&', '||', '??'],
				['in', 'instanceof', '??'],
			],
		},
	]);
});

test('global ignores are respected', () => {
	const flatConfig = xoToEslintConfig([
		{ignores: ['**/test']},
	]);

	assert.deepEqual(flatConfig.at(-1), {ignores: ['**/test']});
});

test('global ignores as strings are respected', () => {
	const flatConfig = xoToEslintConfig([
		{ignores: '**/test'},
	]);

	assert.deepEqual(flatConfig.at(-1), {ignores: ['**/test']});
});

test('global ignores with names are respected', () => {
	const flatConfig = xoToEslintConfig([
		{name: 'test-ignores', ignores: '**/test'},
	]);

	assert.deepEqual(flatConfig.at(-1), {name: 'test-ignores', ignores: ['**/test']});
});

test('empty configs are filtered', () => {
	const flatConfig = xoToEslintConfig([
		{name: 'test-ignores', ignores: '**/test'},
		{},
		{},
		{},
		{rules: {}},
	]);

	assert.deepEqual(flatConfig.at(-2), {name: 'test-ignores', ignores: ['**/test']});
});

test('supports ESLint-native files format with nested arrays', () => {
	const flatConfig = xoToEslintConfig([{files: ['**/*.svelte', ['**/*.test.*', '**/*.spec.*']]}]);

	assert.deepEqual(flatConfig.at(-1)?.files, ['**/*.svelte', ['**/*.test.*', '**/*.spec.*']]);
});

test('Linter.Config objects are accepted as XoConfigItem', () => {
	// Simulates spreading an ESLint plugin config (typed as Linter.Config) into XO config
	const eslintPluginConfig: Linter.Config = {
		files: ['**/*.svelte'],
		rules: {'no-console': 'warn'},
	};

	const flatConfig = xoToEslintConfig([eslintPluginConfig]);

	assert.deepEqual(flatConfig.at(-1)?.files, ['**/*.svelte']);
	assert.equal(flatConfig.at(-1)?.rules?.['no-console'], 'warn');
});

test('prettier option does not crash when linting JSON files', () => {
	// A config item without `files` applies globally, so XO's injected `prettier/prettier`
	// rule also runs on `package.json` (which uses the `json/json` language). The Prettier
	// plugin must not be wrapped by `@eslint/compat`, which throws on non-JS languages.
	const flatConfig = xoToEslintConfig([{space: true, prettier: true}]);
	const linter = new Linter();

	const messages = linter.verify('{\n  "name": "foo"\n}\n', flatConfig, {filename: 'package.json'});
	assert.ok(messages.every(message => !message.fatal), 'linting JSON should not produce fatal errors');
});

test('base config applies to framework file types', () => {
	const flatConfig = xoToEslintConfig(undefined);
	const baseConfig = flatConfig.find(config => config.name === 'xo/base');
	const filesGlob = baseConfig?.files?.[0];

	if (typeof filesGlob !== 'string') {
		throw new TypeError('expected xo/base files[0] to be a string glob');
	}

	const unmatchedExtensions = frameworkExtensions.filter(extension => !micromatch.isMatch(`test.${extension}`, filesGlob));
	assert.deepEqual(unmatchedExtensions, [], 'base config should match all framework file extensions');
});
