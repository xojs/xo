/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import fs from 'node:fs/promises';
import path from 'node:path';
import _test, {type TestFn} from 'ava'; // eslint-disable-line ava/use-test
import dedent from 'dedent';
import {pathExists} from 'path-exists';
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
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.ts');
	const text = dedent`console.log('hello')\n`;
	await fs.writeFile(filePath, text, 'utf8');
	const {results} = await new Xo({cwd}).lintText(text, {filePath});

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
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.ts');
	await fs.writeFile(
		path.join(cwd, 'xo.config.js'),
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
	await fs.writeFile(filePath, text, 'utf8');
	const xo = new Xo({cwd});
	const {results} = await xo.lintText(text, {filePath});
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
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.ts');

	await fs.writeFile(
		path.join(cwd, 'xo.config.js'),
		dedent`
			export default [
			  {
			    space: true
			  }
			];\n
		`,
		'utf8',
	);

	const text = dedent`
		export function foo() {
		    console.log('hello');
		}\n
	`;
	await fs.writeFile(filePath, text, 'utf8');

	const xo = new Xo({cwd});
	const {results} = await xo.lintText(text, {filePath});
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

test('plugin > ts > no-use-extend-native', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.ts');
	const text = dedent`
		import {util} from 'node:util';

		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		util.isBoolean('50bda47b09923e045759db8e8dd01a0bacd97370'.shortHash() === '50bdcs47');\n
	`;
	await fs.writeFile(filePath, text, 'utf8');
	const {results} = await new Xo({cwd}).lintText(text, {filePath});
	t.true(Array.isArray(results[0]?.messages));
	t.truthy(results[0]?.messages?.find(rule => rule.ruleId === 'no-use-extend-native/no-use-extend-native'));
});

test('plugin > js > eslint-plugin-import import-x/order', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.js');
	const {results} = await (new Xo({cwd}).lintText(
		dedent`
			import foo from 'foo';
			import {util} from 'node:util';

			util.inspect(foo);\n
		`,
		{filePath},
	));

	t.true(results[0]?.messages?.length === 1);
	t.truthy(results[0]?.messages?.[0]);
	t.is(results[0]?.messages?.[0]?.ruleId, 'import-x/order');
});

test('plugin > ts > eslint-plugin-import import-x/order', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.ts');
	const text = dedent`
		import foo from 'foo';
		import util from 'node:util';

		util.inspect(foo);\n
	`;
	await fs.writeFile(filePath, text, 'utf8');
	const {results} = await new Xo({cwd}).lintText(text, {filePath});
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
	const text = dedent`
		import foo from './foo';

		console.log(foo);\n
	`;
	await fs.writeFile(filePath, text, 'utf8');
	const {results} = await new Xo({cwd}).lintText(text, {filePath});
	t.true(results[0]?.messages?.length === 1);
	t.truthy(results[0]?.messages?.[0]);
	t.is(results[0]?.messages?.[0]?.ruleId, 'import-x/extensions');
});

test('plugin > ts > eslint-plugin-import import-x/no-absolute-path', async t => {
	const {cwd} = t.context;
	const filePath = path.join(cwd, 'test.ts');
	const text = dedent`
		import foo from '/foo';

		console.log(foo);\n
	`;
	await fs.writeFile(filePath, text, 'utf8');
	const {results} = await new Xo({cwd}).lintText(text, {filePath});
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
	const filePath = path.join(cwd, 'test.ts');
	const text = dedent`
		process.cwd();\n
	`;
	await fs.writeFile(filePath, text, 'utf8');
	const {results} = await new Xo({cwd}).lintText(text, {filePath});
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
	const text = dedent`
		/* eslint-disable no-undef */
		export const foo = 10; // eslint-disable-line no-undef
		\n
	`;
	await fs.writeFile(tsFilePath, text, 'utf8');
	const {results} = await new Xo({cwd}).lintText(text, {filePath: tsFilePath});
	t.true(results[0]?.errorCount === 1);
	t.true(results[0]?.messages.some(({ruleId}) =>
		ruleId === '@eslint-community/eslint-comments/no-duplicate-disable'));
});

