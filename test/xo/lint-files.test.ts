/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import fs from 'node:fs/promises';
import path from 'node:path';
import _test, {type TestFn} from 'ava'; // eslint-disable-line ava/use-test
import dedent from 'dedent';
import {Xo} from '../../lib/xo.js';
import {copyTestProject} from '../helpers/copy-test-project.js';

const test = _test as TestFn<{cwd: string}>;

test.beforeEach(async t => {
	t.context.cwd = await copyTestProject();
});

test.afterEach.always(async t => {
	await fs.rm(t.context.cwd, {recursive: true, force: true});
});

test('no config > js > semi', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello')\n`, 'utf8');
	const {results} = await new Xo({cwd: t.context.cwd}).lintFiles('**/*');
	t.is(results?.[0]?.messages.length, 1);
	t.is(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/semi');
});

test('no config > ts > semi', async t => {
	const filePath = path.join(t.context.cwd, 'test.ts');
	await fs.writeFile(filePath, dedent`console.log('hello')\n`, 'utf8');
	const {results} = await new Xo({cwd: t.context.cwd}).lintFiles('**/*');
	t.is(results?.[0]?.messages?.length, 1);
	t.is(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/semi');
});

test('flat config > js > semi', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(
		path.join(t.context.cwd, 'xo.config.js'),
		dedent`
			export default [
			  {
			    semicolon: false
			  }
			]\n
		`,
		'utf8',
	);
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd});
	const {results} = await xo.lintFiles();
	t.is(results?.[0]?.messages?.length, 1);
	t.is(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/semi');
});

test('flat config > ts > semi', async t => {
	const filePath = path.join(t.context.cwd, 'test.ts');
	await fs.writeFile(
		path.join(t.context.cwd, 'xo.config.js'),
		dedent`
			export default [
			  {
			    semicolon: false
			  }
			];\n
		`,
		'utf8',
	);
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd});
	const {results} = await xo.lintFiles();
	t.is(results?.[0]?.messages?.length, 1);
	t.is(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/semi');
});

test('flat config > ts > semi > no tsconfig', async t => {
	const filePath = path.join(t.context.cwd, 'test.ts');
	await fs.rm(path.join(t.context.cwd, 'tsconfig.json'));
	await fs.writeFile(
		path.join(t.context.cwd, 'xo.config.js'),
		dedent`
			export default [
			  {
			    semicolon: false
			  }
			];\n
		`,
		'utf8',
	);
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd, ts: true});
	const {results} = await xo.lintFiles();
	t.is(results?.[0]?.messages?.length, 1);
	t.is(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/semi');
});

test('flat config > js > space', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');

	await fs.writeFile(
		path.join(t.context.cwd, 'xo.config.js'),
		dedent`
			export default [
			  {
			    space: true
			  }
			];\n
		`,
		'utf8',
	);

	const xo = new Xo({cwd: t.context.cwd});
	await fs.writeFile(
		filePath,

		dedent`
			export function foo() {
				console.log('hello');
			}

			console.log('hello'
				+ 'world');\n
		`,
	);
	const {results} = await xo.lintFiles();
	t.is(results?.[0]?.messages.length, 2);
	t.is(results?.[0]?.messages?.[0]?.messageId, 'wrongIndentation');
	t.is(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/indent');
	t.is(results?.[0]?.messages?.[1]?.messageId, 'wrongIndentation');
	t.is(results?.[0]?.messages?.[1]?.ruleId, '@stylistic/indent-binary-ops');
});

test('flat config > ts > space', async t => {
	const filePath = path.join(t.context.cwd, 'test.ts');

	await fs.writeFile(
		path.join(t.context.cwd, 'xo.config.js'),
		dedent`
			export default [
			  {
			    space: true
			  }
			];\n
		`,
		'utf8',
	);

	const xo = new Xo({cwd: t.context.cwd});
	await fs.writeFile(
		filePath,
		dedent`
			export function foo() {
				console.log('hello');
			}

			console.log('hello'
				+ 'world');\n
		`,
	);
	const {results} = await xo.lintFiles();
	t.is(results?.[0]?.messages.length, 2);
	t.is(results?.[0]?.messages?.[0]?.messageId, 'wrongIndentation');
	t.is(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/indent');
	t.is(results?.[0]?.messages?.[1]?.messageId, 'wrongIndentation');
	t.is(results?.[0]?.messages?.[1]?.ruleId, '@stylistic/indent-binary-ops');
});
