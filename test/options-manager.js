import process from 'node:process';
import path from 'node:path';
import test from 'ava';
import slash from 'slash';
import createEsmUtils from 'esm-utils';
import MurmurHash3 from 'imurmurhash';
import {DEFAULT_EXTENSION, DEFAULT_IGNORES, TSCONFIG_DEFAULTS} from '../lib/constants.js';
import * as manager from '../lib/options-manager.js';

const {__dirname, require, readJson, readJsonSync} = createEsmUtils(import.meta);
const parentConfig = readJsonSync('./fixtures/nested/package.json');
const childConfig = readJsonSync('./fixtures/nested/child/package.json');
const prettierConfig = readJsonSync('./fixtures/prettier/package.json');
const enginesConfig = readJsonSync('./fixtures/engines/package.json');

process.chdir(__dirname);

test('normalizeOptions: makes all the options plural and arrays', t => {
	const options = manager.normalizeOptions({
		env: 'node',
		global: 'foo',
		ignore: 'test.js',
		plugin: 'my-plugin',
		rule: {'my-rule': 'foo'},
		setting: {'my-rule': 'bar'},
		extend: 'foo',
		extension: 'html',
	});

	t.deepEqual(options, {
		envs: [
			'node',
		],
		extends: [
			'foo',
		],
		extensions: [
			'html',
		],
		globals: [
			'foo',
		],
		ignores: [
			'test.js',
		],
		plugins: [
			'my-plugin',
		],
		rules: {
			'my-rule': 'foo',
		},
		settings: {
			'my-rule': 'bar',
		},
	});
});

test('normalizeOptions: falsie values stay falsie', t => {
	t.deepEqual(manager.normalizeOptions({}), {});
});

test('buildConfig: defaults', t => {
	const config = manager.buildConfig({});
	t.regex(slash(config.cacheLocation), /[\\/]\.cache\/xo-linter\/xo-cache.json[\\/]?$/u);
	t.is(config.useEslintrc, false);
	t.is(config.cache, true);
	t.true(config.baseConfig.extends[0].includes('eslint-config-xo'));
});

test('buildConfig: space: true', t => {
	const config = manager.buildConfig({space: true});
	t.deepEqual(config.baseConfig.rules.indent, ['error', 2, {SwitchCase: 1}]);
});

test('buildConfig: space: 4', t => {
	const config = manager.buildConfig({space: 4});
	t.deepEqual(config.baseConfig.rules.indent, ['error', 4, {SwitchCase: 1}]);
});

test('buildConfig: semicolon', t => {
	const config = manager.buildConfig({semicolon: false, nodeVersion: '12'});
	t.deepEqual(config.baseConfig.rules.semi, ['error', 'never']);
	t.deepEqual(config.baseConfig.rules['semi-spacing'], ['error', {before: false, after: true}]);
});

test('buildConfig: prettier: true', t => {
	const config = manager.buildConfig({prettier: true, extends: ['xo-react']}, {});

	t.deepEqual(config.baseConfig.plugins, ['prettier']);
	// Sets the `semi`, `useTabs` and `tabWidth` options in `prettier/prettier` based on the XO `space` and `semicolon` options
	// Sets `singleQuote`, `trailingComma`, `bracketSpacing` and `bracketSameLine` with XO defaults
	t.deepEqual(config.baseConfig.rules['prettier/prettier'], ['error', {
		useTabs: true,
		bracketSpacing: false,
		bracketSameLine: false,
		semi: true,
		singleQuote: true,
		tabWidth: 2,
		trailingComma: 'all',
	}]);
	// eslint-prettier-config must always be last
	t.is(config.baseConfig.extends[config.baseConfig.extends.length - 1], 'plugin:prettier/recommended');
	// Indent rule is not enabled
	t.is(config.baseConfig.rules.indent, undefined);
	// Semi rule is not enabled
	t.is(config.baseConfig.rules.semi, undefined);
	// Semi-spacing is not enabled
	t.is(config.baseConfig.rules['semi-spacing'], undefined);
});