test('lint-text can be ran multiple times in a row with top level typescript rules', async t => {
	const {cwd} = t.context;

	const filePath = path.join(cwd, 'test.ts');
	// Text should violate the @typescript-eslint/naming-convention rule
	const text = dedent`
		const fooBar = 10;
		const FooBar = 10;
		const FOO_BAR = 10;
		const foo_bar = 10;\n
	`;

	// We must write tsfiles to disk for the typescript rules to apply
	await fs.writeFile(filePath, text, 'utf8');

	const {results: resultsNoConfig} = await Xo.lintText(text, {cwd, filePath});
	// Ensure that with no config, the text is linted and errors are found
	t.true(resultsNoConfig[0]?.errorCount === 3);

	await fs.writeFile(
		path.join(cwd, 'xo.config.ts'),
		dedent`
			export default [
			  {
					rules: {
						'@typescript-eslint/naming-convention': 'off',
						'@typescript-eslint/no-unused-vars': 'off'
					},
			  }
			];\n
		`,
		'utf8',
	);

	// Now with a config that turns off the naming-convention rule, the text should not have any errors
	// and should not have any messages when ran multiple times
	const {results} = await Xo.lintText(text, {cwd, filePath});
	t.is(results[0]?.errorCount, 0);
	t.true(results[0]?.messages?.length === 0);
	const {results: results2} = await Xo.lintText(text, {cwd, filePath});
	t.is(results2[0]?.errorCount, 0);
	t.true(results2[0]?.messages?.length === 0);
	const {results: results3} = await Xo.lintText(text, {cwd, filePath});
	t.is(results3[0]?.errorCount, 0);
	t.true(results3[0]?.messages?.length === 0);
});

test('virtual TypeScript configs are pruned when no virtual files remain', async t => {
	const {cwd} = t.context;
	const xo = new Xo({cwd, ts: true});
	const {cacheLocation} = xo;
	const tsconfigPath = path.join(cacheLocation, 'tsconfig.stdin.json');
	const virtualFilePath = path.join(cacheLocation, 'stdin', 'virtual.ts');

	await fs.mkdir(path.dirname(virtualFilePath), {recursive: true});
	await fs.writeFile(virtualFilePath, 'export const virtualValue = 1;\n', 'utf8');

	await xo.lintText('export const virtualValue = 1;\n', {filePath: virtualFilePath});

	t.true(await pathExists(tsconfigPath));
	const virtualConfig = xo.xoConfig?.find(({languageOptions}) => {
		const parserOptions = (languageOptions?.['parserOptions'] ?? {}) as {project?: string};
		return parserOptions?.project === tsconfigPath;
	});
	t.deepEqual(virtualConfig?.files, [path.relative(cwd, virtualFilePath)]);

	const existingFilePath = path.join(cwd, 'src', 'existing.ts');
	await fs.mkdir(path.dirname(existingFilePath), {recursive: true});
	await fs.writeFile(existingFilePath, 'export const existingValue = 1;\n', 'utf8');

	await xo.lintText('export const existingValue = 1;\n', {filePath: existingFilePath});

	t.false(await pathExists(tsconfigPath));
	const configAfterCleanup = xo.xoConfig?.find(({languageOptions}) => {
		const parserOptions = (languageOptions?.['parserOptions'] ?? {}) as {project?: string};
		return parserOptions?.project === tsconfigPath;
	});
	t.is(configAfterCleanup, undefined);
});

test('config with custom plugin', async t => {
	const {cwd} = t.context;

	await fs.writeFile(
		path.join(cwd, 'xo.config.js'),
		dedent`
			const testRule = {
				create(context) {
					return {
						Program(node) {
							context.report({
								node,
								message: 'Custom error',
							});
						},
					};
				},
			};

			export default [
				{
					plugins: {
						'test-plugin': {
							rules: {
								'test-rule': testRule,
							},
						},
					},
					rules: {
						'test-plugin/test-rule': 'error',
					},
				},
			];\n
		`,
		'utf8',
	);

	const {results} = await Xo.lintText(dedent`console.log('hello');\n`, {
		cwd,
		filePath: path.join(cwd, 'test.js'),
	});

	t.is(results[0]?.messages?.length, 1);
	t.is(results[0]?.messages[0]?.ruleId, 'test-plugin/test-rule');
	t.is(results[0]?.messages[0]?.message, 'Custom error');
});
