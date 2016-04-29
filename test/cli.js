import fs from 'fs';
import path from 'path';
import test from 'ava';
import tempWrite from 'temp-write';
import execa from 'execa';

global.Promise = Promise;

test('fix option', async t => {
	const filepath = await tempWrite('console.log(0)\n', 'x.js');
	await execa('../cli.js', ['--no-local', '--fix', filepath]);
	t.is(fs.readFileSync(filepath, 'utf8').trim(), 'console.log(0);');
});

test('reporter option', async t => {
	const filepath = await tempWrite('console.log()\n', 'x.js');

	try {
		await execa('../cli.js', ['--no-local', '--reporter=compact', filepath]);
	} catch (err) {
		t.true(err.stdout.indexOf('Error - ') !== -1);
	}
});

test('overrides fixture', async () => {
	const cwd = path.join(__dirname, 'fixtures/overrides');
	await execa('../../../cli.js', ['--no-local'], {cwd});
});

test.skip('ignores fixture', async t => { // eslint-disable-line
	const cwd = path.join(__dirname, 'fixtures/ignores');
	t.throws(execa('../../../cli.js', ['--no-local'], {cwd}));
});

test('supports being extended with a shareable config', async () => {
	const cwd = path.join(__dirname, 'fixtures/project');
	await execa('../../../cli.js', ['--no-local'], {cwd});
});
