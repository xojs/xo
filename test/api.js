import fs from 'fs';
import path from 'path';
import test from 'ava';
import pify from 'pify';
import fn from '../';

process.chdir(__dirname);

const readFile = pify(fs.readFile);

const hasRule = (results, ruleId) => results[0].messages.some(x => x.ruleId === ruleId);

test('.lintText()', t => {
	const results = fn.lintText(`'use strict'\nconsole.log('unicorn');\n`).results;
	t.true(hasRule(results, 'semi'));
});

test('.lintText() - default `ignores`', t => {
	const result = fn.lintText(`'use strict'\nconsole.log('unicorn');\n`, {
		filename: 'node_modules/ignored/index.js'
	});
	t.is(result.errorCount, 0);
	t.is(result.warningCount, 0);
});

test('.lintText() - `ignores` option', t => {
	const result = fn.lintText(`'use strict'\nconsole.log('unicorn');\n`, {
		filename: 'ignored/index.js',
		ignores: ['ignored/**/*.js']
	});
	t.is(result.errorCount, 0);
	t.is(result.warningCount, 0);
});

test('.lintText() - `ignores` option without cwd', t => {
	const result = fn.lintText(`'use strict'\nconsole.log('unicorn');\n`, {
		filename: 'ignored/index.js',
		ignores: ['ignored/**/*.js']
	});
	t.is(result.errorCount, 0);
	t.is(result.warningCount, 0);
});

