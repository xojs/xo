import test from 'ava';
import proxyquire from 'proxyquire';

const manager = proxyquire('../options-manager', {
	'resolve-from': (cwd, path) => `cwd/${path}`
});

test('normalizeOpts: makes all the opts plural and arrays', t => {
	let opts = {
		env: 'node',
		global: 'foo',
		ignore: 'test.js',
		plugin: 'my-plugin',
		rule: {'my-rule': 'foo'},
		extend: 'foo'
	};

	opts = manager.normalizeOpts(opts);

	t.same(opts, {
		envs: ['node'],
		globals: ['foo'],
		ignores: ['test.js'],
		plugins: ['my-plugin'],
		rules: {'my-rule': 'foo'},
		extends: ['foo']
	});
});

test('normalizeOpts: falsie values stay falsie', t => {
	let opts = {};
	opts = manager.normalizeOpts(opts);
	t.same(opts, {});
});

test('buildConfig: defaults', t => {
	const config = manager.buildConfig({});

	t.true(/[\\\/]\.xo-cache[\\\/]?$/.test(config.cacheLocation));
	delete config.cacheLocation;

	t.same(config, {
		useEslintrc: false,
		cache: true,
		baseConfig: {extends: 'xo'},
		plugins: ['babel', 'no-empty-blocks', 'no-use-extend-native'],
		rules: {
			'generator-star-spacing': 0,
			'arrow-parens': 0,
			'object-curly-spacing': 0,
			'babel/object-curly-spacing': [2, 'never']
		},
		parser: 'babel-eslint'
	});
});

test('buildConfig: esnext', t => {
	const config = manager.buildConfig({
		esnext: true
	});

	t.true(/[\\\/]\.xo-cache[\\\/]?$/.test(config.cacheLocation));
	delete config.cacheLocation;

	t.same(config, {
		useEslintrc: false,
		cache: true,
		baseConfig: {extends: 'xo/esnext'},
		rules: {},
		// TODO: Note that all plugins are blown away if esnext !== true
		plugins: ['no-empty-blocks', 	'no-use-extend-native']
	});
});

test('buildConfig: space: true', t => {
	const config = manager.buildConfig({
		space: true
	});

	delete config.cacheLocation;

	t.same(config, {
		useEslintrc: false,
		cache: true,
		baseConfig: {extends: 'xo'},
		plugins: ['babel', 'no-empty-blocks', 'no-use-extend-native'],
		rules: {
			'indent': [2, 2, {SwitchCase: 1}],
			'generator-star-spacing': 0,
			'arrow-parens': 0,
			'object-curly-spacing': 0,
			'babel/object-curly-spacing': [2, 'never']
		},
		parser: 'babel-eslint'
	});
});

test('buildConfig: space: 4', t => {
	const config = manager.buildConfig({
		space: 4
	});

	delete config.cacheLocation;

	t.same(config, {
		useEslintrc: false,
		cache: true,
		baseConfig: {extends: 'xo'},
		plugins: ['babel', 'no-empty-blocks', 'no-use-extend-native'],
		rules: {
			'indent': [2, 4, {SwitchCase: 1}],
			'generator-star-spacing': 0,
			'arrow-parens': 0,
			'object-curly-spacing': 0,
			'babel/object-curly-spacing': [2, 'never']
		},
		parser: 'babel-eslint'
	});
});

test('buildConfig: semicolon', t => {
	const config = manager.buildConfig({
		semicolon: false
	});

	delete config.cacheLocation;

	t.same(config, {
		useEslintrc: false,
		cache: true,
		baseConfig: {extends: 'xo'},
		plugins: ['babel', 'no-empty-blocks', 'no-use-extend-native'],
		rules: {
			'semi': [2, 'never'],
			'semi-spacing': [2, {before: false, after: true}],
			'generator-star-spacing': 0,
			'arrow-parens': 0,
			'object-curly-spacing': 0,
			'babel/object-curly-spacing': [2, 'never']
		},
		parser: 'babel-eslint'
	});
});

test('buildConfig: rules', t => {
	const config = manager.buildConfig({
		rules: {
			'babel/object-curly-spacing': [2, 'always']
		}
	});

	delete config.cacheLocation;

	t.same(config, {
		useEslintrc: false,
		cache: true,
		baseConfig: {extends: 'xo'},
		plugins: ['babel', 'no-empty-blocks', 'no-use-extend-native'],
		rules: {
			'generator-star-spacing': 0,
			'arrow-parens': 0,
			'object-curly-spacing': 0,
			'babel/object-curly-spacing': [2, 'always']
		},
		parser: 'babel-eslint'
	});
});

test('buildConfig: extends is resolved to cwd', t => {
	const config = manager.buildConfig({
		extends: ['foo']
	});

	delete config.cacheLocation;

	t.same(config, {
		useEslintrc: false,
		cache: true,
		baseConfig: {extends: ['xo', 'cwd/eslint-config-foo']},
		plugins: ['babel', 'no-empty-blocks', 'no-use-extend-native'],
		rules: {
			'generator-star-spacing': 0,
			'arrow-parens': 0,
			'object-curly-spacing': 0,
			'babel/object-curly-spacing': [2, 'never']
		},
		parser: 'babel-eslint'
	});
});

test('findApplicableOverrides', t => {
	const result = manager.findApplicableOverrides('/user/dir/foo.js', [
		{files: '**/f*.js'},
		{files: '**/bar.js'},
		{files: '**/*oo.js'},
		{files: '**/*.txt'}
	]);

	t.is(result.hash, parseInt('1010', 2));
	t.same(result.applicable, [
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
			space: 3
		}
	];

	const result = manager.groupConfigs(paths, opts, overrides);

	t.same(result, [
		{
			opts: {esnext: false},
			paths: ['/user/foo/hello.js', '/user/foo/goodbye.js']
		},
		{
			opts: {esnext: false, space: 3},
			paths: ['/user/foo/howdy.js']
		},
		{
			opts: {esnext: true},
			paths: ['/user/bar/hello.js']
		}
	]);
});
