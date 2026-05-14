
import test from 'ava';
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
	test(`throws for legacy property: ${property}`, t => {
		const config = [{}, {[property]: true}] as XoConfigItem[];
		const error = t.throws(() => {
			validateXoConfig(config);
		}, {instanceOf: Error});
		t.is(error?.message, `Invalid XO config property \`${property}\`. ${hint}`);
	});
}

test('does not throw for valid flat config properties', t => {
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

	t.notThrows(() => {
		validateXoConfig(config);
	});
});

test('does not throw for unknown properties', t => {
	const config = [{}, {somethingRandom: true}] as XoConfigItem[];
	t.notThrows(() => {
		validateXoConfig(config);
	});
});

test('throws for legacy property in later config items', t => {
	const config = [{}, {rules: {}}, {globals: {}}] as XoConfigItem[];
	t.throws(() => {
		validateXoConfig(config);
	}, {message: /Invalid XO config property `globals`/v});
});

test('skips base config at index 0', t => {
	const config = [{overrides: true} as unknown as XoConfigItem];
	t.notThrows(() => {
		validateXoConfig(config);
	});
});

test('preProcessXoConfig throws for legacy properties', t => {
	const config = [{}, {env: {browser: true}}] as XoConfigItem[];
	t.throws(() => {
		preProcessXoConfig(config);
	}, {message: /Invalid XO config property `env`/v});
});
