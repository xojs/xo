import path from 'path';
import test from 'ava';
import proxyquire from 'proxyquire';
import slash from 'slash';
import parentConfig from './fixtures/nested/package';
import childConfig from './fixtures/nested/child/package';
import prettierConfig from './fixtures/prettier/package';
import enginesConfig from './fixtures/engines/package';

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
	t.true(/[\\/]\.cache\/xo[\\/]?$/u.test(slash(config.cacheLocation)));
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
	const config = manager.buildConfig({semicolon: false});
	t.deepEqual(config.rules, {
		semi: ['error', 'never'],
		'semi-spacing': ['error', {
			before: false,
			after: true
		}]
	});
});

test('buildConfig: prettier: true', t => {
	const config = manager.buildConfig({prettier: true, extends: ['xo-react']});

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
	t.deepEqual(config.baseConfig.extends.slice(-1), ['prettier']);
	// Indent rule is not enabled
	t.is(config.rules.indent, undefined);
	// Semi rule is not enabled
	t.is(config.rules.semi, undefined);
	// Semi-spacing is not enabled
	t.is(config.rules['semi-spacing'], undefined);
});

test('buildConfig: prettier: true, semicolon: false', t => {
	const config = manager.buildConfig({prettier: true, semicolon: false});

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
	const config = manager.buildConfig({prettier: true, space: 4});

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
	const config = manager.buildConfig({prettier: true, esnext: false});

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
	const config = manager.buildConfig({prettier: true, space: true});

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
	const config = manager.buildConfig({cwd, prettier: true});

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
	t.is(config.rules['prefer-spread'], undefined);
	t.is(config.rules['prefer-rest-params'], undefined);
	t.is(config.rules['prefer-destructuring'], undefined);
	t.is(config.rules['promise/prefer-await-to-then'], undefined);
});

test('buildConfig: nodeVersion: false', t => {
	const config = manager.buildConfig({nodeVersion: false});

	// Do not include any Node.js version specific rules
	t.is(config.rules['prefer-spread'], undefined);
	t.is(config.rules['prefer-rest-params'], undefined);
	t.is(config.rules['prefer-destructuring'], undefined);
	t.is(config.rules['promise/prefer-await-to-then'], undefined);
});

test('buildConfig: nodeVersion: invalid range', t => {
	const config = manager.buildConfig({nodeVersion: '4'});

	// Do not include any Node.js version specific rules
	t.is(config.rules['prefer-spread'], undefined);
	t.is(config.rules['prefer-rest-params'], undefined);
	t.is(config.rules['prefer-destructuring'], undefined);
	t.is(config.rules['promise/prefer-await-to-then'], undefined);
});

test('buildConfig: nodeVersion: >=8', t => {
	const config = manager.buildConfig({nodeVersion: '>=8'});

	// Include rules for Node.js 8 and above
	t.is(config.rules['promise/prefer-await-to-then'], 'error');
});

test('mergeWithPrettierConf: use `singleQuote`, `trailingComma`, `bracketSpacing` and `jsxBracketSameLine` from `prettier` config if defined', t => {
	const prettierOptions = {
		singleQuote: false,
		trailingComma: 'all',
		bracketSpacing: false,
		jsxBracketSameLine: false
	};
	const result = manager.mergeWithPrettierConf({}, prettierOptions);
	const expected = Object.assign(
		{},
		prettierOptions,
		{
			tabWidth: 2,
			useTabs: true,
			semi: true
		}
	);
	t.deepEqual(result, expected);
});

test('mergeWithPrettierConf: determine `tabWidth`, `useTabs`, `semi` from xo config', t => {
	const prettierOptions = {
		tabWidth: 4,
		useTabs: false,
		semi: false
	};
	const result = manager.mergeWithPrettierConf({space: 4, semicolon: false}, {});
	const expected = Object.assign(
		{
			bracketSpacing: false,
			jsxBracketSameLine: false,
			singleQuote: true,
			trailingComma: 'none'
		},
		prettierOptions
	);
	t.deepEqual(result, expected);
});

test('mergeWithPrettierConf: determine `tabWidth`, `useTabs`, `semi` from prettier config', t => {
	const prettierOptions = {
		useTabs: false,
		semi: false,
		tabWidth: 4
	};
	const result = manager.mergeWithPrettierConf({}, prettierOptions);
	const expected = Object.assign(
		{
			bracketSpacing: false,
			jsxBracketSameLine: false,
			singleQuote: true,
			trailingComma: 'none'
		},
		prettierOptions
	);
	t.deepEqual(result, expected);
});

test('mergeWithPrettierConf: throw error is `semi`/`semicolon` conflicts', t => {
	t.throws(() => manager.mergeWithPrettierConf(
		{semicolon: true},
		{semi: false}
	));
	t.throws(() => manager.mergeWithPrettierConf(
		{semicolon: false},
		{semi: true}
	));

	t.notThrows(() => manager.mergeWithPrettierConf(
		{semicolon: true},
		{semi: true}
	));
	t.notThrows(() => manager.mergeWithPrettierConf({semicolon: false}, {semi: false}));
});

