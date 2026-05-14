
import {realpathSync} from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import _test, {type TestFn} from 'ava'; // eslint-disable-line ava/use-test
import dedent from 'dedent';
import {Xo, ignoredFileWarningMessage, noFilesFoundErrorMessage} from '../../lib/xo.js';
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

test('negated default ignore patterns in config file allow linting default-ignored directories', async t => {
	const distDirectory = path.join(t.context.cwd, 'dist');
	await fs.mkdir(distDirectory, {recursive: true});
	await fs.writeFile(path.join(distDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(t.context.cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/**'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd});
	const {results} = await xo.lintFiles();
	const distResult = results?.find(result => result.filePath.includes('dist/index.js'));
	t.truthy(distResult, 'dist/index.js should be linted');
	t.is(distResult?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated default ignore patterns in config can reopen a narrower built-in directory pattern', async t => {
	const lintedDirectory = path.join(t.context.cwd, 'dist', 'src');
	const ignoredDirectory = path.join(t.context.cwd, 'dist', 'ignored');
	await fs.mkdir(lintedDirectory, {recursive: true});
	await fs.mkdir(ignoredDirectory, {recursive: true});
	await fs.writeFile(path.join(lintedDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(ignoredDirectory, 'index.js'), dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(t.context.cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/src/**'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd});
	const {results} = await xo.lintFiles();
	const lintedResult = results?.find(result => result.filePath.includes('dist/src/index.js'));
	const ignoredResult = results?.find(result => result.filePath.includes('dist/ignored/index.js'));
	t.truthy(lintedResult, 'dist/src/index.js should be linted');
	t.falsy(ignoredResult, 'dist/ignored/index.js should still be ignored');
	t.is(lintedResult?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated default ignore patterns in config keep explicit reopened directory paths lintable', async t => {
	const lintedDirectory = path.join(t.context.cwd, 'dist', 'src');
	await fs.mkdir(lintedDirectory, {recursive: true});
	await fs.writeFile(path.join(lintedDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(t.context.cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/src/**'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd});
	const {results, warningCount} = await xo.lintFiles('dist/src/index.js');
	t.is(results.length, 1);
	t.is(warningCount, 0);
	t.is(results[0]?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated default ignore patterns in config keep explicit reopened file paths lintable', async t => {
	const lintedDirectory = path.join(t.context.cwd, 'dist', 'src');
	const ignoredDirectory = path.join(t.context.cwd, 'dist', 'ignored');
	await fs.mkdir(lintedDirectory, {recursive: true});
	await fs.mkdir(ignoredDirectory, {recursive: true});
	await fs.writeFile(path.join(lintedDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(ignoredDirectory, 'index.js'), dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(t.context.cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/src/index.js'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd});
	const {results, warningCount} = await xo.lintFiles('dist/src/index.js');
	t.is(results.length, 1);
	t.is(warningCount, 0);
	t.is(results[0]?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated default ignore patterns in config keep directory globs lintable', async t => {
	const lintedDirectory = path.join(t.context.cwd, 'dist', 'src');
	const ignoredDirectory = path.join(t.context.cwd, 'dist', 'ignored');
	await fs.mkdir(lintedDirectory, {recursive: true});
	await fs.mkdir(ignoredDirectory, {recursive: true});
	await fs.writeFile(path.join(lintedDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(ignoredDirectory, 'index.js'), dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(t.context.cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/src/**'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd});
	const {results} = await xo.lintFiles('dist');
	const lintedResult = results?.find(result => result.filePath.includes('dist/src/index.js'));
	const ignoredResult = results?.find(result => result.filePath.includes('dist/ignored/index.js'));
	t.truthy(lintedResult, 'dist/src/index.js should be linted');
	t.falsy(ignoredResult, 'dist/ignored/index.js should still be ignored');
	t.is(lintedResult?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated default ignore patterns in config keep sibling reopened directory files ignored for explicit paths', async t => {
	const lintedDirectory = path.join(t.context.cwd, 'dist', 'src');
	const ignoredDirectory = path.join(t.context.cwd, 'dist', 'ignored');
	await fs.mkdir(lintedDirectory, {recursive: true});
	await fs.mkdir(ignoredDirectory, {recursive: true});
	await fs.writeFile(path.join(lintedDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(ignoredDirectory, 'index.js'), dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(t.context.cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/src/**'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd});
	const {results} = await xo.lintFiles('dist/ignored/index.js');
	t.is(results.length, 1);
	t.is(results[0]?.messages[0]?.message, ignoredFileWarningMessage);
});

test('positive CLI ignores still win for explicit paths when config reopens a default-ignored directory', async t => {
	const privateDirectory = path.join(t.context.cwd, 'dist', 'private');
	await fs.mkdir(privateDirectory, {recursive: true});
	await fs.writeFile(path.join(privateDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(t.context.cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/**'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd}, {ignores: ['dist/private/**']});
	const {results} = await xo.lintFiles('dist/private/index.js');
	t.is(results.length, 1);
	t.is(results[0]?.messages[0]?.message, ignoredFileWarningMessage);
});

test('negated default ignore patterns via CLI allow linting default-ignored directories', async t => {
	const distDirectory = path.join(t.context.cwd, 'dist');
	await fs.mkdir(distDirectory, {recursive: true});
	await fs.writeFile(path.join(distDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd}, {ignores: ['!dist/**']});
	const {results} = await xo.lintFiles();
	const distResult = results?.find(result => result.filePath.includes('dist/index.js'));
	t.truthy(distResult, 'dist/index.js should be linted');
	t.is(distResult?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated default ignore patterns via CLI can unignore a narrower built-in directory pattern', async t => {
	const temporaryDirectory = path.join(t.context.cwd, 'tmp');
	await fs.mkdir(temporaryDirectory, {recursive: true});
	await fs.writeFile(path.join(temporaryDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd}, {ignores: ['!tmp/**']});
	const {results} = await xo.lintFiles('tmp/index.js');
	t.is(results.length, 1);
	t.is(results[0]?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated default ignore patterns via CLI can unignore a narrower built-in file pattern', async t => {
	const filePath = path.join(t.context.cwd, 'app.min.js');
	const siblingFilePath = path.join(t.context.cwd, 'vendor.min.js');
	await fs.writeFile(filePath, dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(siblingFilePath, dedent`console.log('hello');\n`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd}, {ignores: ['!app.min.js']});
	const {results} = await xo.lintFiles();
	const lintedResult = results?.find(result => result.filePath.includes('app.min.js'));
	const siblingResult = results?.find(result => result.filePath.includes('vendor.min.js'));
	t.truthy(lintedResult, 'app.min.js should be linted');
	t.falsy(siblingResult, 'vendor.min.js should still be ignored');
	t.is(results.length, 1);
	t.is(lintedResult?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated default ignore patterns in config can unignore a narrower built-in file pattern without linting siblings', async t => {
	const filePath = path.join(t.context.cwd, 'app.min.js');
	const siblingFilePath = path.join(t.context.cwd, 'vendor.min.js');
	await fs.writeFile(filePath, dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(siblingFilePath, dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(t.context.cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!app.min.js'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd});
	const {results} = await xo.lintFiles();
	const lintedResult = results?.find(result => result.filePath.includes('app.min.js'));
	const siblingResult = results?.find(result => result.filePath.includes('vendor.min.js'));
	t.truthy(lintedResult, 'app.min.js should be linted');
	t.falsy(siblingResult, 'vendor.min.js should still be ignored');
	t.is(lintedResult?.messages[0]?.ruleId, '@stylistic/semi');
});

test('positive CLI ignores keep precedence over config negations that reopen default ignores', async t => {
	const privateDirectory = path.join(t.context.cwd, 'dist', 'private');
	const publicDirectory = path.join(t.context.cwd, 'dist', 'public');
	await fs.mkdir(privateDirectory, {recursive: true});
	await fs.mkdir(publicDirectory, {recursive: true});
	await fs.writeFile(path.join(privateDirectory, 'index.js'), dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(publicDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(t.context.cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/**'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd}, {ignores: ['dist/private/**']});
	const {results} = await xo.lintFiles();
	const publicResult = results?.find(result => result.filePath.includes('dist/public/index.js'));
	const privateResult = results?.find(result => result.filePath.includes('dist/private/index.js'));
	t.truthy(publicResult, 'dist/public/index.js should be linted');
	t.falsy(privateResult, 'dist/private/index.js should still be ignored');
	t.is(publicResult?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated default ignore only removes the matching default pattern', async t => {
	const distDirectory = path.join(t.context.cwd, 'dist');
	const coverageDirectory = path.join(t.context.cwd, 'coverage');
	await fs.mkdir(distDirectory, {recursive: true});
	await fs.mkdir(coverageDirectory, {recursive: true});
	await fs.writeFile(path.join(distDirectory, 'index.js'), dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(coverageDirectory, 'report.js'), dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(t.context.cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/**'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd});
	const {results} = await xo.lintFiles();
	const distResult = results?.find(result => result.filePath.includes('dist/index.js'));
	const coverageResult = results?.find(result => result.filePath.includes('coverage/report.js'));
	t.truthy(distResult, 'dist/index.js should be linted');
	t.falsy(coverageResult, 'coverage/report.js should still be ignored');
});

test('three-level nesting: ignore, un-ignore, re-ignore', async t => {
	const lintedDirectory = path.join(t.context.cwd, 'dist', 'src');
	const secretDirectory = path.join(t.context.cwd, 'dist', 'src', 'secret');
	await fs.mkdir(lintedDirectory, {recursive: true});
	await fs.mkdir(secretDirectory, {recursive: true});
	await fs.writeFile(path.join(lintedDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(secretDirectory, 'key.js'), dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(t.context.cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/src/**', 'dist/src/secret/**'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd: t.context.cwd});
	const {results} = await xo.lintFiles();
	const lintedResult = results?.find(result => result.filePath.includes('dist/src/index.js'));
	const secretResult = results?.find(result => result.filePath.includes('dist/src/secret/key.js'));
	t.truthy(lintedResult, 'dist/src/index.js should be linted');
	t.falsy(secretResult, 'dist/src/secret/key.js should still be ignored');
	t.is(lintedResult?.messages[0]?.ruleId, '@stylistic/semi');
});

test('throws for nonexistent explicit file', async t => {
	await t.throwsAsync(
		new Xo({cwd: t.context.cwd}).lintFiles('nonexistent.js'),
		{message: noFilesFoundErrorMessage},
	);
});

test('throws for array of nonexistent explicit files', async t => {
	await t.throwsAsync(
		new Xo({cwd: t.context.cwd}).lintFiles(['nonexistent-a.js', 'nonexistent-b.js']),
		{message: noFilesFoundErrorMessage},
	);
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

test('does not throw for dynamic glob pattern with no matches', async t => {
	await t.notThrowsAsync(new Xo({cwd: t.context.cwd}).lintFiles('nonexistent/**/*.js'));
});

test('does not throw when no globs provided and no files found', async t => {
	await t.notThrowsAsync(new Xo({cwd: t.context.cwd}).lintFiles());
});

test('normalize cwd path casing', async t => {
	const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'xo-cwd-case-'));
	const canonicalDirectory = path.join(temporaryDirectory, 'project');
	const mismatchedCaseDirectory = path.join(temporaryDirectory, 'PrOjEcT');

	try {
		await fs.mkdir(canonicalDirectory);

		const hasMismatchedCaseDirectory = await fs.stat(mismatchedCaseDirectory).then(() => true, () => false);
		const cwd = hasMismatchedCaseDirectory ? mismatchedCaseDirectory : canonicalDirectory;
		const xo = new Xo({cwd});
		t.is(xo._linterOptions.cwd, realpathSync.native(cwd));
	} finally {
		await fs.rm(temporaryDirectory, {recursive: true, force: true});
	}
});

test('suppressions > no suppression file, violations still reported', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, 'console.log(1)\n', 'utf8');

	const {results} = await new Xo({cwd: t.context.cwd}).lintFiles('**/*');
	const lintResult = results?.find(result => result.filePath === filePath);
	t.is(lintResult?.messages.length, 1);
	t.is(lintResult?.messages[0]?.ruleId, '@stylistic/semi');
});

