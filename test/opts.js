import test from 'ava';
import proxyquire from 'proxyquire';

const manager = proxyquire('../opts', {
	'resolve-from': function(cwd, path) {
		return 'cwd/' + path;
	}
});

test('normalizeOpts: makes all the opts plural and arrays', t => {
	var opts = {
		env: 'node',
		global: 'foo',
		ignore: 'test.js',
		plugin: 'my-plugin',
		rule: {'my-rule': 'foo'},
		extend: 'foo'
	};

	manager.normalizeOpts(opts);

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
	var opts = {};

	manager.normalizeOpts(opts);

	t.same(opts, {});
});

test('buildConfig: defaults', t => {
	var config = manager.buildConfig({});

	t.true(/[\\\/]\.xo-cache[\\\/]?$/.test(config.cacheLocation));
	delete config.cacheLocation;

	t.same(config, {
		useEslintrc: false,
		cache: true,
		baseConfig: {extends: 'xo'},
		plugins: ['babel'],
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
	var config = manager.buildConfig({
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
		plugins: ['no-empty-blocks']
	});
});

test('buildConfig: space: true', t => {
	var config = manager.buildConfig({
		space: true
	});

	delete config.cacheLocation;

	t.same(config, {
		useEslintrc: false,
		cache: true,
		baseConfig: {extends: 'xo'},
		plugins: ['babel'],
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
	var config = manager.buildConfig({
		space: 4
	});

	delete config.cacheLocation;

	t.same(config, {
		useEslintrc: false,
		cache: true,
		baseConfig: {extends: 'xo'},
		plugins: ['babel'],
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
	var config = manager.buildConfig({
		semicolon: false
	});
	delete config.cacheLocation;

	t.same(config, {
		useEslintrc: false,
		cache: true,
		baseConfig: {extends: 'xo'},
		plugins: ['babel'],
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

test('buildConfig: extends is resolved to cwd', t => {
	var config = manager.buildConfig({
		extends: ['foo']
	});

	delete config.cacheLocation;

	t.same(config, {
		useEslintrc: false,
		cache: true,
		baseConfig: {extends: ['xo', 'cwd/eslint-config-foo']},
		plugins: ['babel'],
		rules: {
			'generator-star-spacing': 0,
			'arrow-parens': 0,
			'object-curly-spacing': 0,
			'babel/object-curly-spacing': [2, 'never']
		},
		parser: 'babel-eslint'
	});
});

