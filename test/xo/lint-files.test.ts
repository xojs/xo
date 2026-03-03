/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import {realpathSync} from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import _test, {type TestFn} from 'ava'; // eslint-disable-line ava/use-test
import dedent from 'dedent';
import {Xo, ignoredFileWarningMessage} from '../../lib/xo.js';
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
	const lintResult = results?.find(result => result.filePath === filePath);
	t.is(lintResult?.messages.length, 1);
	t.is(lintResult?.messages?.[0]?.ruleId, '@stylistic/semi');
});

test('no config > ts > semi', async t => {
	const filePath = path.join(t.context.cwd, 'test.ts');
	await fs.writeFile(filePath, dedent`console.log('hello')\n`, 'utf8');
	const {results} = await new Xo({cwd: t.context.cwd}).lintFiles('**/*');
	const lintResult = results?.find(result => result.filePath === filePath);
	t.is(lintResult?.messages?.length, 1);
	t.is(lintResult?.messages?.[0]?.ruleId, '@stylistic/semi');
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

test('lints dotfiles', async t => {
	await fs.writeFile(path.join(t.context.cwd, '.foo.js'), dedent`console.log('hello')\n`, 'utf8');
	const {results} = await new Xo({cwd: t.context.cwd}).lintFiles();
	t.is(results.length, 1);
	t.is(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/semi');
});

test('lints dotfiles in subdirectories', async t => {
	await fs.mkdir(path.join(t.context.cwd, '.config'), {recursive: true});
	await fs.writeFile(path.join(t.context.cwd, '.config', 'test.js'), dedent`console.log('hello')\n`, 'utf8');
	const {results} = await new Xo({cwd: t.context.cwd}).lintFiles();
	t.is(results.length, 1);
	t.is(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/semi');
});

test('quiet mode suppresses ignored-file warning', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd, quiet: true}, {ignores: ['test.js']});
	const {results, warningCount} = await xo.lintFiles('test.js');
	t.is(results.length, 0);
	t.is(warningCount, 0);
});

test('warns when explicit file is ignored by config', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd}, {ignores: ['test.js']});
	const {results, warningCount} = await xo.lintFiles('test.js');
	t.is(results.length, 1);
	t.is(warningCount, 1);
	t.is(results[0]?.messages[0]?.message, ignoredFileWarningMessage);
});

test('warns when explicit file is ignored by resolved flat config', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(t.context.cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['test.js'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd});
	const {results, warningCount} = await xo.lintFiles('test.js');
	t.is(results.length, 1);
	t.is(warningCount, 1);
	t.is(results[0]?.messages[0]?.message, ignoredFileWarningMessage);
});

test('scoped ignores in config do not remove files from linting', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(t.context.cwd, 'xo.config.js'), dedent`
		export default [
			{
				rules: {
					'no-console': 'off',
				},
				ignores: ['test.js'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd});
	const {results, warningCount} = await xo.lintFiles('test.js');
	t.is(results.length, 1);
	t.is(warningCount, 0);
	t.is(results[0]?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated global ignore patterns keep explicitly unignored files linted', async t => {
	const filePath = path.join(t.context.cwd, 'keep.js');
	await fs.writeFile(filePath, dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(t.context.cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['*.js', '!keep.js'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd});
	const {results, warningCount} = await xo.lintFiles('keep.js');
	t.is(results.length, 1);
	t.is(warningCount, 0);
	t.is(results[0]?.messages[0]?.ruleId, '@stylistic/semi');
});

test('no warning for nonexistent explicit file', async t => {
	const xo = new Xo({cwd: t.context.cwd});
	const {results} = await xo.lintFiles('nonexistent.js');
	t.is(results.length, 0);
});

test('no warning for glob pattern when all files are ignored', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd}, {ignores: ['test.js']});
	const {results} = await xo.lintFiles('*.js');
	t.is(results.length, 0);
});

test('mixed explicit files: some ignored, some not', async t => {
	const fileA = path.join(t.context.cwd, 'a.js');
	const fileB = path.join(t.context.cwd, 'b.js');
	await fs.writeFile(fileA, dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(fileB, dedent`console.log('hello');\n`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd}, {ignores: ['b.js']});
	const {results} = await xo.lintFiles(['a.js', 'b.js']);
	t.is(results.length, 2);
	const linted = results.find(r => r.filePath === fileA);
	const ignored = results.find(r => r.filePath === fileB);
	t.truthy(linted);
	t.is(linted!.messages.length, 0);
	t.truthy(ignored);
	t.is(ignored!.messages[0]?.message, ignoredFileWarningMessage);
});

test('normalize cwd path casing', async t => {
	const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'xo-cwd-case-'));
	const canonicalDirectory = path.join(temporaryDirectory, 'project');
	const mismatchedCaseDirectory = path.join(temporaryDirectory, 'PrOjEcT');

	try {
		await fs.mkdir(canonicalDirectory);

		const mismatchedCaseDirectoryExists = await fs.stat(mismatchedCaseDirectory).then(() => true, () => false);
		const cwd = mismatchedCaseDirectoryExists ? mismatchedCaseDirectory : canonicalDirectory;
		const xo = new Xo({cwd});
		t.is(xo.linterOptions.cwd, realpathSync.native(cwd));
	} finally {
		await fs.rm(temporaryDirectory, {recursive: true, force: true});
	}
});
