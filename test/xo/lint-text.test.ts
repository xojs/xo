import fs from 'node:fs/promises';
import path from 'node:path';
import _test, {type TestFn} from 'ava'; // eslint-disable-line ava/use-test
import dedent from 'dedent';
import {type TsConfigJson} from 'get-tsconfig';
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
	const {results} = await new Xo({cwd: t.context.cwd}).lintText(
		dedent`console.log('hello')\n`,
		{filePath},
	);
	t.is(results.length, 1);
	t.is(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/semi');
});

test('no config > ts > semi', async t => {
	const filePath = path.join(t.context.cwd, 'test.ts');
	const {results} = await new Xo({cwd: t.context.cwd}).lintText(
		dedent`console.log('hello')\n`,
		{filePath},
	);

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
	const xo = new Xo({cwd: t.context.cwd});
	const {results} = await xo.lintText(dedent`console.log('hello');\n`, {
		filePath,
	});
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
	const xo = new Xo({cwd: t.context.cwd});
	const {results} = await xo.lintText(dedent`console.log('hello');\n`, {
		filePath,
	});
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
	const text = dedent`console.log('hello');\n`;
	// It is required that an actual file exists for ts to apply type-aware linting when no tsconfig includes it
	// If the file does not exist, linting ts will fail, js lint text does not require a file to exist
	await fs.writeFile(filePath, text, 'utf8');
	const {results} = await Xo.lintText(text, {
		cwd: t.context.cwd,
		filePath,
	});
	const generatedTsconfig = JSON.parse(await fs.readFile(path.join(t.context.cwd, 'node_modules', '.cache', 'xo-linter', 'tsconfig.xo.json'), 'utf8')) as TsConfigJson;
	t.true(generatedTsconfig.files?.includes(filePath));
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
	const {results} = await xo.lintText(
		dedent`
			export function foo() {
				console.log('hello');
			}\n
		`,
		{
			filePath,
		},
	);
	t.is(results?.[0]?.messages.length, 1);
	t.is(results?.[0]?.messages?.[0]?.messageId, 'wrongIndentation');
	t.is(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/indent');
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
	const {results} = await xo.lintText(
		dedent`
			export function foo() {
				console.log('hello');
			}\n
		`,
		{
			filePath,
		},
	);
	t.is(results?.[0]?.messages.length, 1);
	t.is(results?.[0]?.messages?.[0]?.messageId, 'wrongIndentation');
	t.is(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/indent');
});

test('plugin > js > no-use-extend-native', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.js');
	const {results} = await new Xo({cwd}).lintText(
		dedent`
			import {util} from 'node:util';

			util.isBoolean('50bda47b09923e045759db8e8dd01a0bacd97370'.shortHash() === '50bdcs47');\n
		`,
		{filePath},
	);
	t.true(results[0]?.messages?.length === 1);
	t.truthy(results[0]?.messages?.[0]);
	t.is(
		results[0]?.messages?.[0]?.ruleId,
		'no-use-extend-native/no-use-extend-native',
	);
});

test('pliugin > ts > no-use-extend-native', async t => {
	const {cwd} = t.context;
	const tsFilePath = path.join(t.context.cwd, 'test.ts');
	const {results} = await new Xo({cwd}).lintText(
		dedent`
			import {util} from 'node:util';

			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			util.isBoolean('50bda47b09923e045759db8e8dd01a0bacd97370'.shortHash() === '50bdcs47');\n
		`,
		{filePath: tsFilePath},
	);
	t.true(results[0]?.messages?.length === 1);
	t.truthy(results[0]?.messages?.[0]);
	t.is(
		results[0]?.messages?.[0]?.ruleId,
		'no-use-extend-native/no-use-extend-native',
	);
});

test('plugin > js > eslint-plugin-import import-x/order', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.js');
	const {results} = await new Xo({cwd}).lintText(
		dedent`
			import foo from 'foo';
			import {util} from 'node:util';

			util.inspect(foo);\n
		`,
		{filePath},
	);

	t.true(results[0]?.messages?.length === 1);
	t.truthy(results[0]?.messages?.[0]);
	t.is(results[0]?.messages?.[0]?.ruleId, 'import-x/order');
});

