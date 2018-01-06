import path from 'path';
import test from 'ava';
import fn from '..';

process.chdir(__dirname);

test('only accepts whitelisted extensions', async t => {
	// Markdown files will always produce linter errors and will not be going away
	const mdGlob = path.join(__dirname, '..', '*.md');

	// No files should be linted = no errors
	const noOptionsResults = await fn.lintFiles(mdGlob, {});
	t.is(noOptionsResults.errorCount, 0);

	// Markdown files linted (with no plugin for it) = errors
	const moreExtensionsResults = await fn.lintFiles(mdGlob, {extensions: ['md']});
	t.true(moreExtensionsResults.errorCount > 0);
});

test('ignores dirs for empty extensions', async t => {
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

test.serial('cwd option', async t => {
	const {results} = await fn.lintFiles('**/*', {cwd: 'fixtures/cwd'});
	const paths = results.map(r => path.relative(__dirname, r.filePath));
	paths.sort();
	t.deepEqual(paths, [path.join('fixtures', 'cwd', 'unicorn.js')]);
});

test('do not lint gitignored files', async t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore');
	const glob = path.posix.join(cwd, '**/*');
	const ignored = path.resolve('fixtures/gitignore/test/foo.js');
	const {results} = await fn.lintFiles(glob, {cwd});

	t.is(results.some(r => r.filePath === ignored), false);
});

test('do not lint gitignored files in file with negative gitignores', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const glob = path.posix.join(cwd, '*');
	const ignored = path.resolve('fixtures/negative-gitignore/bar.js');
	const {results} = await fn.lintFiles(glob, {cwd});

	t.is(results.some(r => r.filePath === ignored), false);
});

test('lint negatively gitignored files', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const glob = path.posix.join(cwd, '*');
	const negative = path.resolve('fixtures/negative-gitignore/foo.js');
	const {results} = await fn.lintFiles(glob, {cwd});

	t.is(results.some(r => r.filePath === negative), true);
});

test('do not lint inapplicable negatively gitignored files', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const glob = path.posix.join(cwd, 'bar.js');
	const negative = path.resolve('fixtures/negative-gitignore/foo.js');
	const {results} = await fn.lintFiles(glob, {cwd});

	t.is(results.some(r => r.filePath === negative), false);
});

test('multiple negative patterns should act as positive patterns', async t => {
	const cwd = path.join(__dirname, 'fixtures', 'gitignore-multiple-negation');
	const {results} = await fn.lintFiles('**/*', {cwd});
	const paths = results.map(r => path.basename(r.filePath));
	paths.sort();

	t.deepEqual(paths, ['!!unicorn.js', '!unicorn.js']);
});

test('respect file path for option discovery rather than process.cwd', async t => {
	const filename = path.join(__dirname, 'fixtures', 'overrides', 'index.js');
	const {results} = await fn.lintFiles(filename, {});
	t.is(results[0].errorCount, 0);
});
