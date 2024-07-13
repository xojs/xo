import process from 'node:process';
import path from 'node:path';
import test from 'ava';
import proxyquire from 'proxyquire';
import createEsmUtils from 'esm-utils';
import xo from '../index.js';

const {__dirname} = createEsmUtils(import.meta);
process.chdir(__dirname);

test.failing('opens nothing when there are no errors nor warnings', async t => {
	const glob = path.join(__dirname, 'fixtures/open-report/successes/*');
	const results = await xo.lintFiles(glob);

	const openReport = proxyquire('../lib/open-report', {
		'open-editor'(files) {
			if (files.length > 0) {
				t.fail();
			}
		},
	});

	openReport(results);
	t.pass();
});

test.failing('only opens errors if there are errors and warnings', async t => {
	const glob = path.join(__dirname, 'fixtures/open-report/**');
	const results = await xo.lintFiles(glob);

	const expected = [
		{
			file: path.join(__dirname, 'fixtures/open-report/errors/one.js'),
			line: 1,
			column: 7,
		},
		{
			file: path.join(__dirname, 'fixtures/open-report/errors/two-with-warnings.js'),
			line: 1,
			column: 1,
		},
		{
			file: path.join(__dirname, 'fixtures/open-report/errors/three.js'),
			line: 1,
			column: 7,
		},
	];

	const openReport = proxyquire('../lib/open-report', {
		'open-editor'(files) {
			t.deepEqual(files, expected);
		},
	});
	openReport(results);
});

test.failing('if a file has errors and warnings, it opens the first error', async t => {
	const glob = path.join(__dirname, 'fixtures/open-report/errors/two-with-warnings.js');
	const results = await xo.lintFiles(glob);

	const expected = [
		{
			file: path.join(__dirname, 'fixtures/open-report/errors/two-with-warnings.js'),
			line: 1,
			column: 1,
		},
	];

	const openReport = proxyquire('../lib/open-report', {
		'open-editor': files => t.deepEqual(files, expected),
	});
	openReport(results);
});

test.failing('only opens warnings if there are no errors', async t => {
	const glob = path.join(__dirname, 'fixtures/open-report/warnings/*');
	const results = await xo.lintFiles(glob);

	const expected = [
		{
			file: path.join(__dirname, 'fixtures/open-report/warnings/one.js'),
			line: 1,
			column: 1,
		},
		{
			file: path.join(__dirname, 'fixtures/open-report/warnings/three.js'),
			line: 1,
			column: 1,
		},
	];

	const openReport = proxyquire('../lib/open-report', {
		'open-editor': files => t.deepEqual(files, expected),
	});
	openReport(results);
});
