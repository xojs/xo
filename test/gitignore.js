import path from 'path';
import test from 'ava';
import proxyquire from 'proxyquire';

process.chdir(__dirname);

const manager = proxyquire('../lib/options-manager', {
	'resolve-from': (cwd, path) => `cwd/${path}`
});

test('gitignore', t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore/test');
	const filter = manager.getGitIgnoreFilter({cwd});
	const actual = ['foo.js', 'bar.js'].filter(v => filter(v));
	const expected = ['bar.js'];
	t.deepEqual(actual, expected);
});

test('ignore ignored .gitignore', t => {
	const opts = {
		cwd: path.join(__dirname, 'fixtures/gitignore'),
		ignores: ['**/test/**']
	};

	const filter = manager.getGitIgnoreFilter(opts);
	const actual = ['foo.js'].filter(v => filter(v));
	const expected = ['foo.js'];
	t.deepEqual(actual, expected);
});

test.serial('patterns should be translated according to process.cwd()', t => {
	const previous = process.cwd();
	const cwd = path.join(__dirname, 'fixtures/gitignore');
	process.chdir(cwd);
	try {
		const filter = manager.getGitIgnoreFilter({});
		const actual = ['bar.js', 'test/foo.js', 'test/bar.js'].filter(v => filter(v));
		const expected = ['bar.js', 'test/bar.js'];
		t.deepEqual(actual, expected);
	} finally {
		process.chdir(previous);
	}
});
