import path from 'path';
import test from 'ava';
import execa from 'execa';

const cwd = path.dirname(__dirname);
const packageJson = require(path.join(cwd, 'package.json'));
const cli = (args, opts) => execa(path.join(cwd, 'cli.js'), args, opts);

test('runs no-local install of XO', async t => {
	const {stdout} = await cli(['--no-local', '--version'], {cwd});
	t.is(stdout, packageJson.version);
});
