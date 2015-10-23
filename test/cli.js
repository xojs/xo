import fs from 'fs';
import path from 'path';
import childProcess from 'child_process';
import test from 'ava';
import pify from 'pify';
import tempWrite from 'temp-write';

const execFile = pify(childProcess.execFile);
const cli = path.join(__dirname, '..', 'cli.js');

test('fix option', async t => {
	const filepath = await tempWrite('var foo = 0; foo ++;', 'fix.js');
	await execFile(cli, ['--fix', filepath]);
	t.is(fs.readFileSync(filepath, 'utf8').trim(), 'var foo = 0; foo++;');
});
