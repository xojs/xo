import test from 'ava';
import path from 'path';
import proxyquire from 'proxyquire';
import fn from '..';

const openReport = proxyquire('../lib/open-report', {
	'open-editor': files => files
});

process.chdir(__dirname);

test('opens nothing when there are no errors nor warnings', async t => {
	const glob = path.join(__dirname, 'fixtures/open-report/successes/*');
	const results = await fn.lintFiles(glob);

	const actual = openReport(results);
	const expected = [];

	t.deepEqual(actual, expected);
});

test('only opens errors if there are errors and warnings', async t => {
	const glob = path.join(__dirname, 'fixtures/open-report/**');
	const results = await fn.lintFiles(glob);

	const actual = openReport(results);
	const expected = [
		{
			file: path.join(__dirname, 'fixtures/open-report/errors/one.js'),
			line: 1,
			column: 7
		},
		{
			file: path.join(__dirname, 'fixtures/open-report/errors/two-with-warnings.js'),
			line: 1,
			column: 1
		},
		{
			file: path.join(__dirname, 'fixtures/open-report/errors/three.js'),
			line: 1,
			column: 7
		}
	];

	t.deepEqual(actual, expected);
});

test('only opens warnings if there are no errors', async t => {
	const glob = path.join(__dirname, 'fixtures/open-report/warnings/*');
	const results = await fn.lintFiles(glob);

	const actual = openReport(results);
	const expected = [
		{
			file: path.join(__dirname, 'fixtures/open-report/warnings/one.js'),
			line: 1,
			column: 1
		},
		{
			file: path.join(__dirname, 'fixtures/open-report/warnings/three.js'),
			line: 1,
			column: 1
		}
	];

	t.deepEqual(actual, expected);
});