test('suppressions > respects eslint-suppressions.json', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, 'console.log(1)\n', 'utf8');

	const suppressionsPath = path.join(t.context.cwd, 'eslint-suppressions.json');
	await fs.writeFile(suppressionsPath, '{"test.js": {"@stylistic/semi": {"count": 1}}}', 'utf8');

	const {results} = await new Xo({cwd: t.context.cwd}).lintFiles('**/*');
	const lintResult = results?.find(result => result.filePath === filePath);
	t.is(lintResult?.messages.length, 0);
});

test('suppressions > custom suppressionsLocation', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, 'console.log(1)\n', 'utf8');

	const suppressionsPath = path.join(t.context.cwd, 'custom-suppressions.json');
	await fs.writeFile(suppressionsPath, '{"test.js": {"@stylistic/semi": {"count": 1}}}', 'utf8');

	const {results} = await new Xo({cwd: t.context.cwd, suppressionsLocation: suppressionsPath}).lintFiles('**/*');
	const lintResult = results?.find(result => result.filePath === filePath);
	t.is(lintResult?.messages.length, 0);
});

test('suppressions > throws for missing custom suppressionsLocation', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	const suppressionsPath = path.join(t.context.cwd, 'missing-suppressions.json');
	await fs.writeFile(filePath, 'console.log(1)\n', 'utf8');

	const error = await t.throwsAsync(new Xo({cwd: t.context.cwd, suppressionsLocation: suppressionsPath}).lintFiles('**/*'));
	t.is(error?.message, 'The suppressions file does not exist. Please run the command with `--suppress-all` or `--suppress-rule` to create it.');
});

