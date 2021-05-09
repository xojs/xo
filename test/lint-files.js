import path from 'path';
import test from 'ava';
import xo from '../index.js';

process.chdir(__dirname);

const hasRule = (results, filePath, ruleId) => {
	const result = results.find(x => x.filePath === filePath);
	return result ? result.messages.some(x => x.ruleId === ruleId) : false;
};

test('only accepts allowed extensions', async t => {
	// Markdown files will always produce linter errors and will not be going away
	const mdGlob = path.join(__dirname, '..', '*.md');

	// No files should be linted = no errors
	const noOptionsResults = await xo.lintFiles(mdGlob, {});
	t.is(noOptionsResults.errorCount, 0);

	// Markdown files linted (with no plugin for it) = errors
	const moreExtensionsResults = await xo.lintFiles(mdGlob, {extensions: ['md']});
	t.true(moreExtensionsResults.errorCount > 0);
});

test('ignores dirs for empty extensions', async t => {
	{
		const glob = path.join(__dirname, 'fixtures/nodir/*');
		const results = await xo.lintFiles(glob, {extensions: ['', 'js']});
		const {results: [fileResult]} = results;

		// Only `fixtures/nodir/noextension` should be linted
		const expected = 'fixtures/nodir/noextension'.split('/').join(path.sep);
		const actual = path.relative(__dirname, fileResult.filePath);
		t.is(actual, expected);
		t.is(results.errorCount, 1);
	}

	{
		const glob = path.join(__dirname, 'fixtures/nodir/nested/*');
		const results = await xo.lintFiles(glob);
		const {results: [fileResult]} = results;

		// Ensure `nodir/nested` **would** report if globbed
		const expected = 'fixtures/nodir/nested/index.js'.split('/').join(path.sep);
		const actual = path.relative(__dirname, fileResult.filePath);
		t.is(actual, expected);
		t.is(results.errorCount, 1);
	}
});

test.serial('cwd option', async t => {
	const {results} = await xo.lintFiles('**/*', {cwd: 'fixtures/cwd'});
	const paths = results.map(r => path.relative(__dirname, r.filePath));
	paths.sort();
	t.deepEqual(paths, [path.join('fixtures', 'cwd', 'unicorn.js')]);
});

test('do not lint gitignored files', async t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore');
	const glob = path.posix.join(cwd, '**/*');
	const ignored = path.resolve('fixtures/gitignore/test/foo.js');
	const {results} = await xo.lintFiles(glob, {cwd});

	t.is(results.some(r => r.filePath === ignored), false);
});

test('do not lint gitignored files in file with negative gitignores', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const glob = path.posix.join(cwd, '*');
	const ignored = path.resolve('fixtures/negative-gitignore/bar.js');
	const {results} = await xo.lintFiles(glob, {cwd});

	t.is(results.some(r => r.filePath === ignored), false);
});

test('lint negatively gitignored files', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const glob = path.posix.join(cwd, '*');
	const negative = path.resolve('fixtures/negative-gitignore/foo.js');
	const {results} = await xo.lintFiles(glob, {cwd});

	t.is(results.some(r => r.filePath === negative), true);
});

test('do not lint inapplicable negatively gitignored files', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const glob = path.posix.join(cwd, 'bar.js');
	const negative = path.resolve('fixtures/negative-gitignore/foo.js');
	const {results} = await xo.lintFiles(glob, {cwd});

	t.is(results.some(r => r.filePath === negative), false);
});

test('multiple negative patterns should act as positive patterns', async t => {
	const cwd = path.join(__dirname, 'fixtures', 'gitignore-multiple-negation');
	const {results} = await xo.lintFiles('**/*', {cwd});
	const paths = results.map(r => path.basename(r.filePath));
	paths.sort();

	t.deepEqual(paths, ['!!unicorn.js', '!unicorn.js']);
});

test('enable rules based on nodeVersion', async t => {
	const {results} = await xo.lintFiles('**/*', {cwd: 'fixtures/engines-overrides'});

	// The transpiled file (as specified in `overrides`) should use `await`
	t.true(
		hasRule(
			results,
			path.resolve('fixtures/engines-overrides/promise-then-transpile.js'),
			'promise/prefer-await-to-then'
		)
	);
	// The non transpiled files can use `.then`
	t.false(
		hasRule(
			results,
			path.resolve('fixtures/engines-overrides/promise-then.js'),
			'promise/prefer-await-to-then'
		)
	);
});

