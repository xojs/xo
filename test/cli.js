import fs from 'fs';
import path from 'path';
import childProcess from 'child_process';
import test from 'ava';
import pify from 'pify';
import tempWrite from 'temp-write';

test('fix option', async t => {
	const filepath = await tempWrite('var foo = 0; foo ++;', 'fix.js');
	await pify(childProcess.execFile, Promise)('../cli.js', ['--fix', filepath]);
	t.is(fs.readFileSync(filepath, 'utf8').trim(), 'var foo = 0; foo++;');
});
