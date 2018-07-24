import fs from 'fs';
import path from 'path';
import test from 'ava';
import pify from 'pify';
import fn from '..';

process.chdir(__dirname);

const readFile = pify(fs.readFile);
const hasRule = (results, ruleId) => results[0].messages.some(x => x.ruleId === ruleId);

test('.lintText()', t => {
	const {results} = fn.lintText(`'use strict'\nconsole.log('unicorn');\n`);
	t.true(hasRule(results, 'semi'));
});

test('default `ignores`', t => {
	const result = fn.lintText(`'use strict'\nconsole.log('unicorn');\n`, {
		filename: 'node_modules/ignored/index.js'
	});
	t.is(result.errorCount, 0);
	t.is(result.warningCount, 0);
});

test('`ignores` option', t => {
	const result = fn.lintText(`'use strict'\nconsole.log('unicorn');\n`, {
		filename: 'ignored/index.js',
		ignores: ['ignored/**/*.js']
	});
	t.is(result.errorCount, 0);
	t.is(result.warningCount, 0);
});

test('`ignores` option without cwd', t => {
	const result = fn.lintText(`'use strict'\nconsole.log('unicorn');\n`, {
		filename: 'ignored/index.js',
		ignores: ['ignored/**/*.js']
	});
	t.is(result.errorCount, 0);
	t.is(result.warningCount, 0);
});

test('respect overrides', t => {
	const result = fn.lintText(`'use strict'\nconsole.log('unicorn');\n`, {
		filename: 'ignored/index.js',
		ignores: ['ignored/**/*.js'],
		overrides: [
			{
				files: ['ignored/**/*.js'],
				ignores: []
			}
		]
	});
	t.is(result.errorCount, 1);
	t.is(result.warningCount, 0);
});

test('overriden ignore', t => {
	const result = fn.lintText(`'use strict'\nconsole.log('unicorn');\n`, {
		filename: 'unignored.js',
		overrides: [
			{
				files: ['unignored.js'],
				ignores: ['unignored.js']
			}
		]
	});
	t.is(result.errorCount, 0);
	t.is(result.warningCount, 0);
});

test('`ignores` option without filename', t => {
	t.throws(() => {
		fn.lintText(`'use strict'\nconsole.log('unicorn');\n`, {
			ignores: ['ignored/**/*.js']
		});
	}, /The `ignores` option requires the `filename` option to be defined./);
});

test('JSX support', t => {
	const {results} = fn.lintText('const app = <div className="appClass">Hello, React!</div>;\n');
	t.true(hasRule(results, 'no-unused-vars'));
});

test('plugin support', t => {
	const {results} = fn.lintText('var React;\nReact.render(<App/>);\n', {
		plugins: ['react'],
		rules: {'react/jsx-no-undef': 'error'}
	});
	t.true(hasRule(results, 'react/jsx-no-undef'));
});

test('prevent use of extended native objects', t => {
	const {results} = fn.lintText('[].unicorn();\n');
	t.true(hasRule(results, 'no-use-extend-native/no-use-extend-native'));
});

test('extends support', t => {
	const {results} = fn.lintText('var React;\nReact.render(<App/>);\n', {
		extends: 'xo-react'
	});
	t.true(hasRule(results, 'react/jsx-no-undef'));
});

test('extends support with `esnext` option', t => {
	const {results} = fn.lintText('import path from \'path\';\nlet React;\nReact.render(<App/>);\n', {
		extends: 'xo-react'
	});
	t.true(hasRule(results, 'react/jsx-no-undef'));
});

test('disable style rules when `prettier` option is enabled', t => {
	const withoutPrettier = fn.lintText('(a) => {}\n', {filename: 'test.js'}).results;
	// `arrow-parens` is enabled
	t.true(hasRule(withoutPrettier, 'arrow-parens'));
	// `prettier/prettier` is disabled
	t.false(hasRule(withoutPrettier, 'prettier/prettier'));

	const withPrettier = fn.lintText('(a) => {}\n', {prettier: true, filename: 'test.js'}).results;
	// `arrow-parens` is disabled by `eslint-config-prettier`
	t.false(hasRule(withPrettier, 'arrow-parens'));
	// `prettier/prettier` is enabled
	t.true(hasRule(withPrettier, 'prettier/prettier'));
});

test('extends `react` support with `prettier` option', t => {
	const {results} = fn.lintText('<Hello name={ firstname } />;\n', {extends: 'xo-react', prettier: true, filename: 'test.jsx'});
	// `react/jsx-curly-spacing` is disabled by `eslint-config-prettier`
	t.false(hasRule(results, 'react/jsx-curly-spacing'));
	// `prettier/prettier` is enabled
	t.true(hasRule(results, 'prettier/prettier'));
});

test('always use the latest ECMAScript parser so esnext syntax won\'t throw in normal mode', t => {
	const {results} = fn.lintText('async function foo() {}\n\nfoo();\n');
	t.is(results[0].errorCount, 0);
});

test('regression test for #71', t => {
	const {results} = fn.lintText(`const foo = { key: 'value' };\nconsole.log(foo);\n`, {
		extends: path.join(__dirname, 'fixtures/extends.js')
	});
	t.is(results[0].errorCount, 0, results[0]);
});

test('lintText() - overrides support', async t => {
	const cwd = path.join(__dirname, 'fixtures/overrides');
	const bar = path.join(cwd, 'test/bar.js');
	const barResults = fn.lintText(await readFile(bar, 'utf8'), {filename: bar, cwd}).results;
	t.is(barResults[0].errorCount, 0, barResults[0]);

	const foo = path.join(cwd, 'test/foo.js');
	const fooResults = fn.lintText(await readFile(foo, 'utf8'), {filename: foo, cwd}).results;
	t.is(fooResults[0].errorCount, 0, fooResults[0]);

	const index = path.join(cwd, 'test/index.js');
	const indexResults = fn.lintText(await readFile(bar, 'utf8'), {filename: index, cwd}).results;
	t.is(indexResults[0].errorCount, 0, indexResults[0]);
});

test('do not lint gitignored files if filename is given', async t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore');
	const ignoredPath = path.resolve('fixtures/gitignore/test/foo.js');
	const ignored = await readFile(ignoredPath, 'utf-8');
	const {results} = fn.lintText(ignored, {filename: ignoredPath, cwd});
	t.is(results[0].errorCount, 0);
});

test('lint gitignored files if filename is not given', async t => {
	const ignoredPath = path.resolve('fixtures/gitignore/test/foo.js');
	const ignored = await readFile(ignoredPath, 'utf-8');
	const {results} = fn.lintText(ignored);
	t.true(results[0].errorCount > 0);
});

test('do not lint gitignored files in file with negative gitignores', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const ignoredPath = path.resolve('fixtures/negative-gitignore/bar.js');
	const ignored = await readFile(ignoredPath, 'utf-8');
	const {results} = fn.lintText(ignored, {filename: ignoredPath, cwd});
	t.is(results[0].errorCount, 0);
});

test('multiple negative patterns should act as positive patterns', async t => {
	const cwd = path.join(__dirname, 'fixtures', 'gitignore-multiple-negation');
	const filename = path.join(cwd, '!!!unicorn.js');
	const text = await readFile(filename, 'utf-8');
	const {results} = fn.lintText(text, {filename, cwd});
	t.is(results[0].errorCount, 0);
});

test('lint negatively gitignored files', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const glob = path.posix.join(cwd, '*');
	const {results} = await fn.lintFiles(glob, {cwd});

	t.true(results[0].errorCount > 0);
});
