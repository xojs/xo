import fs from 'fs';
import test from 'ava';
import tempWrite from 'temp-write';
import execa from 'execa';

global.Promise = Promise;

test('fix option', async t => {
	const filepath = await tempWrite('var foo = 0; foo ++;', 'fix.js');
	await execa('../cli.js', ['--fix', filepath]);
	t.is(fs.readFileSync(filepath, 'utf8').trim(), 'var foo = 0; foo++;');
});