test('buildConfig: prettier: true, typescript file', t => {
	const config = manager.buildConfig({prettier: true, ts: true}, {});

	t.deepEqual(config.baseConfig.plugins, ['prettier']);
	// Sets the `semi`, `useTabs` and `tabWidth` options in `prettier/prettier` based on the XO `space` and `semicolon` options
	// Sets `singleQuote`, `trailingComma`, `bracketSpacing` and `bracketSameLine` with XO defaults
	t.deepEqual(config.baseConfig.rules['prettier/prettier'], ['error', {
		useTabs: true,
		bracketSpacing: false,
		bracketSameLine: false,
		semi: true,
		singleQuote: true,
		tabWidth: 2,
		trailingComma: 'all',
	}]);

	// eslint-prettier-config must always be last
	t.is(config.baseConfig.extends[config.baseConfig.extends.length - 1], 'plugin:prettier/recommended');
	t.regex(config.baseConfig.extends[config.baseConfig.extends.length - 2], /xo-typescript/);

	// Indent rule is not enabled
	t.is(config.baseConfig.rules.indent, undefined);
	// Semi rule is not enabled
	t.is(config.baseConfig.rules.semi, undefined);
	// Semi-spacing is not enabled
	t.is(config.baseConfig.rules['semi-spacing'], undefined);
});

test('buildConfig: prettier: true, semicolon: false', t => {
	const config = manager.buildConfig({prettier: true, semicolon: false}, {});

	// Sets the `semi` options in `prettier/prettier` based on the XO `semicolon` option
	t.deepEqual(config.baseConfig.rules['prettier/prettier'], ['error', {
		useTabs: true,
		bracketSpacing: false,
		bracketSameLine: false,
		semi: false,
		singleQuote: true,
		tabWidth: 2,
		trailingComma: 'all',
	}]);
	// Indent rule is not enabled
	t.is(config.baseConfig.rules.indent, undefined);
	// Semi rule is not enabled
	t.is(config.baseConfig.rules.semi, undefined);
	// Semi-spacing is not enabled
	t.is(config.baseConfig.rules['semi-spacing'], undefined);
});

test('buildConfig: prettier: true, space: 4', t => {
	const config = manager.buildConfig({prettier: true, space: 4}, {});

	// Sets `useTabs` and `tabWidth` options in `prettier/prettier` rule based on the XO `space` options
	t.deepEqual(config.baseConfig.rules['prettier/prettier'], ['error', {
		useTabs: false,
		bracketSpacing: false,
		bracketSameLine: false,
		semi: true,
		singleQuote: true,
		tabWidth: 4,
		trailingComma: 'all',
	}]);
	// Indent rule is not enabled
	t.is(config.baseConfig.rules.indent, undefined);
	// Semi rule is not enabled
	t.is(config.baseConfig.rules.semi, undefined);
	// Semi-spacing is not enabled
	t.is(config.baseConfig.rules['semi-spacing'], undefined);
});

test('buildConfig: prettier: true, space: true', t => {
	const config = manager.buildConfig({prettier: true, space: true}, {});

	// Sets `useTabs` and `tabWidth` options in `prettier/prettier` rule based on the XO `space` options
	t.deepEqual(config.baseConfig.rules['prettier/prettier'], ['error', {
		useTabs: false,
		bracketSpacing: false,
		bracketSameLine: false,
		semi: true,
		singleQuote: true,
		tabWidth: 2,
		trailingComma: 'all',
	}]);
	// Indent rule is not enabled
	t.is(config.baseConfig.rules.indent, undefined);
	// Semi rule is not enabled
	t.is(config.baseConfig.rules.semi, undefined);
	// Semi-spacing is not enabled
	t.is(config.baseConfig.rules['semi-spacing'], undefined);
});

test('buildConfig: merge with prettier config', t => {
	const cwd = path.resolve('fixtures', 'prettier');
	const config = manager.buildConfig({cwd, prettier: true}, prettierConfig.prettier);

	// Sets the `semi` options in `prettier/prettier` based on the XO `semicolon` option
	t.deepEqual(config.baseConfig.rules['prettier/prettier'], ['error', prettierConfig.prettier]);
	// Indent rule is not enabled
	t.is(config.baseConfig.rules.indent, undefined);
	// Semi rule is not enabled
	t.is(config.baseConfig.rules.semi, undefined);
	// Semi-spacing is not enabled
	t.is(config.baseConfig.rules['semi-spacing'], undefined);
});

