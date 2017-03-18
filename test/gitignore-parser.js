import path from 'path';
import test from 'ava';

import GitignoreParser from '../gitignore-parser';

process.chdir(__dirname);

test('positive patters should be translated to negative patterns', t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore/test');
	const parser = new GitignoreParser({cwd});
	const result = parser.parseFile(path.join(cwd, '.gitignore'));

	t.true(Array.isArray(result));
	t.not(result.indexOf('!foo.js'), -1);
});

test('patters should be translated according to process.cwd()', t => {
	const parser = new GitignoreParser();
	const result = parser.parseFile('fixtures/gitignore/test/.gitignore');

	t.true(Array.isArray(result));
	t.not(result.indexOf('!fixtures/gitignore/test/foo.js'), -1);
});

test('patters should be translated according to cwd', t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore/test');
	const parser = new GitignoreParser({cwd});
	const result = parser.parseFile('.gitignore');

	t.true(Array.isArray(result));
	t.not(result.indexOf('!foo.js'), -1);
});
