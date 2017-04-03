import path from 'path';
import test from 'ava';
import globby from 'globby';

import GitignoreParser from '../gitignore-parser';

process.chdir(__dirname);

test('positive patterns should be translated to negative patterns', t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore/test');
	const parser = new GitignoreParser({cwd});
	const result = parser.parseFile(path.join(cwd, '.gitignore'));

	t.true(result.includes('!foo.js'));
});

test('patterns should be translated according to process.cwd()', t => {
	const parser = new GitignoreParser();
	const result = parser.parseFile('fixtures/gitignore/test/.gitignore');

	t.true(result.includes('!fixtures/gitignore/test/foo.js'));
});

test('patterns should be translated according to cwd', t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore/test');
	const parser = new GitignoreParser({cwd});
	const result = parser.parseFile('.gitignore');

	t.true(result.includes('!foo.js'));
});

test('multiple negative patterns should act as positive patterns', async t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore-double-negation');
	const parser = new GitignoreParser({cwd});
	const patterns = ['**/*'].concat(parser.parseFile('.gitignore'));
	const paths = await globby(patterns, {cwd});
	paths.sort();

	t.deepEqual(paths, ['!!unicorn.js', '!unicorn.js']);
});

test('multiple negative patterns should act as positive patterns according to process.cwd()', async t => {
	const joinCwd = p => path.posix.join('fixtures', 'gitignore-double-negation', p);
	const parser = new GitignoreParser();
	const patterns = [joinCwd('**/*')].concat(parser.parseFile(joinCwd('.gitignore')));
	const paths = await globby(patterns);
	paths.sort();

	t.deepEqual(paths, ['!!unicorn.js', '!unicorn.js'].map(joinCwd));
});