test('buildConfig: engines: undefined', t => {
	const config = manager.buildConfig({});

	// Do not include any Node.js version specific rules
	t.is(config.baseConfig.rules['prefer-object-spread'], 'off');
	t.is(config.baseConfig.rules['prefer-rest-params'], 'off');
	t.is(config.baseConfig.rules['prefer-destructuring'], 'off');
	t.is(config.baseConfig.rules['promise/prefer-await-to-then'], 'off');
	t.is(config.baseConfig.rules['unicorn/prefer-flat-map'], 'off');
	t.is(config.baseConfig.rules['n/prefer-promises/dns'], 'off');
	t.is(config.baseConfig.rules['n/prefer-promises/fs'], 'off');
	t.is(config.baseConfig.rules['n/no-unsupported-features/es-builtins'], undefined);
	t.is(config.baseConfig.rules['n/no-unsupported-features/es-syntax'], undefined);
	t.is(config.baseConfig.rules['n/no-unsupported-features/node-builtins'], undefined);
});

test('buildConfig: nodeVersion: false', t => {
	const config = manager.buildConfig({nodeVersion: false});

	// Override all the rules specific to Node.js version
	t.is(config.baseConfig.rules['prefer-object-spread'], 'off');
	t.is(config.baseConfig.rules['prefer-rest-params'], 'off');
	t.is(config.baseConfig.rules['prefer-destructuring'], 'off');
	t.is(config.baseConfig.rules['promise/prefer-await-to-then'], 'off');
	t.is(config.baseConfig.rules['unicorn/prefer-flat-map'], 'off');
	t.is(config.baseConfig.rules['n/prefer-promises/dns'], 'off');
	t.is(config.baseConfig.rules['n/prefer-promises/fs'], 'off');
});

test('buildConfig: nodeVersion: >=6', t => {
	const config = manager.buildConfig({nodeVersion: '>=6'});

	// Turn off rule if we support Node.js below 7.6.0
	t.is(config.baseConfig.rules['promise/prefer-await-to-then'], 'off');
	// Set n/no-unsupported-features rules with the nodeVersion
	t.deepEqual(config.baseConfig.rules['n/no-unsupported-features/es-builtins'], ['error', {version: '>=6'}]);
	t.deepEqual(
		config.baseConfig.rules['n/no-unsupported-features/es-syntax'],
		['error', {version: '>=6', ignores: ['modules']}],
	);
	t.deepEqual(config.baseConfig.rules['n/no-unsupported-features/node-builtins'], ['error', {version: '>=6'}]);
});

test('buildConfig: nodeVersion: >=8', t => {
	const config = manager.buildConfig({nodeVersion: '>=8'});

	// Do not turn off rule if we support only Node.js above 7.6.0
	t.is(config.baseConfig.rules['promise/prefer-await-to-then'], undefined);
	// Set n/no-unsupported-features rules with the nodeVersion
	t.deepEqual(config.baseConfig.rules['n/no-unsupported-features/es-builtins'], ['error', {version: '>=8'}]);
	t.deepEqual(
		config.baseConfig.rules['n/no-unsupported-features/es-syntax'],
		['error', {version: '>=8', ignores: ['modules']}],
	);
	t.deepEqual(config.baseConfig.rules['n/no-unsupported-features/node-builtins'], ['error', {version: '>=8'}]);
});

test('mergeWithPrettierConfig: use `singleQuote`, `trailingComma`, `bracketSpacing` and `bracketSameLine` from `prettier` config if defined', t => {
	const prettierOptions = {
		singleQuote: false,
		trailingComma: 'none',
		bracketSpacing: false,
		bracketSameLine: false,
	};
	const result = manager.mergeWithPrettierConfig({}, prettierOptions);
	const expected = {

		...prettierOptions,
		tabWidth: 2,
		useTabs: true,
		semi: true,
	};
	t.deepEqual(result, expected);
});

