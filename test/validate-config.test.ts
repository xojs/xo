
import test from 'node:test';
import assert from 'node:assert/strict';
import {type XoConfigItem} from '../lib/types.js';
import {validateXoConfig, preProcessXoConfig} from '../lib/utils.js';

const legacyProperties: Array<[string, string]> = [
	['overrides', 'Use an array of config objects with `files` patterns instead.'],
	['extends', 'Spread the config directly into your XO config array.'],
	['env', 'Use `languageOptions.globals` instead.'],
	['globals', 'Move to `languageOptions.globals`.'],
	['parser', 'Move to `languageOptions.parser`.'],
	['parserOptions', 'Move to `languageOptions.parserOptions`.'],
	['root', 'Not needed in flat config.'],
	['ecmaVersion', 'Move to `languageOptions.ecmaVersion`.'],
	['sourceType', 'Move to `languageOptions.sourceType`.'],
	['noInlineConfig', 'Move to `linterOptions.noInlineConfig`.'],
	['reportUnusedDisableDirectives', 'Move to `linterOptions.reportUnusedDisableDirectives`.'],
	['ignorePatterns', 'Use `ignores` instead.'],
];

for (const [property, hint] of legacyProperties) {
	test(`throws for legacy property: ${property}`, () => {
		const config = [{}, {[property]: true}] as XoConfigItem[];
		assert.throws(() => {
			validateXoConfig(config);
		}, {message: `Invalid XO config property \`${property}\`. ${hint}`});
	});
}

test('does not throw for valid flat config properties', () => {
	const config: XoConfigItem[] = [
		{},
		{
			files: ['**/*.ts'],
			ignores: ['dist/**'],
			rules: {'no-console': 'error'},
			plugins: {},
			settings: {},
			name: 'my-config',
			languageOptions: {},
			linterOptions: {},
			space: true,
			semicolon: false,
			prettier: true,
			react: true,
		},
	];

	assert.doesNotThrow(() => {
		validateXoConfig(config);
	});
});

test('does not throw for unknown properties', () => {
	const config = [{}, {somethingRandom: true}] as XoConfigItem[];
	assert.doesNotThrow(() => {
		validateXoConfig(config);
	});
});

test('throws for legacy property in later config items', () => {
	const config = [{}, {rules: {}}, {globals: {}}] as XoConfigItem[];
	assert.throws(() => {
		validateXoConfig(config);
	}, {message: /Invalid XO config property `globals`/v});
});

test('skips base config at index 0', () => {
	const config = [{overrides: true} as unknown as XoConfigItem];
	assert.doesNotThrow(() => {
		validateXoConfig(config);
	});
});

test('preProcessXoConfig throws for legacy properties', () => {
	const config = [{}, {env: {browser: true}}] as XoConfigItem[];
	assert.throws(() => {
		preProcessXoConfig(config);
	}, {message: /Invalid XO config property `env`/v});
});
