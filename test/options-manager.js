import path from 'path';
import test from 'ava';
import omit from 'lodash/omit';
import {readJson} from 'fs-extra';
import proxyquire from 'proxyquire';
import slash from 'slash';
import {DEFAULT_EXTENSION, DEFAULT_IGNORES} from '../lib/constants';
import parentConfig from './fixtures/nested/package.json';
import childConfig from './fixtures/nested/child/package.json';
import prettierConfig from './fixtures/prettier/package.json';
import enginesConfig from './fixtures/engines/package.json';

process.chdir(__dirname);

const manager = proxyquire('../lib/options-manager', {
	'resolve-from': (cwd, path) => `cwd/${path}`
});

test('normalizeOptions: makes all the options plural and arrays', t => {
	const options = manager.normalizeOptions({
		env: 'node',
		global: 'foo',
		ignore: 'test.js',
		plugin: 'my-plugin',
		rule: {'my-rule': 'foo'},
		setting: {'my-rule': 'bar'},
		extend: 'foo',
		extension: 'html'
	});

	t.deepEqual(options, {
		envs: ['node'],
		globals: ['foo'],
		ignores: ['test.js'],
		plugins: ['my-plugin'],
		rules: {'my-rule': 'foo'},
		settings: {'my-rule': 'bar'},
		extends: ['foo'],
		extensions: ['html']
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
	t.is(config.baseConfig.extends[0], 'xo/esnext');
});

test('buildConfig: esnext', t => {
	const config = manager.buildConfig({esnext: false});
	t.is(config.baseConfig.extends[0], 'xo');
});

test('buildConfig: space: true', t => {
	const config = manager.buildConfig({space: true});
	t.deepEqual(config.rules.indent, ['error', 2, {SwitchCase: 1}]);
});

test('buildConfig: space: 4', t => {
	const config = manager.buildConfig({space: 4});
	t.deepEqual(config.rules.indent, ['error', 4, {SwitchCase: 1}]);
});

test('buildConfig: semicolon', t => {
	const config = manager.buildConfig({semicolon: false, nodeVersion: '12'});
	t.deepEqual(config.rules.semi, ['error', 'never']);
	t.deepEqual(config.rules['semi-spacing'], ['error', {before: false, after: true}]);
});

test('buildConfig: prettier: true', t => {
	const config = manager.buildConfig({prettier: true, extends: ['xo-react']}, {});

	t.deepEqual(config.plugins, ['prettier']);
	// Sets the `semi`, `useTabs` and `tabWidth` options in `prettier/prettier` based on the XO `space` and `semicolon` options
	// Sets `singleQuote`, `trailingComma`, `bracketSpacing` and `jsxBracketSameLine` with XO defaults
	t.deepEqual(config.rules['prettier/prettier'], ['error', {
		useTabs: true,
		bracketSpacing: false,
		jsxBracketSameLine: false,
		semi: true,
		singleQuote: true,
		tabWidth: 2,
		trailingComma: 'none'
	}]);
	// eslint-prettier-config must always be last
	t.deepEqual(config.baseConfig.extends[config.baseConfig.extends.length - 1], 'prettier/unicorn');
	t.deepEqual(config.baseConfig.extends[config.baseConfig.extends.length - 2], 'prettier');
	// Indent rule is not enabled
	t.is(config.rules.indent, undefined);
	// Semi rule is not enabled
	t.is(config.rules.semi, undefined);
	// Semi-spacing is not enabled
	t.is(config.rules['semi-spacing'], undefined);
});

test('buildConfig: prettier: true, typescript file', t => {
	const config = manager.buildConfig({prettier: true, ts: true}, {});

	t.deepEqual(config.plugins, ['prettier']);
	// Sets the `semi`, `useTabs` and `tabWidth` options in `prettier/prettier` based on the XO `space` and `semicolon` options
	// Sets `singleQuote`, `trailingComma`, `bracketSpacing` and `jsxBracketSameLine` with XO defaults
	t.deepEqual(config.rules['prettier/prettier'], ['error', {
		useTabs: true,
		bracketSpacing: false,
		jsxBracketSameLine: false,
		semi: true,
		singleQuote: true,
		tabWidth: 2,
		trailingComma: 'none'
	}]);

	// eslint-prettier-config must always be last
	t.deepEqual(config.baseConfig.extends[config.baseConfig.extends.length - 1], 'prettier/@typescript-eslint');
	t.deepEqual(config.baseConfig.extends[config.baseConfig.extends.length - 2], 'prettier/unicorn');
	t.deepEqual(config.baseConfig.extends[config.baseConfig.extends.length - 3], 'prettier');
	t.deepEqual(config.baseConfig.extends[config.baseConfig.extends.length - 4], 'xo-typescript');

	// Indent rule is not enabled
	t.is(config.rules.indent, undefined);
	// Semi rule is not enabled
	t.is(config.rules.semi, undefined);
	// Semi-spacing is not enabled
	t.is(config.rules['semi-spacing'], undefined);
});

test('buildConfig: prettier: true, semicolon: false', t => {
	const config = manager.buildConfig({prettier: true, semicolon: false}, {});

	// Sets the `semi` options in `prettier/prettier` based on the XO `semicolon` option
	t.deepEqual(config.rules['prettier/prettier'], ['error', {
		useTabs: true,
		bracketSpacing: false,
		jsxBracketSameLine: false,
		semi: false,
		singleQuote: true,
		tabWidth: 2,
		trailingComma: 'none'
	}]);
	// Indent rule is not enabled
	t.is(config.rules.indent, undefined);
	// Semi rule is not enabled
	t.is(config.rules.semi, undefined);
	// Semi-spacing is not enabled
	t.is(config.rules['semi-spacing'], undefined);
});

test('buildConfig: prettier: true, space: 4', t => {
	const config = manager.buildConfig({prettier: true, space: 4}, {});

	// Sets `useTabs` and `tabWidth` options in `prettier/prettier` rule based on the XO `space` options
	t.deepEqual(config.rules['prettier/prettier'], ['error', {
		useTabs: false,
		bracketSpacing: false,
		jsxBracketSameLine: false,
		semi: true,
		singleQuote: true,
		tabWidth: 4,
		trailingComma: 'none'
	}]);
	// Indent rule is not enabled
	t.is(config.rules.indent, undefined);
	// Semi rule is not enabled
	t.is(config.rules.semi, undefined);
	// Semi-spacing is not enabled
	t.is(config.rules['semi-spacing'], undefined);
});

test('buildConfig: prettier: true, esnext: false', t => {
	const config = manager.buildConfig({prettier: true, esnext: false}, {});

	// Sets `useTabs` and `tabWidth` options in `prettier/prettier` rule based on the XO `space` options
	t.deepEqual(config.rules['prettier/prettier'], ['error', {
		useTabs: true,
		bracketSpacing: false,
		jsxBracketSameLine: false,
		semi: true,
		singleQuote: true,
		tabWidth: 2,
		trailingComma: 'none'
	}]);
	// Indent rule is not enabled
	t.is(config.rules.indent, undefined);
	// Semi rule is not enabled
	t.is(config.rules.semi, undefined);
	// Semi-spacing is not enabled
	t.is(config.rules['semi-spacing'], undefined);
});

test('buildConfig: prettier: true, space: true', t => {
	const config = manager.buildConfig({prettier: true, space: true}, {});

	// Sets `useTabs` and `tabWidth` options in `prettier/prettier` rule based on the XO `space` options
	t.deepEqual(config.rules['prettier/prettier'], ['error', {
		useTabs: false,
		bracketSpacing: false,
		jsxBracketSameLine: false,
		semi: true,
		singleQuote: true,
		tabWidth: 2,
		trailingComma: 'none'
	}]);
	// Indent rule is not enabled
	t.is(config.rules.indent, undefined);
	// Semi rule is not enabled
	t.is(config.rules.semi, undefined);
	// Semi-spacing is not enabled
	t.is(config.rules['semi-spacing'], undefined);
});

test('buildConfig: merge with prettier config', t => {
	const cwd = path.resolve('fixtures', 'prettier');
	const config = manager.buildConfig({cwd, prettier: true}, prettierConfig.prettier);

	// Sets the `semi` options in `prettier/prettier` based on the XO `semicolon` option
	t.deepEqual(config.rules['prettier/prettier'], ['error', prettierConfig.prettier]);
	// Indent rule is not enabled
	t.is(config.rules.indent, undefined);
	// Semi rule is not enabled
	t.is(config.rules.semi, undefined);
	// Semi-spacing is not enabled
	t.is(config.rules['semi-spacing'], undefined);
});

test('buildConfig: engines: undefined', t => {
	const config = manager.buildConfig({});

	// Do not include any Node.js version specific rules
	t.is(config.rules['prefer-object-spread'], 'off');
	t.is(config.rules['prefer-rest-params'], 'off');
	t.is(config.rules['prefer-destructuring'], 'off');
	t.is(config.rules['promise/prefer-await-to-then'], 'off');
	t.is(config.rules['unicorn/prefer-flat-map'], 'off');
	t.is(config.rules['node/prefer-promises/dns'], 'off');
	t.is(config.rules['node/prefer-promises/fs'], 'off');
	t.is(config.rules['node/no-unsupported-features/es-builtins'], undefined);
	t.is(config.rules['node/no-unsupported-features/es-syntax'], undefined);
	t.is(config.rules['node/no-unsupported-features/node-builtins'], undefined);
});

test('buildConfig: nodeVersion: false', t => {
	const config = manager.buildConfig({nodeVersion: false});

	// Override all the rules specific to Node.js version
	t.is(config.rules['prefer-object-spread'], 'off');
	t.is(config.rules['prefer-rest-params'], 'off');
	t.is(config.rules['prefer-destructuring'], 'off');
	t.is(config.rules['promise/prefer-await-to-then'], 'off');
	t.is(config.rules['unicorn/prefer-flat-map'], 'off');
	t.is(config.rules['node/prefer-promises/dns'], 'off');
	t.is(config.rules['node/prefer-promises/fs'], 'off');
});

test('buildConfig: nodeVersion: >=6', t => {
	const config = manager.buildConfig({nodeVersion: '>=6'});

	// Turn off rule if we support Node.js below 7.6.0
	t.is(config.rules['promise/prefer-await-to-then'], 'off');
	// Set node/no-unsupported-features rules with the nodeVersion
	t.deepEqual(config.rules['node/no-unsupported-features/es-builtins'], ['error', {version: '>=6'}]);
	t.deepEqual(
		config.rules['node/no-unsupported-features/es-syntax'],
		['error', {version: '>=6', ignores: ['modules']}]
	);
	t.deepEqual(config.rules['node/no-unsupported-features/node-builtins'], ['error', {version: '>=6'}]);
});

test('buildConfig: nodeVersion: >=8', t => {
	const config = manager.buildConfig({nodeVersion: '>=8'});

	// Do not turn off rule if we support only Node.js above 7.6.0
	t.is(config.rules['promise/prefer-await-to-then'], undefined);
	// Set node/no-unsupported-features rules with the nodeVersion
	t.deepEqual(config.rules['node/no-unsupported-features/es-builtins'], ['error', {version: '>=8'}]);
	t.deepEqual(
		config.rules['node/no-unsupported-features/es-syntax'],
		['error', {version: '>=8', ignores: ['modules']}]
	);
	t.deepEqual(config.rules['node/no-unsupported-features/node-builtins'], ['error', {version: '>=8'}]);
});

test('mergeWithPrettierConfig: use `singleQuote`, `trailingComma`, `bracketSpacing` and `jsxBracketSameLine` from `prettier` config if defined', t => {
	const prettierOptions = {
		singleQuote: false,
		trailingComma: 'all',
		bracketSpacing: false,
		jsxBracketSameLine: false
	};
	const result = manager.mergeWithPrettierConfig({}, prettierOptions);
	const expected = {

		...prettierOptions,
		tabWidth: 2,
		useTabs: true,
		semi: true
	};
	t.deepEqual(result, expected);
});

test('mergeWithPrettierConfig: determine `tabWidth`, `useTabs`, `semi` from xo config', t => {
	const prettierOptions = {
		tabWidth: 4,
		useTabs: false,
		semi: false
	};
	const result = manager.mergeWithPrettierConfig({space: 4, semicolon: false}, {});
	const expected = {
		bracketSpacing: false,
		jsxBracketSameLine: false,
		singleQuote: true,
		trailingComma: 'none',
		...prettierOptions
	};
	t.deepEqual(result, expected);
});

test('mergeWithPrettierConfig: determine `tabWidth`, `useTabs`, `semi` from prettier config', t => {
	const prettierOptions = {
		useTabs: false,
		semi: false,
		tabWidth: 4
	};
	const result = manager.mergeWithPrettierConfig({}, prettierOptions);
	const expected = {
		bracketSpacing: false,
		jsxBracketSameLine: false,
		singleQuote: true,
		trailingComma: 'none',
		...prettierOptions
	};
	t.deepEqual(result, expected);
});

test('mergeWithPrettierConfig: throw error is `semi`/`semicolon` conflicts', t => {
	t.throws(() => manager.mergeWithPrettierConfig(
		{semicolon: true},
		{semi: false}
	));
	t.throws(() => manager.mergeWithPrettierConfig(
		{semicolon: false},
		{semi: true}
	));

	t.notThrows(() => manager.mergeWithPrettierConfig(
		{semicolon: true},
		{semi: true}
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
	t.deepEqual(config.rules['object-curly-spacing'], rules['object-curly-spacing']);
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
	const config = manager.buildConfig({extends: [
		'plugin:foo/bar',
		'eslint-config-foo-bar',
		'foo-bar-two',
		'@foobar',
		'@foobar/eslint-config'
	]});

	t.deepEqual(config.baseConfig.extends.slice(-5), [
		'plugin:foo/bar',
		'cwd/eslint-config-foo-bar',
		'cwd/eslint-config-foo-bar-two',
		'@foobar',
		'@foobar/eslint-config'
	]);
});

test('buildConfig: typescript', t => {
	const config = manager.buildConfig({ts: true, tsConfigPath: './tsconfig.json'});

	t.deepEqual(config.baseConfig.extends[config.baseConfig.extends.length - 1], 'xo-typescript');
	t.is(config.baseConfig.parser, require.resolve('@typescript-eslint/parser'));
	t.deepEqual(config.baseConfig.parserOptions, {
		warnOnUnsupportedTypeScriptVersion: false,
		ecmaFeatures: {jsx: true},
		project: './tsconfig.json',
		projectFolderIgnoreList: [/\/node_modules\/(?!.*\.cache\/xo-linter)/]
	});
});

test('buildConfig: typescript with parserOption', t => {
	const config = manager.buildConfig({ts: true, parserOptions: {projectFolderIgnoreList: []}, tsConfigPath: 'path/to/tmp-tsconfig.json'}, {});

	t.is(config.baseConfig.parser, require.resolve('@typescript-eslint/parser'));
	t.deepEqual(config.baseConfig.parserOptions, {
		warnOnUnsupportedTypeScriptVersion: false,
		ecmaFeatures: {jsx: true},
		projectFolderIgnoreList: [],
		project: 'path/to/tmp-tsconfig.json'
	});
});

test('findApplicableOverrides', t => {
	const result = manager.findApplicableOverrides('/user/dir/foo.js', [
		{files: '**/f*.js'},
		{files: '**/bar.js'},
		{files: '**/*oo.js'},
		{files: '**/*.txt'}
	]);

	t.is(result.hash, 0b1010);
	t.deepEqual(result.applicable, [
		{files: '**/f*.js'},
		{files: '**/*oo.js'}
	]);
});

test('mergeWithFileConfig: use child if closest', t => {
	const cwd = path.resolve('fixtures', 'nested', 'child');
	const {options} = manager.mergeWithFileConfig({cwd});
	const expected = {...childConfig.xo, extensions: DEFAULT_EXTENSION, ignores: DEFAULT_IGNORES, cwd};
	t.deepEqual(options, expected);
});

test('mergeWithFileConfig: use parent if closest', t => {
	const cwd = path.resolve('fixtures', 'nested');
	const {options} = manager.mergeWithFileConfig({cwd});
	const expected = {...parentConfig.xo, extensions: DEFAULT_EXTENSION, ignores: DEFAULT_IGNORES, cwd};
	t.deepEqual(options, expected);
});

test('mergeWithFileConfig: use parent if child is ignored', t => {
	const cwd = path.resolve('fixtures', 'nested');
	const filename = path.resolve(cwd, 'child-ignore', 'file.js');
	const {options} = manager.mergeWithFileConfig({cwd, filename});
	const expected = {...parentConfig.xo, extensions: DEFAULT_EXTENSION, ignores: DEFAULT_IGNORES, cwd, filename};
	t.deepEqual(options, expected);
});

test('mergeWithFileConfig: use child if child is empty', t => {
	const cwd = path.resolve('fixtures', 'nested', 'child-empty');
	const {options} = manager.mergeWithFileConfig({cwd});
	t.deepEqual(options, {extensions: DEFAULT_EXTENSION, ignores: DEFAULT_IGNORES, cwd});
});

test('mergeWithFileConfig: read engines from package.json', t => {
	const cwd = path.resolve('fixtures', 'engines');
	const {options} = manager.mergeWithFileConfig({cwd});
	const expected = {nodeVersion: enginesConfig.engines.node, extensions: DEFAULT_EXTENSION, ignores: DEFAULT_IGNORES, cwd};
	t.deepEqual(options, expected);
});

test('mergeWithFileConfig: XO engine options supersede package.json\'s', t => {
	const cwd = path.resolve('fixtures', 'engines');
	const {options} = manager.mergeWithFileConfig({cwd, nodeVersion: '>=8'});
	const expected = {nodeVersion: '>=8', extensions: DEFAULT_EXTENSION, ignores: DEFAULT_IGNORES, cwd};
	t.deepEqual(options, expected);
});

test('mergeWithFileConfig: XO engine options false supersede package.json\'s', t => {
	const cwd = path.resolve('fixtures', 'engines');
	const {options} = manager.mergeWithFileConfig({cwd, nodeVersion: false});
	const expected = {nodeVersion: false, extensions: DEFAULT_EXTENSION, ignores: DEFAULT_IGNORES, cwd};
	t.deepEqual(options, expected);
});

test('mergeWithFileConfig: typescript files', async t => {
	const cwd = path.resolve('fixtures', 'typescript', 'child');
	const filename = path.resolve(cwd, 'file.ts');
	const {options} = manager.mergeWithFileConfig({cwd, filename});
	const expected = {
		filename,
		extensions: DEFAULT_EXTENSION,
		ignores: DEFAULT_IGNORES,
		cwd,
		semicolon: false,
		ts: true
	};
	t.deepEqual(omit(options, 'tsConfigPath'), expected);
	t.deepEqual(await readJson(options.tsConfigPath), {
		extends: path.resolve(cwd, 'tsconfig.json'),
		files: [path.resolve(cwd, 'file.ts')],
		include: [slash(path.resolve(cwd, '**/*.ts')), slash(path.resolve(cwd, '**/*.tsx'))]
	});
});

test('mergeWithFileConfig: tsx files', async t => {
	const cwd = path.resolve('fixtures', 'typescript', 'child');
	const filename = path.resolve(cwd, 'file.tsx');
	const {options} = manager.mergeWithFileConfig({cwd, filename});
	const expected = {
		filename,
		extensions: DEFAULT_EXTENSION,
		ignores: DEFAULT_IGNORES,
		cwd,
		semicolon: false,
		ts: true
	};
	t.deepEqual(omit(options, 'tsConfigPath'), expected);
	t.deepEqual(await readJson(options.tsConfigPath), {
		extends: path.resolve(cwd, 'tsconfig.json'),
		files: [path.resolve(cwd, 'file.tsx')],
		include: [slash(path.resolve(cwd, '**/*.ts')), slash(path.resolve(cwd, '**/*.tsx'))]
	});
});

test('mergeWithFileConfigs: nested configs with prettier', async t => {
	const cwd = path.resolve('fixtures', 'nested-configs');
	const paths = [
		'no-semicolon.js',
		'child/semicolon.js',
		'child-override/two-spaces.js',
		'child-override/child-prettier-override/semicolon.js'
	].map(file => path.resolve(cwd, file));
	const result = await manager.mergeWithFileConfigs(paths, {cwd}, [
		{
			filepath: path.resolve(cwd, 'child-override', 'child-prettier-override', 'package.json'),
			config: {overrides: [{files: 'semicolon.js', prettier: true}]}
		},
		{filepath: path.resolve(cwd, 'package.json'), config: {semicolon: true}},
		{
			filepath: path.resolve(cwd, 'child-override', 'package.json'),
			config: {overrides: [{files: 'two-spaces.js', space: 4}]}
		},
		{filepath: path.resolve(cwd, 'child', 'package.json'), config: {semicolon: false}}
	]);

	t.deepEqual(result, [
		{
			files: [path.resolve(cwd, 'no-semicolon.js')],
			options: {
				semicolon: true,
				cwd,
				extensions: DEFAULT_EXTENSION,
				ignores: DEFAULT_IGNORES
			},
			prettierOptions: {}
		},
		{
			files: [path.resolve(cwd, 'child/semicolon.js')],
			options: {
				semicolon: false,
				cwd: path.resolve(cwd, 'child'),
				extensions: DEFAULT_EXTENSION,
				ignores: DEFAULT_IGNORES
			},
			prettierOptions: {}
		},
		{
			files: [path.resolve(cwd, 'child-override/two-spaces.js')],
			options: {
				space: 4,
				rules: {},
				settings: {},
				globals: [],
				envs: [],
				plugins: [],
				extends: [],
				cwd: path.resolve(cwd, 'child-override'),
				extensions: DEFAULT_EXTENSION,
				ignores: DEFAULT_IGNORES
			},
			prettierOptions: {}
		},
		{
			files: [path.resolve(cwd, 'child-override/child-prettier-override/semicolon.js')],
			options: {
				prettier: true,
				rules: {},
				settings: {},
				globals: [],
				envs: [],
				plugins: [],
				extends: [],
				cwd: path.resolve(cwd, 'child-override', 'child-prettier-override'),
				extensions: DEFAULT_EXTENSION,
				ignores: DEFAULT_IGNORES
			},
			prettierOptions: {endOfLine: 'lf', semi: false, useTabs: true}
		}
	]);
});

test('mergeWithFileConfigs: typescript files', async t => {
	const cwd = path.resolve('fixtures', 'typescript');
	const paths = ['two-spaces.tsx', 'child/extra-semicolon.ts', 'child/sub-child/four-spaces.ts'].map(file => path.resolve(cwd, file));
	const configFiles = [
		{filepath: path.resolve(cwd, 'child/sub-child/package.json'), config: {space: 2}},
		{filepath: path.resolve(cwd, 'package.json'), config: {space: 4}},
		{filepath: path.resolve(cwd, 'child/package.json'), config: {semicolon: false}}
	];
	const result = await manager.mergeWithFileConfigs(paths, {cwd}, configFiles);

	t.deepEqual(omit(result[0], 'options.tsConfigPath'), {
		files: [path.resolve(cwd, 'two-spaces.tsx')],
		options: {
			space: 4,
			cwd,
			extensions: DEFAULT_EXTENSION,
			ignores: DEFAULT_IGNORES,
			ts: true
		},
		prettierOptions: {}
	});
	t.deepEqual(await readJson(result[0].options.tsConfigPath), {
		files: [path.resolve(cwd, 'two-spaces.tsx')],
		compilerOptions: {
			newLine: 'lf',
			noFallthroughCasesInSwitch: true,
			noImplicitReturns: true,
			noUnusedLocals: true,
			noUnusedParameters: true,
			strict: true,
			target: 'es2018'
		}
	});

	t.deepEqual(omit(result[1], 'options.tsConfigPath'), {
		files: [path.resolve(cwd, 'child/extra-semicolon.ts')],
		options: {
			semicolon: false,
			cwd: path.resolve(cwd, 'child'),
			extensions: DEFAULT_EXTENSION,
			ignores: DEFAULT_IGNORES,
			ts: true
		},
		prettierOptions: {}
	});

	t.deepEqual(omit(result[2], 'options.tsConfigPath'), {
		files: [path.resolve(cwd, 'child/sub-child/four-spaces.ts')],
		options: {
			space: 2,
			cwd: path.resolve(cwd, 'child/sub-child'),
			extensions: DEFAULT_EXTENSION,
			ignores: DEFAULT_IGNORES,
			ts: true
		},
		prettierOptions: {}
	});

	// Verify that we use the same temporary tsconfig.json for both files group sharing the same original tsconfig.json even if they have different xo config
	t.is(result[1].options.tsConfigPath, result[2].options.tsConfigPath);
	t.deepEqual(await readJson(result[1].options.tsConfigPath), {
		extends: path.resolve(cwd, 'child/tsconfig.json'),
		files: [path.resolve(cwd, 'child/extra-semicolon.ts'), path.resolve(cwd, 'child/sub-child/four-spaces.ts')],
		include: [
			slash(path.resolve(cwd, 'child/**/*.ts')),
			slash(path.resolve(cwd, 'child/**/*.tsx'))
		]
	});

	const secondResult = await manager.mergeWithFileConfigs(paths, {cwd}, configFiles);

	// Verify that on each run the options.tsConfigPath is consistent to preserve ESLint cache
	t.is(result[0].options.tsConfigPath, secondResult[0].options.tsConfigPath);
	t.is(result[1].options.tsConfigPath, secondResult[1].options.tsConfigPath);
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
						plugins: ['override-plugin']
					}
				],
				rules: {'rule-1': 'a', 'rule-2': 'b'},
				extends: ['base-extend'],
				globals: ['base'],
				plugins: ['base-plugin'],
				cwd: '.'
			}),
		{
			options: {
				rules: {'rule-1': 'a', 'rule-2': 'c'},
				extends: ['base-extend', 'overrride-extend'],
				globals: ['base', 'override'],
				plugins: ['base-plugin', 'override-plugin'],
				envs: [],
				settings: {},
				cwd: '.'
			},
			hash: 1
		}
	);
});