test('mergeWithPrettierConfig: determine `tabWidth`, `useTabs`, `semi` from xo config', t => {
	const prettierOptions = {
		tabWidth: 4,
		useTabs: false,
		semi: false,
	};
	const result = manager.mergeWithPrettierConfig({space: 4, semicolon: false}, {});
	const expected = {
		bracketSpacing: false,
		bracketSameLine: false,
		singleQuote: true,
		trailingComma: 'all',
		...prettierOptions,
	};
	t.deepEqual(result, expected);
});

test('mergeWithPrettierConfig: determine `tabWidth`, `useTabs`, `semi` from prettier config', t => {
	const prettierOptions = {
		useTabs: false,
		semi: false,
		tabWidth: 4,
	};
	const result = manager.mergeWithPrettierConfig({}, prettierOptions);
	const expected = {
		bracketSpacing: false,
		bracketSameLine: false,
		singleQuote: true,
		trailingComma: 'all',
		...prettierOptions,
	};
	t.deepEqual(result, expected);
});

test('mergeWithPrettierConfig: throw error is `semi`/`semicolon` conflicts', t => {
	t.throws(() => manager.mergeWithPrettierConfig(
		{semicolon: true},
		{semi: false},
	));
	t.throws(() => manager.mergeWithPrettierConfig(
		{semicolon: false},
		{semi: true},
	));

	t.notThrows(() => manager.mergeWithPrettierConfig(
		{semicolon: true},
		{semi: true},
	));
	t.notThrows(() => manager.mergeWithPrettierConfig({semicolon: false}, {semi: false}));
});

test('mergeWithPrettierConfig: throw error is `space`/`useTabs` conflicts', t => {
	t.throws(() => manager.mergeWithPrettierConfig({space: false}, {useTabs: false}));
	t.throws(() => manager.mergeWithPrettierConfig({space: true}, {useTabs: true}));

	t.notThrows(() => manager.mergeWithPrettierConfig({space: 4}, {useTabs: false}));
	t.notThrows(() => manager.mergeWithPrettierConfig({space: true}, {useTabs: false}));
	t.notThrows(() => manager.mergeWithPrettierConfig({space: false}, {useTabs: true}));
});

test('mergeWithPrettierConfig: throw error is `space`/`tabWidth` conflicts', t => {
	t.throws(() => manager.mergeWithPrettierConfig({space: 4}, {tabWidth: 2}));
	t.throws(() => manager.mergeWithPrettierConfig({space: 0}, {tabWidth: 2}));
	t.throws(() => manager.mergeWithPrettierConfig({space: 2}, {tabWidth: 0}));

	t.notThrows(() => manager.mergeWithPrettierConfig({space: 4}, {tabWidth: 4}));
	t.notThrows(() => manager.mergeWithPrettierConfig({space: false}, {tabWidth: 4}));
	t.notThrows(() => manager.mergeWithPrettierConfig({space: true}, {tabWidth: 4}));
});

test('buildConfig: rules', t => {
	const rules = {'object-curly-spacing': ['error', 'always']};
	const config = manager.buildConfig({rules, nodeVersion: '12'});
	t.deepEqual(config.baseConfig.rules['object-curly-spacing'], rules['object-curly-spacing']);
});

test('buildConfig: parser', t => {
	const parser = 'babel-eslint';
	const config = manager.buildConfig({parser});
	t.deepEqual(config.baseConfig.parser, parser);
});

test('buildConfig: processor', t => {
	const processor = 'svelte3/svelte3';
	const config = manager.buildConfig({processor});
	t.deepEqual(config.baseConfig.processor, processor);
});

test('buildConfig: settings', t => {
	const settings = {'import/resolver': {webpack: {}}};
	const config = manager.buildConfig({settings});
	t.deepEqual(config.baseConfig.settings, settings);
});

test('buildConfig: finds webpack config file', t => {
	const cwd = path.resolve('fixtures', 'webpack', 'with-config');
	const config = manager.buildConfig({cwd});
	const expected = {webpack: {config: path.resolve(cwd, 'webpack.config.js')}};
	t.deepEqual(config.baseConfig.settings['import/resolver'], expected);
});

