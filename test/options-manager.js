import path from 'path';
import test from 'ava';
import proxyquire from 'proxyquire';

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
		extend: 'foo'
	});

	t.deepEqual(opts, {
		envs: ['node'],
		globals: ['foo'],
		ignores: ['test.js'],
		plugins: ['my-plugin'],
		rules: {'my-rule': 'foo'},
		extends: ['foo']
	});
});

test('normalizeOpts: falsie values stay falsie', t => {
	t.deepEqual(manager.normalizeOpts({}), {});
});

test('buildConfig: defaults', t => {
	const config = manager.buildConfig({});
	t.true(/[\\\/]\.xo-cache[\\\/]?$/.test(config.cacheLocation));
	t.is(config.useEslintrc, false);
	t.is(config.cache, true);
	t.is(config.baseConfig.extends[0], 'xo');
});

test('buildConfig: esnext', t => {
	const config = manager.buildConfig({esnext: true});
	t.is(config.baseConfig.extends[0], 'xo/esnext');
});

test('buildConfig: space: true', t => {
	const config = manager.buildConfig({space: true});
	t.deepEqual(config.rules.indent, [2, 2, {SwitchCase: 1}]);
});

test('buildConfig: space: 4', t => {
	const config = manager.buildConfig({space: 4});
	t.deepEqual(config.rules.indent, [2, 4, {SwitchCase: 1}]);
});

test('buildConfig: semicolon', t => {
	const config = manager.buildConfig({semicolon: false});
	t.deepEqual(config.rules, {
		'semi': [2, 'never'],
		'semi-spacing': [2, {
			before: false,
			after: true
		}]
	});
});

test('buildConfig: rules', t => {
	const rules = {'object-curly-spacing': [2, 'always']};
	const config = manager.buildConfig({rules});
	t.deepEqual(config.rules, rules);
});

test('findApplicableOverrides', t => {
	const result = manager.findApplicableOverrides('/user/dir/foo.js', [
		{files: '**/f*.js'},
		{files: '**/bar.js'},
		{files: '**/*oo.js'},
		{files: '**/*.txt'}
	]);

	t.is(result.hash, parseInt('1010', 2));
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
		esnext: true
	};

	const overrides = [
		{
			files: '**/foo/*',
			esnext: false
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
				esnext: false
			},
			paths: ['/user/foo/hello.js', '/user/foo/goodbye.js']
		},
		{
			opts: {
				esnext: false,
				space: 3,
				envs: ['mocha']
			},
			paths: ['/user/foo/howdy.js']
		},
		{
			opts: {
				esnext: true
			},
			paths: ['/user/bar/hello.js']
		}
	].map(obj => {
		obj.opts = Object.assign(manager.emptyOptions(), obj.opts);
		return obj;
	}));
});

test('gitignore', t => {
	const result = manager.getIgnores({});
	t.not(result.ignores.indexOf(path.join('foo', '**')), -1);
	t.not(result.ignores.indexOf(path.join('bar', 'foo.js')), -1);
});

test('ignore ignored .gitignore', t => {
	const opts = {
		ignores: [
			'**/foobar/**'
		]
	};

	const result = manager.getIgnores(opts);

	t.is(result.ignores.indexOf(path.join('bar', 'foobar', 'bar.js')), -1);
});