test('do not lint eslintignored files', async t => {
	const cwd = path.join(__dirname, 'fixtures/eslintignore');
	const glob = path.posix.join(cwd, '*');
	const positive = path.resolve('fixtures/eslintignore/foo.js');
	const negative = path.resolve('fixtures/eslintignore/bar.js');
	const {results} = await xo.lintFiles(glob, {cwd});

	t.is(results.some(r => r.filePath === positive), true);
	t.is(results.some(r => r.filePath === negative), false);
});

test('find configurations close to linted file', async t => {
	const {results} = await xo.lintFiles('**/*', {cwd: 'fixtures/nested-configs'});

	t.true(
		hasRule(
			results,
			path.resolve('fixtures/nested-configs/child/semicolon.js'),
			'semi'
		)
	);

	t.true(
		hasRule(
			results,
			path.resolve('fixtures/nested-configs/child-override/child-prettier-override/semicolon.js'),
			'prettier/prettier'
		)
	);

	t.true(
		hasRule(
			results,
			path.resolve('fixtures/nested-configs/no-semicolon.js'),
			'semi'
		)
	);

	t.true(
		hasRule(
			results,
			path.resolve('fixtures/nested-configs/child-override/two-spaces.js'),
			'indent'
		)
	);
});

test('typescript files', async t => {
	const {results} = await xo.lintFiles('**/*', {cwd: 'fixtures/typescript'});

	t.true(
		hasRule(
			results,
			path.resolve('fixtures/typescript/two-spaces.tsx'),
			'@typescript-eslint/indent'
		)
	);

	t.true(
		hasRule(
			results,
			path.resolve('fixtures/typescript/child/extra-semicolon.ts'),
			'@typescript-eslint/no-extra-semi'
		)
	);

	t.true(
		hasRule(
			results,
			path.resolve('fixtures/typescript/child/sub-child/four-spaces.ts'),
			'@typescript-eslint/indent'
		)
	);
});

test('typescript 2 space option', async t => {
	const {errorCount, results} = await xo.lintFiles('two-spaces.tsx', {cwd: 'fixtures/typescript', space: 2});
	t.is(errorCount, 0, JSON.stringify(results[0].messages));
});

test('typescript 4 space option', async t => {
	const {errorCount} = await xo.lintFiles('child/sub-child/four-spaces.ts', {cwd: 'fixtures/typescript', space: 4});
	t.is(errorCount, 0);
});

test('typescript no semicolon option', async t => {
	const {errorCount} = await xo.lintFiles('child/no-semicolon.ts', {cwd: 'fixtures/typescript', semicolon: false});
	t.is(errorCount, 0);
});

test('webpack import resolver is used if webpack.config.js is found', async t => {
	const cwd = 'fixtures/webpack/with-config/';
	const {results} = await xo.lintFiles(path.resolve(cwd, 'file1.js'), {
		cwd,
		rules: {
			'import/no-unresolved': 2
		}
	});

	t.is(results[0].errorCount, 1, JSON.stringify(results[0].messages));

	const errorMessage = results[0].messages[0].message;
	t.truthy(/Unable to resolve path to module 'inexistent'/.exec(errorMessage));
});

test('webpack import resolver config can be passed through webpack option', async t => {
	const cwd = 'fixtures/webpack/no-config/';

	const {results} = await xo.lintFiles(path.resolve(cwd, 'file1.js'), {
		cwd,
		webpack: {
			config: {
				resolve: {
					alias: {
						file2alias: path.resolve(__dirname, cwd, './file2.js')
					}
				}
			}
		},
		rules: {
			'import/no-unresolved': 2
		}
	});

	t.is(results[0].errorCount, 1, JSON.stringify(results[0].messages));
});

test('webpack import resolver is used if {webpack: true}', async t => {
	const cwd = 'fixtures/webpack/no-config/';

	const {results} = await xo.lintFiles(path.resolve(cwd, 'file3.js'), {
		cwd,
		webpack: true,
		rules: {
			'import/no-unresolved': 2,
			'import/no-webpack-loader-syntax': 0
		}
	});

	t.is(results[0].errorCount, 0, JSON.stringify(results[0]));
});

async function configType(t, {dir}) {
	const {results} = await xo.lintFiles('**/*', {cwd: path.resolve('fixtures', 'config-files', dir)});

	t.true(
		hasRule(
			results,
			path.resolve('fixtures', 'config-files', dir, 'file.js'),
			'indent'
		)
	);
}

configType.title = (_, {type}) => `load config from ${type}`.trim();

test(configType, {type: 'xo.config.js', dir: 'xo-config_js'});
test(configType, {type: '.xo-config.js', dir: 'xo-config_js'});
test(configType, {type: '.xo-config.json', dir: 'xo-config_json'});
test(configType, {type: '.xo-config', dir: 'xo-config'});