test('buildConfig: webpack option sets resolver', t => {
	const config = manager.buildConfig({webpack: true, settings: {'import/resolver': 'node'}});
	t.deepEqual(config.baseConfig.settings['import/resolver'], {webpack: {}, node: {}});
});

test('buildConfig: webpack option handles object values', t => {
	const config = manager.buildConfig({webpack: {foo: 1}, settings: {'import/resolver': 'node'}});
	t.deepEqual(config.baseConfig.settings['import/resolver'], {webpack: {foo: 1}, node: {}});
});

test('buildConfig: webpack resolver is not added automatically if webpack option is set to false', t => {
	const cwd = path.resolve('fixtures', 'webpack', 'with-config');
	const config = manager.buildConfig({cwd, webpack: false, settings: {}});
	t.deepEqual(config.baseConfig.settings['import/resolver'], {});
});

test('buildConfig: webpack option is merged with import/resolver', t => {
	const settings = {'import/resolver': {webpack: {bar: 1}}};
	const config = manager.buildConfig({settings, webpack: {foo: 1}});
	t.deepEqual(config.baseConfig.settings['import/resolver'], {webpack: {foo: 1, bar: 1}});
});

test('buildConfig: extends', t => {
	const config = manager.buildConfig({
		extends: [
			'plugin:foo/bar',
			'eslint-config-prettier',
		],
	});

	t.deepEqual(config.baseConfig.extends.slice(-2), [
		'plugin:foo/bar',
		path.resolve('../node_modules/eslint-config-prettier/index.js'),
	]);
});

test('buildConfig: typescript', t => {
	const config = manager.buildConfig({ts: true, tsConfigPath: './tsconfig.json'});

	t.regex(config.baseConfig.extends[config.baseConfig.extends.length - 1], /xo-typescript/);
	t.is(config.baseConfig.parser, require.resolve('@typescript-eslint/parser'));
	t.deepEqual(config.baseConfig.parserOptions, {
		warnOnUnsupportedTypeScriptVersion: false,
		ecmaFeatures: {jsx: true},
		project: './tsconfig.json',
		projectFolderIgnoreList: [/\/node_modules\/(?!.*\.cache\/xo-linter)/],
	});
	t.is(config.baseConfig.rules['import/named'], 'off');
});

test('buildConfig: typescript with parserOption', t => {
	const config = manager.buildConfig({
		ts: true,
		parserOptions: {projectFolderIgnoreList: [], sourceType: 'script'},
		tsConfigPath: 'path/to/tmp-tsconfig.json',
	}, {});

	t.is(config.baseConfig.parser, require.resolve('@typescript-eslint/parser'));
	t.deepEqual(config.baseConfig.parserOptions, {
		warnOnUnsupportedTypeScriptVersion: false,
		ecmaFeatures: {jsx: true},
		projectFolderIgnoreList: [],
		project: 'path/to/tmp-tsconfig.json',
		sourceType: 'script',
	});
});

test('buildConfig: parserOptions', t => {
	const config = manager.buildConfig({
		parserOptions: {
			sourceType: 'script',
		},
	});

	t.is(config.baseConfig.parserOptions.sourceType, 'script');
});

test('buildConfig: prevents useEslintrc option', t => {
	t.throws(() => {
		manager.buildConfig({
			useEslintrc: true,
		});
	}, {
		instanceOf: Error,
		message: 'The `useEslintrc` option is not supported',
	});
});

test('findApplicableOverrides', t => {
	const result = manager.findApplicableOverrides('/user/dir/foo.js', [
		{files: '**/f*.js'},
		{files: '**/bar.js'},
		{files: '**/*oo.js'},
		{files: '**/*.txt'},
	]);

	t.is(result.hash, 0b1010);
	t.deepEqual(result.applicable, [
		{files: '**/f*.js'},
		{files: '**/*oo.js'},
	]);
});

test('mergeWithFileConfig: use child if closest', async t => {
	const cwd = path.resolve('fixtures', 'nested', 'child');
	const {options} = await manager.mergeWithFileConfig({cwd});
	const eslintConfigId = new MurmurHash3(path.join(cwd, 'package.json')).result();
	const expected = {...childConfig.xo, extensions: DEFAULT_EXTENSION, ignores: DEFAULT_IGNORES, cwd, eslintConfigId};
	t.deepEqual(options, expected);
});

