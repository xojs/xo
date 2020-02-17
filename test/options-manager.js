import path from 'path';
import test from 'ava';
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
	t.regex(slash(config.cacheLocation), /[\\/]\.cache\/xo[\\/]?$/u);
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
	t.deepEqual(config.rules, {
		semi: ['error', 'never'],
		'semi-spacing': ['error', {
			before: false,
			after: true
		}]
	});
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

test('buildConfig: nodeVersion: invalid range', t => {
	const config = manager.buildConfig({nodeVersion: '4'});

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
});

test('buildConfig: nodeVersion: >=8', t => {
	const config = manager.buildConfig({nodeVersion: '>=8'});

	// Do not turn off rule if we support only Node.js above 7.6.0
	t.is(config.rules['promise/prefer-await-to-then'], undefined);
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
	t.deepEqual(config.rules, rules);
});

test('buildConfig: parser', t => {
	const parser = 'babel-eslint';
	const config = manager.buildConfig({parser});
	t.deepEqual(config.baseConfig.parser, parser);
});

test('buildConfig: settings', t => {
	const settings = {'import/resolver': 'webpack'};
	const config = manager.buildConfig({settings});
	t.deepEqual(config.baseConfig.settings, settings);
});

test('buildConfig: extends', t => {
	const config = manager.buildConfig({extends: [
		'plugin:foo/bar',
		'eslint-config-foo-bar',
		'foo-bar-two'
	]});

	t.deepEqual(config.baseConfig.extends.slice(-3), [
		'plugin:foo/bar',
		'cwd/eslint-config-foo-bar',
		'cwd/eslint-config-foo-bar-two'
	]);
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
	const expected = {...childConfig.xo, extensions: DEFAULT_EXTENSION, ignores: DEFAULT_IGNORES, cwd, nodeVersion: undefined};
	t.deepEqual(options, expected);
});

test('mergeWithFileConfig: use parent if closest', t => {
	const cwd = path.resolve('fixtures', 'nested');
	const {options} = manager.mergeWithFileConfig({cwd});
	const expected = {...parentConfig.xo, extensions: DEFAULT_EXTENSION, ignores: DEFAULT_IGNORES, cwd, nodeVersion: undefined};
	t.deepEqual(options, expected);
});

test('mergeWithFileConfig: use parent if child is ignored', t => {
	const cwd = path.resolve('fixtures', 'nested');
	const filename = path.resolve(cwd, 'child-ignore', 'file.js');
	const {options} = manager.mergeWithFileConfig({cwd, filename});
	const expected = {...parentConfig.xo, extensions: DEFAULT_EXTENSION, ignores: DEFAULT_IGNORES, cwd, filename, nodeVersion: undefined};
	t.deepEqual(options, expected);
});

test('mergeWithFileConfig: use child if child is empty', t => {
	const cwd = path.resolve('fixtures', 'nested', 'child-empty');
	const {options} = manager.mergeWithFileConfig({cwd});
	t.deepEqual(options, {nodeVersion: undefined, extensions: DEFAULT_EXTENSION, ignores: DEFAULT_IGNORES, cwd});
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

function mergeWithFileConfigFileType(t, {dir}) {
	const cwd = path.resolve('fixtures', 'config-files', dir);
	const {options} = manager.mergeWithFileConfig({cwd});
	const expected = {esnext: true, extensions: DEFAULT_EXTENSION, ignores: DEFAULT_IGNORES, cwd, nodeVersion: undefined};
	t.deepEqual(options, expected);
}

mergeWithFileConfigFileType.title = (_, {type}) => `mergeWithFileConfig: load from ${type}`.trim();

test(mergeWithFileConfigFileType, {type: 'xo.config.js', dir: 'xoconfigjs'});
test(mergeWithFileConfigFileType, {type: '.xorc.js', dir: 'xorcjs'});
test(mergeWithFileConfigFileType, {type: '.xorc.json', dir: 'xorcjson'});
test(mergeWithFileConfigFileType, {type: '.xorc', dir: 'xorc'});

test('mergeWithFileConfigs: nested configs with prettier', async t => {
	const cwd = path.resolve('fixtures', 'nested-configs');
	const paths = [
		'single-quote.js',
		'package.json',
		'child/package.json',
		'child/semicolon.js',
		'child-override/package.json',
		'child-override/semicolon.js'
	];
	const result = await manager.mergeWithFileConfigs(paths, {cwd});

	t.deepEqual(result, [
		{
			files: [path.resolve(cwd, 'single-quote.js')],
			options: {
				semicolon: true,
				prettier: true,
				nodeVersion: undefined,
				cwd,
				extensions: DEFAULT_EXTENSION,
				ignores: DEFAULT_IGNORES
			},
			prettierOptions: {singleQuote: false}
		},
		{
			files: [path.resolve(cwd, 'child/semicolon.js')],
			options: {
				semicolon: false,
				nodeVersion: undefined,
				cwd: path.resolve(cwd, 'child'),
				extensions: DEFAULT_EXTENSION,
				ignores: DEFAULT_IGNORES
			},
			prettierOptions: {}
		},
		{
			files: [path.resolve(cwd, 'child-override/semicolon.js')],
			options: {
				rules: {},
				settings: {},
				globals: [],
				envs: [],
				plugins: [],
				extends: [],
				nodeVersion: undefined,
				cwd: path.resolve(cwd, 'child-override'),
				extensions: DEFAULT_EXTENSION,
				ignores: DEFAULT_IGNORES,
				prettier: true
			},
			prettierOptions: {singleQuote: false}
		}
	]);
});

async function mergeWithFileConfigsFileType(t, {dir}) {
	const cwd = path.resolve('fixtures', 'config-files', dir);
	const paths = ['a.js', 'b.js'];

	const result = await manager.mergeWithFileConfigs(paths, {cwd});

	t.deepEqual(result, [
		{
			files: paths.reverse().map(p => path.resolve(cwd, p)),
			options: {
				esnext: true,
				nodeVersion: undefined,
				cwd,
				extensions: DEFAULT_EXTENSION,
				ignores: DEFAULT_IGNORES
			},
			prettierOptions: {}
		}
	]);
}

mergeWithFileConfigsFileType.title = (_, {type}) => `mergeWithFileConfigs: load from ${type}`.trim();

test(mergeWithFileConfigsFileType, {type: 'xo.config.js', dir: 'xoconfigjs'});
test(mergeWithFileConfigsFileType, {type: '.xorc.js', dir: 'xorcjs'});
test(mergeWithFileConfigsFileType, {type: '.xorc.json', dir: 'xorcjson'});
test(mergeWithFileConfigsFileType, {type: '.xorc', dir: 'xorc'});
