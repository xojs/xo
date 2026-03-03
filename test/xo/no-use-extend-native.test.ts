/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import fs from 'node:fs/promises';
import path from 'node:path';
import _test, {type TestFn} from 'ava'; // eslint-disable-line ava/use-test
import dedent from 'dedent';
import {Xo} from '../../lib/xo.js';
import {copyTestProject} from '../helpers/copy-test-project.js';

const test = _test as TestFn<{cwd: string}>;

const getRuleMessages = async (cwd: string, filePath: string, text: string) => {
	if (filePath.endsWith('.ts')) {
		await fs.writeFile(filePath, text, 'utf8');
	}

	const {results} = await new Xo({cwd}).lintText(text, {filePath});
	return results[0]?.messages?.filter(message => message.ruleId === 'no-use-extend-native/no-use-extend-native') ?? [];
};

test.beforeEach(async t => {
	t.context.cwd = await copyTestProject();
});

test.afterEach.always(async t => {
	await fs.rm(t.context.cwd, {recursive: true, force: true});
});

test('js > custom instance method', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		cwd,
		filePath,
		dedent`
			'50bda47b09923e045759db8e8dd01a0bacd97370'.shortHash();\n
		`,
	);

	t.is(messages.length, 1);
});

test('ts > custom instance method', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.ts');
	const messages = await getRuleMessages(
		cwd,
		filePath,
		dedent`
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			'50bda47b09923e045759db8e8dd01a0bacd97370'.shortHash();\n
		`,
	);

	t.is(messages.length, 1);
});

test('js > built-in method allowed', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		cwd,
		filePath,
		dedent`
			'50bda47b09923e045759db8e8dd01a0bacd97370'.trim();\n
		`,
	);

	t.is(messages.length, 0);
});

test('js > built-in static method allowed', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		cwd,
		filePath,
		dedent`
			Array.isArray([]);\n
		`,
	);

	t.is(messages.length, 0);
});

test('js > custom static method', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		cwd,
		filePath,
		dedent`
			Array.shortHash([]);\n
		`,
	);

	t.is(messages.length, 1);
});

test('js > custom prototype property', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		cwd,
		filePath,
		dedent`
			String.prototype.shortHash;\n
		`,
	);

	t.is(messages.length, 1);
});

test('js > getter called as function', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		cwd,
		filePath,
		dedent`
			'50bda47b09923e045759db8e8dd01a0bacd97370'.length();\n
		`,
	);

	t.is(messages.length, 1);
});

test('js > computed string literal property', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		cwd,
		filePath,
		dedent`
			'50bda47b09923e045759db8e8dd01a0bacd97370'['shortHash']();\n
		`,
	);

	t.is(messages.length, 1);
});

test('js > computed identifier property ignored', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		cwd,
		filePath,
		dedent`
			const propertyName = 'shortHash';
			'50bda47b09923e045759db8e8dd01a0bacd97370'[propertyName]();\n
		`,
	);

	t.is(messages.length, 0);
});

test('js > binary expression string result', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		cwd,
		filePath,
		dedent`
			('50bd' + 'a47b').shortHash();\n
		`,
	);

	t.is(messages.length, 1);
});

test('js > object literal custom property', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		cwd,
		filePath,
		dedent`
			({}).shortHash;\n
		`,
	);

	t.is(messages.length, 1);
});