test('mergeWithFileConfig: use parent if closest', async t => {
	const cwd = path.resolve('fixtures', 'nested');
	const {options} = await manager.mergeWithFileConfig({cwd});
	const eslintConfigId = new MurmurHash3(path.join(cwd, 'package.json')).result();
	const expected = {...parentConfig.xo, extensions: DEFAULT_EXTENSION, ignores: DEFAULT_IGNORES, cwd, eslintConfigId};
	t.deepEqual(options, expected);
});

test('mergeWithFileConfig: use parent if child is ignored', async t => {
	const cwd = path.resolve('fixtures', 'nested');
	const filePath = path.resolve(cwd, 'child-ignore', 'file.js');
	const {options} = await manager.mergeWithFileConfig({cwd, filePath});
	const eslintConfigId = new MurmurHash3(path.join(cwd, 'package.json')).result();
	const expected = {...parentConfig.xo, extensions: DEFAULT_EXTENSION, ignores: DEFAULT_IGNORES, cwd, filePath, eslintConfigId};
	t.deepEqual(options, expected);
});

test('mergeWithFileConfig: use child if child is empty', async t => {
	const cwd = path.resolve('fixtures', 'nested', 'child-empty');
	const {options} = await manager.mergeWithFileConfig({cwd});
	const eslintConfigId = new MurmurHash3(path.join(cwd, 'package.json')).result();
	t.deepEqual(options, {extensions: DEFAULT_EXTENSION, ignores: DEFAULT_IGNORES, cwd, eslintConfigId});
});

test('mergeWithFileConfig: read engines from package.json', async t => {
	const cwd = path.resolve('fixtures', 'engines');
	const {options} = await manager.mergeWithFileConfig({cwd});
	const eslintConfigId = new MurmurHash3().result();
	const expected = {nodeVersion: enginesConfig.engines.node, extensions: DEFAULT_EXTENSION, ignores: DEFAULT_IGNORES, cwd, eslintConfigId};
	t.deepEqual(options, expected);
});

test('mergeWithFileConfig: XO engine options supersede package.json\'s', async t => {
	const cwd = path.resolve('fixtures', 'engines');
	const {options} = await manager.mergeWithFileConfig({cwd, nodeVersion: '>=8'});
	const eslintConfigId = new MurmurHash3().result();
	const expected = {nodeVersion: '>=8', extensions: DEFAULT_EXTENSION, ignores: DEFAULT_IGNORES, cwd, eslintConfigId};
	t.deepEqual(options, expected);
});

test('mergeWithFileConfig: XO engine options false supersede package.json\'s', async t => {
	const cwd = path.resolve('fixtures', 'engines');
	const {options} = await manager.mergeWithFileConfig({cwd, nodeVersion: false});
	const eslintConfigId = new MurmurHash3().result();
	const expected = {nodeVersion: false, extensions: DEFAULT_EXTENSION, ignores: DEFAULT_IGNORES, cwd, eslintConfigId};
	t.deepEqual(options, expected);
});

test('mergeWithFileConfig: resolves expected typescript file options', async t => {
	const cwd = path.resolve('fixtures', 'typescript', 'child');
	const filePath = path.resolve(cwd, 'file.ts');
	const tsConfigPath = path.resolve(cwd, 'tsconfig.json');
	const tsConfig = await readJson(tsConfigPath);
	const {options} = await manager.mergeWithFileConfig({cwd, filePath});
	const eslintConfigId = new MurmurHash3(path.resolve(cwd, 'package.json')).hash(tsConfigPath).result();
	const expected = {
		filePath,
		extensions: DEFAULT_EXTENSION,
		ignores: DEFAULT_IGNORES,
		cwd,
		semicolon: false,
		ts: true,
		tsConfigPath,
		eslintConfigId,
		tsConfig: manager.tsConfigResolvePaths(tsConfig, tsConfigPath),
	};
	t.deepEqual(options, expected);
});

