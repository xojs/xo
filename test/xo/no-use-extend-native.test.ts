
import fs from 'node:fs/promises';
import path from 'node:path';
import test, {beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import dedent from 'dedent';
import {Xo} from '../../lib/xo.js';
import {copyTestProject} from '../helpers/copy-test-project.js';

let cwd: string;

const getRuleMessages = async (filePath: string, text: string) => {
	if (filePath.endsWith('.ts')) {
		await fs.writeFile(filePath, text, 'utf8');
	}

	const {results} = await new Xo({cwd}).lintText(text, {filePath});
	return results[0]?.messages?.filter(message => message.ruleId === 'no-use-extend-native/no-use-extend-native') ?? [];
};

beforeEach(async () => {
	cwd = await copyTestProject();
});

afterEach(async () => {
	await fs.rm(cwd, {recursive: true, force: true});
});

test('js > custom instance method', async () => {
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		filePath,
		dedent`
			'50bda47b09923e045759db8e8dd01a0bacd97370'.shortHash();\n
		`,
	);

	assert.equal(messages.length, 1);
});

test('ts > custom instance method', async () => {
	const filePath = path.join(cwd, 'test.ts');
	const messages = await getRuleMessages(
		filePath,
		dedent`
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			'50bda47b09923e045759db8e8dd01a0bacd97370'.shortHash();\n
		`,
	);

	assert.equal(messages.length, 1);
});

test('js > built-in method allowed', async () => {
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		filePath,
		dedent`
			'50bda47b09923e045759db8e8dd01a0bacd97370'.trim();\n
		`,
	);

	assert.equal(messages.length, 0);
});

test('js > built-in static method allowed', async () => {
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		filePath,
		dedent`
			Array.isArray([]);\n
		`,
	);

	assert.equal(messages.length, 0);
});

test('js > custom static method', async () => {
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		filePath,
		dedent`
			Array.shortHash([]);\n
		`,
	);

	assert.equal(messages.length, 1);
});

test('js > custom prototype property', async () => {
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		filePath,
		dedent`
			String.prototype.shortHash;\n
		`,
	);

	assert.equal(messages.length, 1);
});

test('js > getter called as function', async () => {
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		filePath,
		dedent`
			'50bda47b09923e045759db8e8dd01a0bacd97370'.length();\n
		`,
	);

	assert.equal(messages.length, 1);
});

test('js > computed string literal property', async () => {
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		filePath,
		dedent`
			'50bda47b09923e045759db8e8dd01a0bacd97370'['shortHash']();\n
		`,
	);

	assert.equal(messages.length, 1);
});

test('js > computed identifier property ignored', async () => {
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		filePath,
		dedent`
			const propertyName = 'shortHash';
			'50bda47b09923e045759db8e8dd01a0bacd97370'[propertyName]();\n
		`,
	);

	assert.equal(messages.length, 0);
});

test('js > binary expression string result', async () => {
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		filePath,
		dedent`
			('50bd' + 'a47b').shortHash();\n
		`,
	);

	assert.equal(messages.length, 1);
});

test('js > object literal custom property', async () => {
	const filePath = path.join(cwd, 'test.js');
	const messages = await getRuleMessages(
		filePath,
		dedent`
			({}).shortHash;\n
		`,
	);

	assert.equal(messages.length, 1);
});
