import fs from 'fs';
import test from 'ava';
import tempWrite from 'temp-write';
import execa from 'execa';
import path from 'path';

global.Promise = Promise;

test('fix option', async t => {
	const filepath = await tempWrite('var foo = 0; foo ++;', 'x.js');
	await execa('../cli.js', ['--no-local', '--fix', filepath]);
	t.is(fs.readFileSync(filepath, 'utf8').trim(), 'var foo = 0; foo++;');
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

test.skip('ignores fixture', async t => {
	const cwd = path.join(__dirname, 'fixtures/ignores');
	t.throws(execa('../../../cli.js', ['--no-local'], {cwd}));
});