test('mergeWithFileConfig: resolves expected tsx file options', async t => {
	const cwd = path.resolve('fixtures', 'typescript', 'child');
	const filePath = path.resolve(cwd, 'file.tsx');
	const {options} = await manager.mergeWithFileConfig({cwd, filePath});
	const tsConfigPath = path.resolve(cwd, 'tsconfig.json');
	const tsConfig = await readJson(tsConfigPath);
	const eslintConfigId = new MurmurHash3(path.join(cwd, 'package.json')).hash(tsConfigPath).result();
	const expected = {
		filePath,
		extensions: DEFAULT_EXTENSION,
		ignores: DEFAULT_IGNORES,
		cwd,
		semicolon: false,
		ts: true,
		tsConfigPath,
		eslintConfigId,
		tsConfig: manager.tsConfigResolvePaths(tsConfig, tsConfigPath),
	};
	t.deepEqual(options, expected);
});

test('mergeWithFileConfig: uses specified parserOptions.project as tsconfig', async t => {
	const cwd = path.resolve('fixtures', 'typescript', 'parseroptions-project');
	const filePath = path.resolve(cwd, 'included-file.ts');
	const expectedTsConfigPath = path.resolve(cwd, 'projectconfig.json');
	const {options} = await manager.mergeWithFileConfig({cwd, filePath});
	t.is(options.tsConfigPath, expectedTsConfigPath);
});

test('mergeWithFileConfig: correctly resolves relative tsconfigs excluded file', async t => {
	const cwd = path.resolve('fixtures', 'typescript', 'relative-configs');
	const excludedFilePath = path.resolve(cwd, 'excluded-file.ts');
	const excludeTsConfigPath = new RegExp(`${slash(cwd)}/node_modules/.cache/xo-linter/tsconfig\\..*\\.json[\\/]?$`, 'u');
	const {options} = await manager.mergeWithFileConfig({cwd, filePath: excludedFilePath});
	t.regex(slash(options.tsConfigPath), excludeTsConfigPath);
});

test('mergeWithFileConfig: correctly resolves relative tsconfigs included file', async t => {
	const cwd = path.resolve('fixtures', 'typescript', 'relative-configs');
	const includedFilePath = path.resolve(cwd, 'included-file.ts');
	const includeTsConfigPath = path.resolve(cwd, 'config/tsconfig.json');
	const {options} = await manager.mergeWithFileConfig({cwd, filePath: includedFilePath});
	t.is(options.tsConfigPath, includeTsConfigPath);
});

test('mergeWithFileConfig: uses generated tsconfig if specified parserOptions.project excludes file', async t => {
	const cwd = path.resolve('fixtures', 'typescript', 'parseroptions-project');
	const filePath = path.resolve(cwd, 'excluded-file.ts');
	const expectedTsConfigPath = new RegExp(`${slash(cwd)}/node_modules/.cache/xo-linter/tsconfig\\..*\\.json[\\/]?$`, 'u');
	const {options} = await manager.mergeWithFileConfig({cwd, filePath});
	t.regex(slash(options.tsConfigPath), expectedTsConfigPath);
});

test('mergeWithFileConfig: uses generated tsconfig if specified parserOptions.project misses file', async t => {
	const cwd = path.resolve('fixtures', 'typescript', 'parseroptions-project');
	const filePath = path.resolve(cwd, 'missed-by-options-file.ts');
	const expectedTsConfigPath = new RegExp(`${slash(cwd)}/node_modules/.cache/xo-linter/tsconfig\\..*\\.json[\\/]?$`, 'u');
	const {options} = await manager.mergeWithFileConfig({cwd, filePath});
	t.regex(slash(options.tsConfigPath), expectedTsConfigPath);
});

test('mergeWithFileConfig: auto generated ts config extends found ts config if file is not covered', async t => {
	const cwd = path.resolve('fixtures', 'typescript', 'extends-config');
	const filePath = path.resolve(cwd, 'does-not-matter.ts');
	const expectedConfigPath = new RegExp(`${slash(cwd)}/node_modules/.cache/xo-linter/tsconfig\\..*\\.json[\\/]?$`, 'u');
	const expected = {
		extends: path.resolve(cwd, 'tsconfig.json'),
	};
	const {options} = await manager.mergeWithFileConfig({cwd, filePath});
	t.regex(slash(options.tsConfigPath), expectedConfigPath);
	t.deepEqual(expected, options.tsConfig);
});

