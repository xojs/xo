
import path from 'node:path';
import test from 'ava';
import createEsmUtils from 'esm-utils';
import xo from '../index.js';

const {__dirname} = createEsmUtils(import.meta);

test('Should pickup "ignores" config', async t => {
	const cwd = path.join(__dirname, 'fixtures/nested-ignores');

	// Should not match `a.js`, `child/a.js`, and `child/b.js`
	const result = await xo.lintFiles('.', {cwd});
	const files = result.results.map(({filePath}) => filePath);
	t.deepEqual(files, [path.join(cwd, 'b.js')]);
});

test('Should ignore "ignores" config in parent', async t => {
	const cwd = path.join(__dirname, 'fixtures/nested-ignores/child');

	// Should matches `a.js` even it's ignored in parent
	const result = await xo.lintFiles('.', {cwd});
	const files = result.results.map(({filePath}) => filePath);
	t.deepEqual(files, [path.join(cwd, 'a.js')]);
});