test('suppressions > relative suppressionsLocation path is resolved from cwd', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, 'console.log(1)\n', 'utf8');

	const suppressionsPath = path.join(t.context.cwd, 'eslint-suppressions.json');
	await fs.writeFile(suppressionsPath, '{"test.js": {"@stylistic/semi": {"count": 1}}}', 'utf8');

	const {results} = await new Xo({cwd: t.context.cwd, suppressionsLocation: 'eslint-suppressions.json'}).lintFiles('**/*');
	const lintResult = results?.find(result => result.filePath === filePath);
	t.is(lintResult?.messages.length, 0);
});

test('respects core.excludesfile (global gitignore)', async t => {
	const ignoredFilePath = path.join(t.context.cwd, 'globally-ignored.js');
	const normalFilePath = path.join(t.context.cwd, 'normal.js');
	await fs.writeFile(ignoredFilePath, 'console.log("hello")\n', 'utf8');
	await fs.writeFile(normalFilePath, 'console.log("hello")\n', 'utf8');

	const gitignorePath = path.join(t.context.cwd, '.global-gitignore');
	await fs.writeFile(gitignorePath, 'globally-ignored.js\n', 'utf8');

	const gitConfigPath = path.join(t.context.cwd, '.gitconfig');
	await fs.writeFile(gitConfigPath, `[core]\n\texcludesfile = ${gitignorePath}\n`, 'utf8');

	const previousValue = process.env['GIT_CONFIG_GLOBAL'];
	process.env['GIT_CONFIG_GLOBAL'] = gitConfigPath;

	try {
		const {results} = await new Xo({cwd: t.context.cwd}).lintFiles('**/*.js');
		t.false(results.some(r => r.filePath === ignoredFilePath), 'globally-ignored.js should be excluded from lint results');
		t.true(results.some(r => r.filePath === normalFilePath), 'normal.js should still be linted');
	} finally {
		if (previousValue === undefined) {
			delete process.env['GIT_CONFIG_GLOBAL'];
		} else {
			process.env['GIT_CONFIG_GLOBAL'] = previousValue;
		}
	}
});