test('mergeWithFileConfig: used found ts config if file is covered', async t => {
	const cwd = path.resolve('fixtures', 'typescript', 'extends-config');
	const filePath = path.resolve(cwd, 'foo.ts');
	const expectedConfigPath = slash(path.resolve(cwd, 'tsconfig.json'));
	const {options} = await manager.mergeWithFileConfig({cwd, filePath});
	t.is(slash(options.tsConfigPath), expectedConfigPath);
});

test('mergeWithFileConfig: auto generated ts config extends found ts config if file is explicitly excluded', async t => {
	const cwd = path.resolve('fixtures', 'typescript', 'excludes');
	const filePath = path.resolve(cwd, 'excluded-file.ts');
	const expectedConfigPath = new RegExp(`${slash(cwd)}/node_modules/.cache/xo-linter/tsconfig\\..*\\.json[\\/]?$`, 'u');
	const expected = {
		extends: path.resolve(cwd, 'tsconfig.json'),
	};
	const {options} = await manager.mergeWithFileConfig({cwd, filePath});
	t.regex(slash(options.tsConfigPath), expectedConfigPath);
	t.deepEqual(expected, options.tsConfig);
});

test('mergeWithFileConfig: creates temp tsconfig if none present', async t => {
	const cwd = path.resolve('fixtures', 'typescript');
	const expectedConfigPath = new RegExp(`${slash(cwd)}/node_modules/.cache/xo-linter/tsconfig\\..*\\.json[\\/]?$`, 'u');
	const filePath = path.resolve(cwd, 'does-not-matter.ts');
	const {options} = await manager.mergeWithFileConfig({cwd, filePath});
	t.regex(slash(options.tsConfigPath), expectedConfigPath);
	t.deepEqual(options.tsConfig, TSCONFIG_DEFAULTS);
});

test('mergeWithFileConfig: tsconfig can properly extend configs in node_modules', async t => {
	const cwd = path.resolve('fixtures', 'typescript', 'extends-module');
	const expectedConfigPath = path.join(cwd, 'tsconfig.json');
	const filePath = path.resolve(cwd, 'does-not-matter.ts');
	await t.notThrowsAsync(manager.mergeWithFileConfig({cwd, filePath}));
	const {options} = await manager.mergeWithFileConfig({cwd, filePath});
	t.is(options.tsConfigPath, expectedConfigPath);
});

test('mergeWithFileConfig: tsconfig can properly extend tsconfig base node_modules', async t => {
	const cwd = path.resolve('fixtures', 'typescript', 'extends-tsconfig-bases');
	const expectedConfigPath = path.join(cwd, 'tsconfig.json');
	const filePath = path.resolve(cwd, 'does-not-matter.ts');
	await t.notThrowsAsync(manager.mergeWithFileConfig({cwd, filePath}));
	const {options} = await manager.mergeWithFileConfig({cwd, filePath});
	t.is(options.tsConfigPath, expectedConfigPath);
});

test('applyOverrides', t => {
	t.deepEqual(
		manager.applyOverrides(
			'file.js',
			{
				overrides: [
					{
						files: 'file.js',
						rules: {'rule-2': 'c'},
						extends: ['overrride-extend'],
						globals: ['override'],
						plugins: ['override-plugin'],
					},
				],
				rules: {'rule-1': 'a', 'rule-2': 'b'},
				extends: ['base-extend'],
				globals: ['base'],
				plugins: ['base-plugin'],
				cwd: '.',
			}),
		{
			options: {
				rules: {'rule-1': 'a', 'rule-2': 'c'},
				extends: ['base-extend', 'overrride-extend'],
				globals: ['base', 'override'],
				plugins: ['base-plugin', 'override-plugin'],
				envs: [],
				settings: {},
				cwd: '.',
			},
			hash: 1,
		},
	);
});