test('plugin > ts > eslint-plugin-import import-x/order', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.ts');
	const {results} = await new Xo({cwd}).lintText(
		dedent`
			import foo from 'foo';
			import util from 'node:util';

			util.inspect(foo);\n
		`,
		{filePath},
	);
	t.true(results[0]?.messages?.length === 1);
	t.truthy(results[0]?.messages?.[0]);
	t.is(results[0]?.messages?.[0]?.ruleId, 'import-x/order');
});

test('plugin > js > eslint-plugin-import import-x/extensions', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.js');
	const {results} = await new Xo({cwd}).lintText(
		dedent`
			import foo from './foo';

			console.log(foo);\n
		`,
		{filePath},
	);
	t.true(results[0]?.messages?.length === 1);
	t.truthy(results[0]?.messages?.[0]);
	t.is(results[0]?.messages?.[0]?.ruleId, 'import-x/extensions');
});

test('plugin > ts > eslint-plugin-import import-x/extensions', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.ts');
	const {results} = await new Xo({cwd}).lintText(
		dedent`
			import foo from './foo';

			console.log(foo);\n
		`,
		{filePath},
	);
	t.true(results[0]?.messages?.length === 1);
	t.truthy(results[0]?.messages?.[0]);
	t.is(results[0]?.messages?.[0]?.ruleId, 'import-x/extensions');
});

test('plugin > ts > eslint-plugin-import import-x/no-absolute-path', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.ts');
	const {results} = await new Xo({cwd}).lintText(
		dedent`
			import foo from '/foo';

			console.log(foo);\n
		`,
		{filePath},
	);
	t.true(results[0]?.messages?.some(({ruleId}) => ruleId === 'import-x/no-absolute-path'));
});

test('plugin > js > eslint-plugin-import import-x/no-anonymous-default-export', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.js');
	const {results} = await new Xo({cwd}).lintText(
		dedent`
			export default () => {};\n
		`,
		{filePath},
	);

	t.true(results[0]?.messages?.some(({ruleId}) => ruleId === 'import-x/no-anonymous-default-export'));
});

test('plugin > js > eslint-plugin-n n/prefer-global/process', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.js');
	const {results} = await new Xo({cwd}).lintText(
		dedent`
			process.cwd();\n
		`,
		{filePath},
	);
	t.true(results[0]?.messages?.length === 1);
	t.truthy(results[0]?.messages?.[0]);
	t.is(results[0]?.messages?.[0]?.ruleId, 'n/prefer-global/process');
});

test('plugin > ts > eslint-plugin-n n/prefer-global/process', async t => {
	const {cwd} = t.context;
	const tsFilePath = path.join(cwd, 'test.ts');
	const {results} = await new Xo({cwd}).lintText(
		dedent`
			process.cwd();\n
		`,
		{filePath: tsFilePath},
	);
	t.true(results[0]?.messages?.length === 1);
	t.truthy(results[0]?.messages?.[0]);
	t.is(results[0]?.messages?.[0]?.ruleId, 'n/prefer-global/process');
});

test('plugin > js > eslint-plugin-eslint-comments enable-duplicate-disable', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.js');
	const {results} = await new Xo({
		cwd,
	}).lintText(
		dedent`
			/* eslint-disable no-undef */
			export const foo = bar(); // eslint-disable-line no-undef
			\n
		`,
		{filePath},
	);
	t.true(results[0]?.errorCount === 1);
	t.true(results[0]?.messages.some(({ruleId}) =>
		ruleId === '@eslint-community/eslint-comments/no-duplicate-disable'));
});

test('plugin > ts > eslint-plugin-eslint-comments no-duplicate-disable', async t => {
	const {cwd} = t.context;
	const tsFilePath = path.join(cwd, 'test.ts');
	const {results} = await new Xo({
		cwd,
	}).lintText(
		dedent`
			/* eslint-disable no-undef */
			export const foo = 10; // eslint-disable-line no-undef
			\n
		`,
		{filePath: tsFilePath},
	);
	t.true(results[0]?.errorCount === 1);
	t.true(results[0]?.messages.some(({ruleId}) =>
		ruleId === '@eslint-community/eslint-comments/no-duplicate-disable'));
});
