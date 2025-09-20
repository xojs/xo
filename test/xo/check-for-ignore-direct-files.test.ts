import fs from 'node:fs/promises';
import path from 'node:path';
import _test, {type TestFn} from 'ava'; // eslint-disable-line ava/use-test
import dedent from 'dedent';
import {$, type ExecaError} from 'execa';
import {copyTestProject} from '../helpers/copy-test-project.js';

const test = _test as TestFn<{cwd: string}>;

test.beforeEach(async t => {
	t.context.cwd = await copyTestProject();
});

test.afterEach.always(async t => {
	await fs.rm(t.context.cwd, {recursive: true, force: true});
});

test('xo shows error for directly specified ignored file', async t => {
	// Create an ignored file
	const ignoredFile = path.join(t.context.cwd, 'ignored.js');
	await fs.writeFile(ignoredFile, dedent`console.log('ignored');\n`, 'utf8');

	// Create XO config that ignores the file
	const xoConfigPath = path.join(t.context.cwd, 'xo.config.js');
	const xoConfig = dedent`
		export default [
		    { ignores: ['ignored.js'] }
		]
	`;
	await fs.writeFile(xoConfigPath, xoConfig, 'utf8');

	// Run XO on the ignored file directly - should throw error
	const {stderr}: ExecaError = await t.throwsAsync($`node ./dist/cli --cwd ${t.context.cwd} ignored.js`);
	t.true((stderr?.toString() ?? '').includes('ignored by XO configuration'));
});

test('xo silently skips ignored files with glob patterns', async t => {
	// Create regular and ignored files
	const testFile = path.join(t.context.cwd, 'test.js');
	const ignoredFile = path.join(t.context.cwd, 'ignored.js');

	await fs.writeFile(testFile, dedent`console.log('test');\n`, 'utf8');
	await fs.writeFile(ignoredFile, dedent`console.log('ignored');\n`, 'utf8');

	// Create XO config that ignores one file
	const xoConfigPath = path.join(t.context.cwd, 'xo.config.js');
	const xoConfig = dedent`
		export default [
		    { ignores: ['ignored.js'] }
		]
	`;
	await fs.writeFile(xoConfigPath, xoConfig, 'utf8');

	// Run XO with glob pattern - should succeed and not mention ignored file
	await t.notThrowsAsync($`node ./dist/cli --cwd ${t.context.cwd} "*.js"`);
});

test('xo shows error for multiple directly specified ignored files', async t => {
	// Create multiple ignored files
	const ignored1 = path.join(t.context.cwd, 'ignored1.js');
	const ignored2 = path.join(t.context.cwd, 'ignored2.js');

	await fs.writeFile(ignored1, dedent`console.log('ignored1');\n`, 'utf8');
	await fs.writeFile(ignored2, dedent`console.log('ignored2');\n`, 'utf8');

	// Create XO config that ignores both files
	const xoConfigPath = path.join(t.context.cwd, 'xo.config.js');
	const xoConfig = dedent`
		export default [
		    { ignores: ['ignored*.js'] }
		]
	`;
	await fs.writeFile(xoConfigPath, xoConfig, 'utf8');

	// Run XO on first ignored file - should error on first file
	const {stderr: s1}: ExecaError = await t.throwsAsync($`node ./dist/cli --cwd ${t.context.cwd} ignored1.js ignored2.js`);
	t.true((s1?.toString() ?? '').includes('ignored1.js') && (s1?.toString() ?? '').includes('ignored by XO configuration'));
});

test('xo handles mixed direct files and glob patterns correctly', async t => {
	// Create files
	const testFile = path.join(t.context.cwd, 'test.js');
	const ignoredFile = path.join(t.context.cwd, 'ignored.js');

	await fs.writeFile(testFile, dedent`console.log('test');\n`, 'utf8');
	await fs.writeFile(ignoredFile, dedent`console.log('ignored');\n`, 'utf8');

	// Create XO config that ignores one file
	const xoConfigPath = path.join(t.context.cwd, 'xo.config.js');
	const xoConfig = dedent`
		export default [
		    { ignores: ['ignored.js'] }
		]
	`;
	await fs.writeFile(xoConfigPath, xoConfig, 'utf8');

	// Mix direct ignored file with glob - should error on direct file
	const {stderr: s2}: ExecaError = await t.throwsAsync($`node ./dist/cli --cwd ${t.context.cwd} ignored.js "test.js"`);
	t.true((s2?.toString() ?? '').includes('ignored.js') && (s2?.toString() ?? '').includes('ignored by XO configuration'));
});

test('xo shows error for ignored file with --ignore flag', async t => {
	// Create a file
	const testFile = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(testFile, dedent`console.log('test');\n`, 'utf8');

	// Use CLI --ignore flag to ignore the file, then try to lint it directly
	const {stderr: s3}: ExecaError = await t.throwsAsync($`node ./dist/cli --cwd ${t.context.cwd} --ignore="test.js" test.js`);
	t.true((s3?.toString() ?? '').includes('ignored by XO configuration'));
});
