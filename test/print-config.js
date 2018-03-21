import path from 'path';
import test from 'ava';
import execa from 'execa';
import tempWrite from 'temp-write';
import fn from '..';

process.chdir(__dirname);

const main = (args, opts) => execa(path.join(__dirname, '../main.js'), args, opts);

const hasUnicornPlugin = config => config.plugins.indexOf('unicorn') !== -1;
const hasPrintConfigGlobal = config => Object.keys(config.globals).indexOf('printConfig') !== -1;

test('getConfigForFile', async t => {
	const filepath = await tempWrite('console.log()\n', 'x.js');
	const opts = {globals: ['printConfig']};
	const result = fn.getConfigForFile(filepath, opts);
  t.true(hasUnicornPlugin(result) && hasPrintConfigGlobal(result));
});

test('print-config option', async t => {
	const filepath = await tempWrite('console.log()\n', 'x.js');
	const {stdout} = await main(['--print-config', '--global=printConfig', filepath]);
	const result = JSON.parse(stdout);
	t.true(hasUnicornPlugin(result) && hasPrintConfigGlobal(result));
});