test('.lintText() - respect overrides', t => {
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

test('.lintText() - overriden ignore', t => {
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

test('.lintText() - `ignores` option without filename', t => {
	t.throws(() => {
		fn.lintText(`'use strict'\nconsole.log('unicorn');\n`, {
			ignores: ['ignored/**/*.js']
		});
	}, /The `ignores` option requires the `filename` option to be defined./);
});

test('.lintText() - JSX support', t => {
	const results = fn.lintText('const app = <div className="appClass">Hello, React!</div>;\n').results;
	t.true(hasRule(results, 'no-unused-vars'));
});

test('.lintText() - plugin support', t => {
	const results = fn.lintText('var React;\nReact.render(<App/>);\n', {
		plugins: ['react'],
		rules: {'react/jsx-no-undef': 'error'}
	}).results;
	t.true(hasRule(results, 'react/jsx-no-undef'));
});

test('.lintText() - prevent use of extended native objects', t => {
	const results = fn.lintText('[].unicorn();\n').results;
	t.true(hasRule(results, 'no-use-extend-native/no-use-extend-native'));
});

test('.lintText() - extends support', t => {
	const results = fn.lintText('var React;\nReact.render(<App/>);\n', {
		extends: 'xo-react'
	}).results;
	t.true(hasRule(results, 'react/jsx-no-undef'));
});

test('.lintText() - extends support with `esnext` option', t => {
	const results = fn.lintText('import path from \'path\';\nlet React;\nReact.render(<App/>);\n', {
		extends: 'xo-react'
	}).results;
	t.true(hasRule(results, 'react/jsx-no-undef'));
});

test('always use the latest ECMAScript parser so esnext syntax won\'t throw in normal mode', t => {
	const results = fn.lintText('async function foo() {}\n\nfoo();\n').results;
	t.is(results[0].errorCount, 0);
});

test('.lintText() - regression test for #71', t => {
	const results = fn.lintText(`const foo = { key: 'value' };\nconsole.log(foo);\n`, {
		extends: path.join(__dirname, 'fixtures/extends.js')
	}).results;
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

test('.lintText() - do not lint gitignored files if filename is given', async t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore');
	const ignoredPath = path.resolve('fixtures/gitignore/test/foo.js');
	const ignored = await readFile(ignoredPath, 'utf-8');
	const {results} = fn.lintText(ignored, {filename: ignoredPath, cwd});
	t.is(results[0].errorCount, 0);
});

test('.lintText() - lint gitignored files if filename is not given', async t => {
	const ignoredPath = path.resolve('fixtures/gitignore/test/foo.js');
	const ignored = await readFile(ignoredPath, 'utf-8');
	const {results} = fn.lintText(ignored);
	t.true(results[0].errorCount > 0);
});

test('.lintText() - do not lint gitignored files in file with negative gitignores', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const ignoredPath = path.resolve('fixtures/negative-gitignore/bar.js');
	const ignored = await readFile(ignoredPath, 'utf-8');
	const {results} = fn.lintText(ignored, {filename: ignoredPath, cwd});
	t.is(results[0].errorCount, 0);
});

test('.lintText() - multiple negative patterns should act as positive patterns', async t => {
	const cwd = path.join(__dirname, 'fixtures', 'gitignore-multiple-negation');
	const filename = path.join(cwd, '!!!unicorn.js');
	const text = await readFile(filename, 'utf-8');
	const {results} = fn.lintText(text, {filename, cwd});
	t.is(results[0].errorCount, 0);
});

test('.lintText() - lint negatively gitignored files', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const glob = path.posix.join(cwd, '*');
	const {results} = await fn.lintFiles(glob, {cwd});

	t.true(results[0].errorCount > 0);
});

test('.lintFiles() - only accepts whitelisted extensions', async t => {
	// Markdown files will always produce linter errors and will not be going away
	const mdGlob = path.join(__dirname, '..', '*.md');

	// No files should be linted = no errors
	const noOptionsResults = await fn.lintFiles(mdGlob, {});
	t.is(noOptionsResults.errorCount, 0);

	// Markdown files linted (with no plugin for it) = errors
	const moreExtensionsResults = await fn.lintFiles(mdGlob, {extensions: ['md']});
	t.true(moreExtensionsResults.errorCount > 0);
});

test('.lintFiles() - ignores dirs for empty extensions', async t => {
	{
		const glob = path.join(__dirname, 'fixtures/nodir/*');
		const results = await fn.lintFiles(glob, {extensions: ['', 'js']});
		const {results: [fileResult]} = results;

		// Only `fixtures/nodir/noextension` should be linted
		const expected = 'fixtures/nodir/noextension'.split('/').join(path.sep);
		const actual = path.relative(__dirname, fileResult.filePath);
		t.is(actual, expected);
		t.is(results.errorCount, 1);
	}

	{
		const glob = path.join(__dirname, 'fixtures/nodir/nested/*');
		const results = await fn.lintFiles(glob);
		const {results: [fileResult]} = results;

		// Ensure `nodir/nested` **would** report if globbed
		const expected = 'fixtures/nodir/nested/index.js'.split('/').join(path.sep);
		const actual = path.relative(__dirname, fileResult.filePath);
		t.is(actual, expected);
		t.is(results.errorCount, 1);
	}
});

test('cwd option', async t => {
	const {results} = await fn.lintFiles('**/*', {cwd: 'fixtures/cwd'});
	const paths = results.map(r => path.relative(__dirname, r.filePath));
	paths.sort();
	t.deepEqual(paths, [path.join('fixtures', 'cwd', 'unicorn.js')]);
});

test('.lintFiles() - do not lint gitignored files', async t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore');
	const glob = path.posix.join(cwd, '**/*');
	const ignored = path.resolve('fixtures/gitignore/test/foo.js');
	const {results} = await fn.lintFiles(glob, {cwd});

	t.is(results.some(r => r.filePath === ignored), false);
});

test('.lintFiles() - do not lint gitignored files in file with negative gitignores', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const glob = path.posix.join(cwd, '*');
	const ignored = path.resolve('fixtures/negative-gitignore/bar.js');
	const {results} = await fn.lintFiles(glob, {cwd});

	t.is(results.some(r => r.filePath === ignored), false);
});

test('.lintFiles() - lint negatively gitignored files', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const glob = path.posix.join(cwd, '*');
	const negative = path.resolve('fixtures/negative-gitignore/foo.js');
	const {results} = await fn.lintFiles(glob, {cwd});

	t.is(results.some(r => r.filePath === negative), true);
});

test('.lintFiles() - do not lint inapplicable negatively gitignored files', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const glob = path.posix.join(cwd, 'bar.js');
	const negative = path.resolve('fixtures/negative-gitignore/foo.js');
	const {results} = await fn.lintFiles(glob, {cwd});

	t.is(results.some(r => r.filePath === negative), false);
});

test('.lintFiles() - multiple negative patterns should act as positive patterns', async t => {
	const cwd = path.join(__dirname, 'fixtures', 'gitignore-multiple-negation');
	const {results} = await fn.lintFiles('**/*', {cwd});
	const paths = results.map(r => path.basename(r.filePath));
	paths.sort();

	t.deepEqual(paths, ['!!unicorn.js', '!unicorn.js']);
});