test('mergeWithPrettierConf: throw error is `space`/`useTabs` conflicts', t => {
	t.throws(() => manager.mergeWithPrettierConf({space: false}, {useTabs: false}));
	t.throws(() => manager.mergeWithPrettierConf({space: true}, {useTabs: true}));

	t.notThrows(() => manager.mergeWithPrettierConf({space: 4}, {useTabs: false}));
	t.notThrows(() => manager.mergeWithPrettierConf({space: true}, {useTabs: false}));
	t.notThrows(() => manager.mergeWithPrettierConf({space: false}, {useTabs: true}));
});

test('mergeWithPrettierConf: throw error is `space`/`tabWidth` conflicts', t => {
	t.throws(() => manager.mergeWithPrettierConf({space: 4}, {tabWidth: 2}));
	t.throws(() => manager.mergeWithPrettierConf({space: 0}, {tabWidth: 2}));
	t.throws(() => manager.mergeWithPrettierConf({space: 2}, {tabWidth: 0}));

	t.notThrows(() => manager.mergeWithPrettierConf({space: 4}, {tabWidth: 4}));
	t.notThrows(() => manager.mergeWithPrettierConf({space: false}, {tabWidth: 4}));
	t.notThrows(() => manager.mergeWithPrettierConf({space: true}, {tabWidth: 4}));
});

test('buildConfig: rules', t => {
	const rules = {'object-curly-spacing': ['error', 'always']};
	const config = manager.buildConfig({rules});
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

test('groupConfigs', t => {
	const paths = [
		'/user/foo/hello.js',
		'/user/foo/goodbye.js',
		'/user/foo/howdy.js',
		'/user/bar/hello.js'
	];

	const options = {
		esnext: false
	};

	const overrides = [
		{
			files: '**/foo/*',
			esnext: true
		},
		{
			files: '**/foo/howdy.js',
			space: 3,
			env: 'mocha'
		}
	];

	const result = manager.groupConfigs(paths, options, overrides);

	t.deepEqual(result, [
		{
			options: {
				esnext: true
			},
			paths: ['/user/foo/hello.js', '/user/foo/goodbye.js']
		},
		{
			options: {
				esnext: true,
				space: 3,
				envs: ['mocha']
			},
			paths: ['/user/foo/howdy.js']
		},
		{
			options: {
				esnext: false
			},
			paths: ['/user/bar/hello.js']
		}
	].map(obj => {
		obj.options = Object.assign(manager.emptyOptions(), obj.options);
		return obj;
	}));
});

test('mergeWithPkgConf: use child if closest', t => {
	const cwd = path.resolve('fixtures', 'nested', 'child');
	const result = manager.mergeWithPkgConf({cwd});
	const expected = Object.assign({}, childConfig.xo, {cwd, nodeVersion: undefined});
	t.deepEqual(result, expected);
});

test('mergeWithPkgConf: use parent if closest', t => {
	const cwd = path.resolve('fixtures', 'nested');
	const result = manager.mergeWithPkgConf({cwd});
	const expected = Object.assign({}, parentConfig.xo, {cwd, nodeVersion: undefined});
	t.deepEqual(result, expected);
});

test('mergeWithPkgConf: use parent if child is ignored', t => {
	const cwd = path.resolve('fixtures', 'nested', 'child-ignore');
	const result = manager.mergeWithPkgConf({cwd});
	const expected = Object.assign({}, parentConfig.xo, {cwd, nodeVersion: undefined});
	t.deepEqual(result, expected);
});

test('mergeWithPkgConf: use child if child is empty', t => {
	const cwd = path.resolve('fixtures', 'nested', 'child-empty');
	const result = manager.mergeWithPkgConf({cwd});
	t.deepEqual(result, {nodeVersion: undefined, cwd});
});

test('mergeWithPkgConf: read engines from package.json', t => {
	const cwd = path.resolve('fixtures', 'engines');
	const result = manager.mergeWithPkgConf({cwd});
	const expected = {nodeVersion: enginesConfig.engines.node, cwd};
	t.deepEqual(result, expected);
});

test('mergeWithPkgConf: XO engine options supersede package.json\'s', t => {
	const cwd = path.resolve('fixtures', 'engines');
	const result = manager.mergeWithPkgConf({cwd, nodeVersion: '>=8'});
	const expected = {nodeVersion: '>=8', cwd};
	t.deepEqual(result, expected);
});

test('mergeWithPkgConf: XO engine options false supersede package.json\'s', t => {
	const cwd = path.resolve('fixtures', 'engines');
	const result = manager.mergeWithPkgConf({cwd, nodeVersion: false});
	const expected = {nodeVersion: false, cwd};
	t.deepEqual(result, expected);
});
