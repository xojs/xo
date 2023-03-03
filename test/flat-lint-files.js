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
