import path from 'path';
import test from 'ava';
import proxyquire from 'proxyquire';
import parentConfig from './fixtures/nested/package';
import childConfig from './fixtures/nested/child/package';

process.chdir(__dirname);

const manager = proxyquire('../options-manager', {
	'resolve-from': (cwd, path) => `cwd/${path}`
});

test('normalizeOpts: makes all the opts plural and arrays', t => {
	const opts = manager.normalizeOpts({
		env: 'node',
		global: 'foo',
		ignore: 'test.js',
		plugin: 'my-plugin',
		rule: {'my-rule': 'foo'},
		setting: {'my-rule': 'bar'},
		extend: 'foo',
		extension: 'html'
	});

	t.deepEqual(opts, {
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

test('normalizeOpts: falsie values stay falsie', t => {
	t.deepEqual(manager.normalizeOpts({}), {});
});

test('buildConfig: defaults', t => {
	const config = manager.buildConfig({});
	t.true(/[\\/]\.xo-cache[\\/]?$/.test(config.cacheLocation));
	t.is(config.useEslintrc, false);
	t.is(config.cache, true);
	t.is(config.baseConfig.extends[0], 'xo/esnext');
});

test('buildConfig: esnext', t => {
	const config = manager.buildConfig({esnext: false});
	t.is(config.baseConfig.extends[0], 'xo');
});

test('buildConfig: skip-default-extenders', t => {
	const config = manager.buildConfig({
		esnext: false,
		skipDefaultExtenders: true,
		extends: [
			'plugin:foo/bar',
			'eslint-config-foo-bar',
			'foo-bar-two'
		]
	});

	t.deepEqual(config.baseConfig.extends, [
		'plugin:foo/bar',
		'cwd/eslint-config-foo-bar',
		'cwd/eslint-config-foo-bar-two'
	]);
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

	const opts = {
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

	const result = manager.groupConfigs(paths, opts, overrides);

	t.deepEqual(result, [
		{
			opts: {
				esnext: true
			},
			paths: ['/user/foo/hello.js', '/user/foo/goodbye.js']
		},
		{
			opts: {
				esnext: true,
				space: 3,
				envs: ['mocha']
			},
			paths: ['/user/foo/howdy.js']
		},
		{
			opts: {
				esnext: false
			},
			paths: ['/user/bar/hello.js']
		}
	].map(obj => {
		obj.opts = Object.assign(manager.emptyOptions(), obj.opts);
		return obj;
	}));
});

test('gitignore', t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore/test');
	const filter = manager.getGitIgnoreFilter({cwd});
	const actual = ['foo.js', 'bar.js'].filter(filter);
	const expected = ['bar.js'];
	t.deepEqual(actual, expected);
});

test('ignore ignored .gitignore', t => {
	const opts = {
		cwd: path.join(__dirname, 'fixtures/gitignore'),
		ignores: ['**/test/**']
	};

	const filter = manager.getGitIgnoreFilter(opts);
	const actual = ['foo.js'].filter(filter);
	const expected = ['foo.js'];
	t.deepEqual(actual, expected);
});

test('patterns should be translated according to process.cwd()', t => {
	const previous = process.cwd();
	const cwd = path.join(__dirname, 'fixtures/gitignore');
	process.chdir(cwd);
	const filter = manager.getGitIgnoreFilter({});
	const actual = ['bar.js', 'test/foo.js', 'test/bar.js'].filter(filter);
	const expected = ['bar.js', 'test/bar.js'];
	t.deepEqual(actual, expected);
	process.chdir(previous);
});

test('mergeWithPkgConf: use child if closest', t => {
	const cwd = path.resolve('fixtures', 'nested', 'child');
	const result = manager.mergeWithPkgConf({cwd});
	const expected = Object.assign({}, childConfig.xo, {cwd});
	t.deepEqual(result, expected);
});

test('mergeWithPkgConf: use parent if closest', t => {
	const cwd = path.resolve('fixtures', 'nested');
	const result = manager.mergeWithPkgConf({cwd});
	const expected = Object.assign({}, parentConfig.xo, {cwd});
	t.deepEqual(result, expected);
});

test('mergeWithPkgConf: use parent if child is ignored', t => {
	const cwd = path.resolve('fixtures', 'nested', 'child-ignore');
	const result = manager.mergeWithPkgConf({cwd});
	const expected = Object.assign({}, parentConfig.xo, {cwd});
	t.deepEqual(result, expected);
});

test('mergeWithPkgConf: use child if child is empty', t => {
	const cwd = path.resolve('fixtures', 'nested', 'child-empty');
	const result = manager.mergeWithPkgConf({cwd});
	t.deepEqual(result, {cwd});
});
