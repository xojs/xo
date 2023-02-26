import process from 'node:process';
import path from 'node:path';
import test from 'ava';
import createEsmUtils from 'esm-utils';
import xo from '../lib/flat-xo/index.js';

const {__dirname} = createEsmUtils(import.meta);
process.chdir(__dirname);

const hasRule = (results, filePath, ruleId, rulesMeta) => {
	const result = results.find(x => x.filePath === filePath);
	const hasRuleInResults = result ? result.messages.some(x => x.ruleId === ruleId) : false;
	const hasRuleInResultsMeta = rulesMeta ? typeof rulesMeta[ruleId] === 'object' : true;
	return hasRuleInResults && hasRuleInResultsMeta;
};

test('ignores dirs for empty extensions', async t => {
	{
		const cwd = path.join(__dirname, 'fixtures/nodir');
		const glob = '*';
		const results = await xo.lintFiles(glob, {extensions: ['', 'js'], cwd});
		const {results: [fileResult]} = results;

		// Only `fixtures/nodir/noextension` should be linted
		const expected = 'fixtures/nodir/noextension'.split('/').join(path.sep);
		const actual = path.relative(__dirname, fileResult.filePath);
		t.is(actual, expected);
		t.is(results.errorCount, 1);
	}

	{
		const cwd = path.join(__dirname, 'fixtures/nodir');
		const glob = 'nested/*';
		const results = await xo.lintFiles(glob, {cwd});
		const {results: [fileResult]} = results;

		// Ensure `nodir/nested` **would** report if globbed
		const expected = 'fixtures/nodir/nested/index.js'.split('/').join(path.sep);
		const actual = path.relative(__dirname, fileResult.filePath);
		t.is(actual, expected);
		t.is(results.errorCount, 1);
	}

	{
		const cwd = path.join(__dirname, 'fixtures/nodir');
		// Check Windows-style paths are working
		const glob = 'nested\\*';
		const results = await xo.lintFiles(glob, {cwd});
		const {results: [fileResult]} = results;

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
	const glob = '**/*';
	const ignored = path.resolve('fixtures/gitignore/test/foo.js');
	const {results} = await xo.lintFiles(glob, {cwd});

	t.is(results.some(r => r.filePath === ignored), false);
});

test('do not lint gitignored files in file with negative gitignores', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const glob = '*';
	const ignored = path.resolve('fixtures/negative-gitignore/bar.js');
	const {results} = await xo.lintFiles(glob, {cwd});

	t.is(results.some(r => r.filePath === ignored), false);
});

test('lint negatively gitignored files', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const glob = '*';
	const negative = path.resolve('fixtures/negative-gitignore/foo.js');
	const {results} = await xo.lintFiles(glob, {cwd});

	t.is(results.some(r => r.filePath === negative), true);
});

test('do not lint inapplicable negatively gitignored files', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const glob = 'bar.js';
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

test.failing('enable rules based on nodeVersion', async t => {
	const {results, rulesMeta} = await xo.lintFiles('**/*', {cwd: 'fixtures/engines-overrides'});

	// The transpiled file (as specified in `overrides`) should use `await`
	t.true(
		hasRule(
			results,
			path.resolve('fixtures/engines-overrides/promise-then-transpile.js'),
			'promise/prefer-await-to-then',
			rulesMeta,
		),
	);
	// The non transpiled files can use `.then`
	t.false(
		hasRule(
			results,
			path.resolve('fixtures/engines-overrides/promise-then.js'),
			'promise/prefer-await-to-then',
			rulesMeta,
		),
	);
});

test.serial('typescript files', async t => {
	const {results, rulesMeta} = await xo.lintFiles('**/*', {cwd: 'fixtures/typescript'});

	t.true(
		hasRule(
			results,
			path.resolve('fixtures/typescript/two-spaces.tsx'),
			'@typescript-eslint/indent',
			rulesMeta,
		),
	);

	t.true(
		hasRule(
			results,
			path.resolve('fixtures/typescript/child/extra-semicolon.ts'),
			'@typescript-eslint/no-extra-semi',
			rulesMeta,
		),
	);

	t.true(
		hasRule(
			results,
			path.resolve('fixtures/typescript/child/sub-child/four-spaces.ts'),
			'@typescript-eslint/indent',
			rulesMeta,
		),
	);
});

test.serial('typescript 2 space option', async t => {
	const {errorCount, results} = await xo.lintFiles('two-spaces.tsx', {cwd: 'fixtures/typescript', space: 2});
	// eslint-disable-next-line ava/assertion-arguments
	t.is(errorCount, 0, JSON.stringify(results[0].messages));
});

test.serial('typescript 4 space option', async t => {
	const {errorCount} = await xo.lintFiles('child/sub-child/four-spaces.ts', {cwd: 'fixtures/typescript', space: 4});
	t.is(errorCount, 0);
});

test.serial('typescript no semicolon option', async t => {
	const {errorCount} = await xo.lintFiles('child/no-semicolon.ts', {cwd: 'fixtures/typescript', semicolon: false});
	t.is(errorCount, 0);
});
