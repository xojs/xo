import fs from 'fs';
import test from 'ava';
import tempWrite from 'temp-write';
import execa from 'execa';
import path from 'path';

global.Promise = Promise;

test('fix option', async t => {
	const filepath = await tempWrite('var foo = 0; foo ++;', 'fix.js');
	await execa('../cli.js', ['--no-local', '--fix', filepath]);
	t.is(fs.readFileSync(filepath, 'utf8').trim(), 'var foo = 0; foo++;');
});

test('overrides fixture', async t => {
	const cwd = path.join(__dirname, 'fixtures/overrides');
	await execa('../../../cli.js', ['--no-local'], {cwd});
});

test.skip('ignores fixture', async t => {
	const cwd = path.join(__dirname, 'fixtures/ignores');
	t.throws(execa('../../../cli.js', ['--no-local'], {cwd}));
});
