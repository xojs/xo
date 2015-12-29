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

test('fixture', async t => {
	const cwd = path.join(__dirname, 'fixtures');
	await execa('../../cli.js', ['--no-local'], {cwd});
});
