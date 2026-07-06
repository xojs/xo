
import {realpathSync} from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import test, {beforeEach, afterEach, type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import dedent from 'dedent';
import {Xo, ignoredFileWarningMessage, noFilesFoundErrorMessage} from '../../lib/xo.js';
import {copyTestProject} from '../helpers/copy-test-project.js';
import {rejectionOf} from '../helpers/rejection-of.js';

/**
Temporarily sets an environment variable for the duration of a test, restoring its previous value afterwards.
*/
const withEnvironmentVariable = (t: TestContext, name: string, value: string): void => {
	const previousValue = process.env[name];
	process.env[name] = value;
	t.after(() => {
		if (previousValue === undefined) {
			Reflect.deleteProperty(process.env, name);
		} else {
			process.env[name] = previousValue;
		}
	});
};

let cwd: string;

beforeEach(async () => {
	cwd = await copyTestProject();
});

afterEach(async () => {
	await fs.rm(cwd, {recursive: true, force: true});
});

test('no config > js > semi', async () => {
	const filePath = path.join(cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello')\n`, 'utf8');
	const {results} = await new Xo({cwd}).lintFiles('**/*');
	const lintResult = results?.find(result => result.filePath === filePath);
	assert.equal(lintResult?.messages.length, 1);
	assert.equal(lintResult?.messages?.[0]?.ruleId, '@stylistic/semi');
});

test('no config > ts > semi', async () => {
	const filePath = path.join(cwd, 'test.ts');
	await fs.writeFile(filePath, dedent`console.log('hello')\n`, 'utf8');
	const {results} = await new Xo({cwd}).lintFiles('**/*');
	const lintResult = results?.find(result => result.filePath === filePath);
	assert.equal(lintResult?.messages?.length, 1);
	assert.equal(lintResult?.messages?.[0]?.ruleId, '@stylistic/semi');
});

test('flat config > js > semi', async () => {
	const filePath = path.join(cwd, 'test.js');
	await fs.writeFile(
		path.join(cwd, 'xo.config.js'),
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
	const xo = new Xo({cwd});
	const {results} = await xo.lintFiles();
	assert.equal(results?.[0]?.messages?.length, 1);
	assert.equal(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/semi');
});

test('flat config > ts > semi', async () => {
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
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	const xo = new Xo({cwd});
	const {results} = await xo.lintFiles();
	assert.equal(results?.[0]?.messages?.length, 1);
	assert.equal(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/semi');
});

test('flat config > ts > semi > no tsconfig', async () => {
	const filePath = path.join(cwd, 'test.ts');
	await fs.rm(path.join(cwd, 'tsconfig.json'));
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
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	const xo = new Xo({cwd, ts: true});
	const {results} = await xo.lintFiles();
	assert.equal(results?.[0]?.messages?.length, 1);
	assert.equal(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/semi');
});

test('flat config > ts > resolves types for files outside the tsconfig', async () => {
	// A file not matched by the tsconfig `include` is type-checked through a generated tsconfig. It must still load `@types/*`, otherwise imports resolve to `any` and type-aware rules misfire. See https://github.com/xojs/xo/issues/886
	await fs.writeFile(
		path.join(cwd, 'tsconfig.json'),
		JSON.stringify({include: ['source/**/*.ts']}),
		'utf8',
	);
	await fs.mkdir(path.join(cwd, 'source'));
	await fs.writeFile(path.join(cwd, 'source', 'index.ts'), dedent`export const x = 1;\n`, 'utf8');
	const filePath = path.join(cwd, 'test', 'index.ts');
	await fs.mkdir(path.join(cwd, 'test'));
	await fs.writeFile(filePath, dedent`
		import test from 'node:test';

		test('foo', () => {});
	`, 'utf8');
	const xo = new Xo({cwd, ts: true});
	const {results} = await xo.lintFiles();
	const lintResult = results?.find(result => result.filePath === filePath);
	assert.ok(lintResult, 'test/index.ts should be linted');
	const unsafeCall = lintResult.messages.find(message => message.ruleId === '@typescript-eslint/no-unsafe-call');
	assert.equal(unsafeCall, undefined, '`node:test` should resolve to a callable type, not `any`');
});

test('flat config > ts > resolves json imports for files outside the tsconfig', async () => {
	await fs.writeFile(
		path.join(cwd, 'tsconfig.json'),
		JSON.stringify({include: ['source/**/*.ts']}),
		'utf8',
	);
	await fs.mkdir(path.join(cwd, 'source'));
	await fs.writeFile(path.join(cwd, 'source', 'index.ts'), dedent`export const x = 1;\n`, 'utf8');
	const filePath = path.join(cwd, 'test', 'index.ts');
	await fs.mkdir(path.join(cwd, 'test'));
	await fs.writeFile(path.join(cwd, 'test', 'data.json'), JSON.stringify({count: 1}), 'utf8');
	await fs.writeFile(filePath, dedent`
		import data from './data.json';

		const count: number = data.count;
		count.toFixed(1);
	`, 'utf8');
	const xo = new Xo({cwd, ts: true});
	const {results} = await xo.lintFiles();
	const lintResult = results?.find(result => result.filePath === filePath);
	assert.ok(lintResult, 'test/index.ts should be linted');
	const ruleIds = new Set(lintResult.messages.map(({ruleId}) => ruleId));
	assert.ok(!ruleIds.has('@typescript-eslint/no-unsafe-assignment'));
	assert.ok(!ruleIds.has('@typescript-eslint/no-unsafe-member-access'));
});

test('flat config > ts > resolves cwd ambient types for files outside the tsconfig without package json', async () => {
	await fs.rm(path.join(cwd, 'package.json'), {force: true});
	await fs.writeFile(
		path.join(cwd, 'tsconfig.json'),
		JSON.stringify({include: ['source/**/*.ts']}),
		'utf8',
	);
	await fs.mkdir(path.join(cwd, 'source'));
	await fs.writeFile(path.join(cwd, 'source', 'index.ts'), dedent`export const x = 1;\n`, 'utf8');
	await fs.mkdir(path.join(cwd, 'node_modules', '@types', 'cwd-globals'), {recursive: true});
	await fs.writeFile(
		path.join(cwd, 'node_modules', '@types', 'cwd-globals', 'index.d.ts'),
		dedent`
			declare const cwdGlobal: {
				count: number;
			};
		`,
		'utf8',
	);
	const filePath = path.join(cwd, 'test', 'index.ts');
	await fs.mkdir(path.join(cwd, 'test'));
	await fs.writeFile(filePath, dedent`
		const count: number = cwdGlobal.count;
		count.toFixed(1);
	`, 'utf8');
	const xo = new Xo({cwd, ts: true});
	const {results} = await xo.lintFiles();
	const lintResult = results?.find(result => result.filePath === filePath);
	assert.ok(lintResult, 'test/index.ts should be linted');
	const ruleIds = new Set(lintResult.messages.map(({ruleId}) => ruleId));
	assert.ok(!ruleIds.has('@typescript-eslint/no-unsafe-assignment'));
	assert.ok(!ruleIds.has('@typescript-eslint/no-unsafe-member-access'));
});

test('flat config > ts > fix does not mangle files outside the tsconfig', async () => {
	// `--fix` runs multiple passes. A file outside the tsconfig `include` must be re-parsed against its current text on every pass, otherwise fixes computed against the previous pass's stale offsets corrupt the file. Two byte-identical files, one inside `include` and one outside, must therefore produce identical fixed output. See https://github.com/xojs/xo/issues/887
	await fs.writeFile(
		path.join(cwd, 'tsconfig.json'),
		JSON.stringify({include: ['source/**/*']}),
		'utf8',
	);
	// The redundant type assertions are removed by a type-aware rule across several fix passes, which is what triggers the stale-offset corruption.
	const fileContent = dedent`
		const first: number = 1;
		const second = first as number;
		const third = second as number;
		export {third};
	`
		+ '\n';
	await fs.mkdir(path.join(cwd, 'source'));
	await fs.mkdir(path.join(cwd, 'test'));
	const includedFilePath = path.join(cwd, 'source', 'index.ts');
	const unincludedFilePath = path.join(cwd, 'test', 'index.ts');
	await fs.writeFile(includedFilePath, fileContent, 'utf8');
	await fs.writeFile(unincludedFilePath, fileContent, 'utf8');
	const xo = new Xo({cwd, ts: true, fix: true});
	const {results} = await xo.lintFiles();
	const includedResult = results?.find(result => result.filePath === includedFilePath);
	const unincludedResult = results?.find(result => result.filePath === unincludedFilePath);
	assert.ok(includedResult, 'source/index.ts should be linted');
	assert.ok(unincludedResult, 'test/index.ts should be linted');
	// The included file always uses the project tsconfig and is fixed correctly, so it is the oracle for the expected output.
	assert.notStrictEqual(includedResult.output, undefined, 'the included file should have been fixed');
	assert.notStrictEqual(includedResult.output, fileContent, 'the included file should have been fixed');
	assert.equal(unincludedResult.output, includedResult.output, 'the file outside the tsconfig must be fixed identically, not mangled');
});

test('flat config > ts > fix works for multiple files outside the tsconfig', async () => {
	// All unincluded files share a single generated tsconfig that must list every one of them, so a run with several unincluded files must type-aware fix each independently. See https://github.com/xojs/xo/issues/887
	await fs.writeFile(
		path.join(cwd, 'tsconfig.json'),
		JSON.stringify({include: ['source/**/*']}),
		'utf8',
	);
	const fileContent = dedent`
		const first: number = 1;
		const second = first as number;
		export {second};
	`
		+ '\n';
	await fs.mkdir(path.join(cwd, 'source'));
	await fs.mkdir(path.join(cwd, 'test'));
	const includedFilePath = path.join(cwd, 'source', 'index.ts');
	const unincludedFilePaths = [
		path.join(cwd, 'test', 'one.ts'),
		path.join(cwd, 'test', 'two.ts'),
	];
	await fs.writeFile(includedFilePath, fileContent, 'utf8');
	for (const filePath of unincludedFilePaths) {
		// eslint-disable-next-line no-await-in-loop
		await fs.writeFile(filePath, fileContent, 'utf8');
	}

	const xo = new Xo({cwd, ts: true, fix: true});
	const {results} = await xo.lintFiles();
	const includedResult = results?.find(result => result.filePath === includedFilePath);
	assert.ok(includedResult, 'source/index.ts should be linted');
	assert.notStrictEqual(includedResult.output, undefined, 'the included file should have been fixed');
	assert.notStrictEqual(includedResult.output, fileContent, 'the included file should have been fixed');

	const unincludedResults = unincludedFilePaths.map(filePath => results?.find(result => result.filePath === filePath));
	assert.ok(unincludedResults.every(result => result !== undefined), 'every file outside the tsconfig should be linted');
	assert.deepEqual(unincludedResults.map(result => result?.output), unincludedFilePaths.map(() => includedResult.output), 'each file outside the tsconfig must be fixed identically, not mangled');
});

test('flat config > ts > reused instance works with changing unincluded file sets', async () => {
	await fs.writeFile(
		path.join(cwd, 'tsconfig.json'),
		JSON.stringify({include: ['source/**/*']}),
		'utf8',
	);
	await fs.mkdir(path.join(cwd, 'excluded'));
	const firstFilePath = path.join(cwd, 'excluded', 'first.ts');
	const secondFilePath = path.join(cwd, 'excluded', 'second.ts');
	await fs.writeFile(firstFilePath, 'export const firstValue = 1\n', 'utf8');
	await fs.writeFile(secondFilePath, 'export const secondValue = 2\n', 'utf8');
	const xo = new Xo({cwd, ts: true});

	const {results: firstResults} = await xo.lintFiles('excluded/first.ts');
	const {results} = await xo.lintFiles('excluded/second.ts');
	const firstRuleIds = new Set(firstResults?.[0]?.messages.map(({ruleId}) => ruleId));
	const secondRuleIds = new Set(results?.[0]?.messages.map(({ruleId}) => ruleId));

	assert.equal(results?.[0]?.fatalErrorCount, 0);
	assert.ok(firstRuleIds.has('@stylistic/semi'));
	assert.ok(secondRuleIds.has('@stylistic/semi'));
});

test('flat config > js > space', async () => {
	const filePath = path.join(cwd, 'test.js');

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

	const xo = new Xo({cwd});
	await fs.writeFile(
		filePath,

		dedent`
			export function foo() {
				return 'hello'
					+ 'world';
			}\n
		`,
	);
	const {results} = await xo.lintFiles();
	assert.equal(results?.[0]?.messages.length, 2);
	assert.equal(results?.[0]?.messages?.[0]?.messageId, 'wrongIndentation');
	assert.equal(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/indent');
	assert.equal(results?.[0]?.messages?.[1]?.messageId, 'wrongIndentation');
	assert.equal(results?.[0]?.messages?.[1]?.ruleId, '@stylistic/indent-binary-ops');
});

test('flat config > ts > space', async () => {
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

	const xo = new Xo({cwd});
	await fs.writeFile(
		filePath,
		dedent`
			export function foo() {
				return 'hello'
					+ 'world';
			}\n
		`,
	);
	const {results} = await xo.lintFiles();
	assert.equal(results?.[0]?.messages.length, 2);
	assert.equal(results?.[0]?.messages?.[0]?.messageId, 'wrongIndentation');
	assert.equal(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/indent');
	assert.equal(results?.[0]?.messages?.[1]?.messageId, 'wrongIndentation');
	assert.equal(results?.[0]?.messages?.[1]?.ruleId, '@stylistic/indent-binary-ops');
});

test('lints dotfiles', async () => {
	await fs.writeFile(path.join(cwd, '.foo.js'), dedent`console.log('hello')\n`, 'utf8');
	const {results} = await new Xo({cwd}).lintFiles();
	assert.equal(results.length, 1);
	assert.equal(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/semi');
});

test('lints dotfiles in subdirectories', async () => {
	await fs.mkdir(path.join(cwd, '.config'), {recursive: true});
	await fs.writeFile(path.join(cwd, '.config', 'test.js'), dedent`console.log('hello')\n`, 'utf8');
	const {results} = await new Xo({cwd}).lintFiles();
	assert.equal(results.length, 1);
	assert.equal(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/semi');
});

test('quiet mode suppresses ignored-file warning', async () => {
	const filePath = path.join(cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	const xo = new Xo({cwd, quiet: true}, {ignores: ['test.js']});
	const {results, warningCount} = await xo.lintFiles('test.js');
	assert.equal(results.length, 0);
	assert.equal(warningCount, 0);
});

test('warns when explicit file is ignored by config', async () => {
	const filePath = path.join(cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	const xo = new Xo({cwd}, {ignores: ['test.js']});
	const {results, warningCount} = await xo.lintFiles('test.js');
	assert.equal(results.length, 1);
	assert.equal(warningCount, 1);
	assert.equal(results[0]?.messages[0]?.message, ignoredFileWarningMessage);
});

test('warns when explicit file is ignored by resolved flat config', async () => {
	const filePath = path.join(cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['test.js'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd});
	const {results, warningCount} = await xo.lintFiles('test.js');
	assert.equal(results.length, 1);
	assert.equal(warningCount, 1);
	assert.equal(results[0]?.messages[0]?.message, ignoredFileWarningMessage);
});

test('scoped ignores in config do not remove files from linting', async () => {
	const filePath = path.join(cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(cwd, 'xo.config.js'), dedent`
		export default [
			{
				rules: {
					'no-console': 'off',
				},
				ignores: ['test.js'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd});
	const {results, warningCount} = await xo.lintFiles('test.js');
	assert.equal(results.length, 1);
	assert.equal(warningCount, 0);
	assert.equal(results[0]?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated default ignore patterns in config file allow linting default-ignored directories', async () => {
	const distDirectory = path.join(cwd, 'dist');
	await fs.mkdir(distDirectory, {recursive: true});
	await fs.writeFile(path.join(distDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/**'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd});
	const {results} = await xo.lintFiles();
	const distResult = results?.find(result => result.filePath.includes('dist/index.js'));
	assert.ok(distResult, 'dist/index.js should be linted');
	assert.equal(distResult?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated default ignore patterns in config can reopen a narrower built-in directory pattern', async () => {
	const lintedDirectory = path.join(cwd, 'dist', 'src');
	const ignoredDirectory = path.join(cwd, 'dist', 'ignored');
	await fs.mkdir(lintedDirectory, {recursive: true});
	await fs.mkdir(ignoredDirectory, {recursive: true});
	await fs.writeFile(path.join(lintedDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(ignoredDirectory, 'index.js'), dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/src/**'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd});
	const {results} = await xo.lintFiles();
	const lintedResult = results?.find(result => result.filePath.includes('dist/src/index.js'));
	const ignoredResult = results?.find(result => result.filePath.includes('dist/ignored/index.js'));
	assert.ok(lintedResult, 'dist/src/index.js should be linted');
	assert.ok(!ignoredResult, 'dist/ignored/index.js should still be ignored');
	assert.equal(lintedResult?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated default ignore patterns in config keep explicit reopened directory paths lintable', async () => {
	const lintedDirectory = path.join(cwd, 'dist', 'src');
	await fs.mkdir(lintedDirectory, {recursive: true});
	await fs.writeFile(path.join(lintedDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/src/**'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd});
	const {results, warningCount} = await xo.lintFiles('dist/src/index.js');
	assert.equal(results.length, 1);
	assert.equal(warningCount, 0);
	assert.equal(results[0]?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated default ignore patterns in config keep explicit reopened file paths lintable', async () => {
	const lintedDirectory = path.join(cwd, 'dist', 'src');
	const ignoredDirectory = path.join(cwd, 'dist', 'ignored');
	await fs.mkdir(lintedDirectory, {recursive: true});
	await fs.mkdir(ignoredDirectory, {recursive: true});
	await fs.writeFile(path.join(lintedDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(ignoredDirectory, 'index.js'), dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/src/index.js'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd});
	const {results, warningCount} = await xo.lintFiles('dist/src/index.js');
	assert.equal(results.length, 1);
	assert.equal(warningCount, 0);
	assert.equal(results[0]?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated default ignore patterns in config keep directory globs lintable', async () => {
	const lintedDirectory = path.join(cwd, 'dist', 'src');
	const ignoredDirectory = path.join(cwd, 'dist', 'ignored');
	await fs.mkdir(lintedDirectory, {recursive: true});
	await fs.mkdir(ignoredDirectory, {recursive: true});
	await fs.writeFile(path.join(lintedDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(ignoredDirectory, 'index.js'), dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/src/**'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd});
	const {results} = await xo.lintFiles('dist');
	const lintedResult = results?.find(result => result.filePath.includes('dist/src/index.js'));
	const ignoredResult = results?.find(result => result.filePath.includes('dist/ignored/index.js'));
	assert.ok(lintedResult, 'dist/src/index.js should be linted');
	assert.ok(!ignoredResult, 'dist/ignored/index.js should still be ignored');
	assert.equal(lintedResult?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated default ignore patterns in config keep sibling reopened directory files ignored for explicit paths', async () => {
	const lintedDirectory = path.join(cwd, 'dist', 'src');
	const ignoredDirectory = path.join(cwd, 'dist', 'ignored');
	await fs.mkdir(lintedDirectory, {recursive: true});
	await fs.mkdir(ignoredDirectory, {recursive: true});
	await fs.writeFile(path.join(lintedDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(ignoredDirectory, 'index.js'), dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/src/**'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd});
	const {results} = await xo.lintFiles('dist/ignored/index.js');
	assert.equal(results.length, 1);
	assert.equal(results[0]?.messages[0]?.message, ignoredFileWarningMessage);
});

test('positive CLI ignores still win for explicit paths when config reopens a default-ignored directory', async () => {
	const privateDirectory = path.join(cwd, 'dist', 'private');
	await fs.mkdir(privateDirectory, {recursive: true});
	await fs.writeFile(path.join(privateDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/**'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd}, {ignores: ['dist/private/**']});
	const {results} = await xo.lintFiles('dist/private/index.js');
	assert.equal(results.length, 1);
	assert.equal(results[0]?.messages[0]?.message, ignoredFileWarningMessage);
});

test('negated default ignore patterns via CLI allow linting default-ignored directories', async () => {
	const distDirectory = path.join(cwd, 'dist');
	await fs.mkdir(distDirectory, {recursive: true});
	await fs.writeFile(path.join(distDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	const xo = new Xo({cwd}, {ignores: ['!dist/**']});
	const {results} = await xo.lintFiles();
	const distResult = results?.find(result => result.filePath.includes('dist/index.js'));
	assert.ok(distResult, 'dist/index.js should be linted');
	assert.equal(distResult?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated default ignore patterns via CLI can unignore a narrower built-in directory pattern', async () => {
	const temporaryDirectory = path.join(cwd, 'tmp');
	await fs.mkdir(temporaryDirectory, {recursive: true});
	await fs.writeFile(path.join(temporaryDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	const xo = new Xo({cwd}, {ignores: ['!tmp/**']});
	const {results} = await xo.lintFiles('tmp/index.js');
	assert.equal(results.length, 1);
	assert.equal(results[0]?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated default ignore patterns via CLI can unignore a narrower built-in file pattern', async () => {
	const filePath = path.join(cwd, 'app.min.js');
	const siblingFilePath = path.join(cwd, 'vendor.min.js');
	await fs.writeFile(filePath, dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(siblingFilePath, dedent`console.log('hello');\n`, 'utf8');
	const xo = new Xo({cwd}, {ignores: ['!app.min.js']});
	const {results} = await xo.lintFiles();
	const lintedResult = results?.find(result => result.filePath.includes('app.min.js'));
	const siblingResult = results?.find(result => result.filePath.includes('vendor.min.js'));
	assert.ok(lintedResult, 'app.min.js should be linted');
	assert.ok(!siblingResult, 'vendor.min.js should still be ignored');
	assert.equal(results.length, 1);
	assert.equal(lintedResult?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated default ignore patterns in config can unignore a narrower built-in file pattern without linting siblings', async () => {
	const filePath = path.join(cwd, 'app.min.js');
	const siblingFilePath = path.join(cwd, 'vendor.min.js');
	await fs.writeFile(filePath, dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(siblingFilePath, dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!app.min.js'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd});
	const {results} = await xo.lintFiles();
	const lintedResult = results?.find(result => result.filePath.includes('app.min.js'));
	const siblingResult = results?.find(result => result.filePath.includes('vendor.min.js'));
	assert.ok(lintedResult, 'app.min.js should be linted');
	assert.ok(!siblingResult, 'vendor.min.js should still be ignored');
	assert.equal(lintedResult?.messages[0]?.ruleId, '@stylistic/semi');
});

test('positive CLI ignores keep precedence over config negations that reopen default ignores', async () => {
	const privateDirectory = path.join(cwd, 'dist', 'private');
	const publicDirectory = path.join(cwd, 'dist', 'public');
	await fs.mkdir(privateDirectory, {recursive: true});
	await fs.mkdir(publicDirectory, {recursive: true});
	await fs.writeFile(path.join(privateDirectory, 'index.js'), dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(publicDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/**'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd}, {ignores: ['dist/private/**']});
	const {results} = await xo.lintFiles();
	const publicResult = results?.find(result => result.filePath.includes('dist/public/index.js'));
	const privateResult = results?.find(result => result.filePath.includes('dist/private/index.js'));
	assert.ok(publicResult, 'dist/public/index.js should be linted');
	assert.ok(!privateResult, 'dist/private/index.js should still be ignored');
	assert.equal(publicResult?.messages[0]?.ruleId, '@stylistic/semi');
});

test('negated default ignore only removes the matching default pattern', async () => {
	const distDirectory = path.join(cwd, 'dist');
	const coverageDirectory = path.join(cwd, 'coverage');
	await fs.mkdir(distDirectory, {recursive: true});
	await fs.mkdir(coverageDirectory, {recursive: true});
	await fs.writeFile(path.join(distDirectory, 'index.js'), dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(coverageDirectory, 'report.js'), dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/**'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd});
	const {results} = await xo.lintFiles();
	const distResult = results?.find(result => result.filePath.includes('dist/index.js'));
	const coverageResult = results?.find(result => result.filePath.includes('coverage/report.js'));
	assert.ok(distResult, 'dist/index.js should be linted');
	assert.ok(!coverageResult, 'coverage/report.js should still be ignored');
});

test('three-level nesting: ignore, un-ignore, re-ignore', async () => {
	const lintedDirectory = path.join(cwd, 'dist', 'src');
	const secretDirectory = path.join(cwd, 'dist', 'src', 'secret');
	await fs.mkdir(lintedDirectory, {recursive: true});
	await fs.mkdir(secretDirectory, {recursive: true});
	await fs.writeFile(path.join(lintedDirectory, 'index.js'), dedent`console.log('hello')\n`, 'utf8');
	await fs.writeFile(path.join(secretDirectory, 'key.js'), dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(path.join(cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/src/**', 'dist/src/secret/**'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd});
	const {results} = await xo.lintFiles();
	const lintedResult = results?.find(result => result.filePath.includes('dist/src/index.js'));
	const secretResult = results?.find(result => result.filePath.includes('dist/src/secret/key.js'));
	assert.ok(lintedResult, 'dist/src/index.js should be linted');
	assert.ok(!secretResult, 'dist/src/secret/key.js should still be ignored');
	assert.equal(lintedResult?.messages[0]?.ruleId, '@stylistic/semi');
});

test('throws for nonexistent explicit file', async () => {
	await assert.rejects(
		new Xo({cwd}).lintFiles('nonexistent.js'),
		{message: noFilesFoundErrorMessage},
	);
});

test('throws for array of nonexistent explicit files', async () => {
	await assert.rejects(
		new Xo({cwd}).lintFiles(['nonexistent-a.js', 'nonexistent-b.js']),
		{message: noFilesFoundErrorMessage},
	);
});

test('no warning for glob pattern when all files are ignored', async () => {
	const filePath = path.join(cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	const xo = new Xo({cwd}, {ignores: ['test.js']});
	const {results} = await xo.lintFiles('*.js');
	assert.equal(results.length, 0);
});

test('mixed explicit files: some ignored, some not', async () => {
	const fileA = path.join(cwd, 'a.js');
	const fileB = path.join(cwd, 'b.js');
	await fs.writeFile(fileA, dedent`console.log('hello');\n`, 'utf8');
	await fs.writeFile(fileB, dedent`console.log('hello');\n`, 'utf8');
	const xo = new Xo({cwd}, {ignores: ['b.js']});
	const {results} = await xo.lintFiles(['a.js', 'b.js']);
	assert.equal(results.length, 2);
	const linted = results.find(r => r.filePath === fileA);
	const ignored = results.find(r => r.filePath === fileB);
	assert.ok(linted);
	assert.equal(linted.messages.length, 0);
	assert.ok(ignored);
	assert.equal(ignored.messages[0]?.message, ignoredFileWarningMessage);
});

test('does not throw for dynamic glob pattern with no matches', async () => {
	const {results} = await new Xo({cwd}).lintFiles('nonexistent/**/*.js');
	assert.deepEqual(results, []);
});

test('does not throw when no globs provided and no files found', async () => {
	const {results} = await new Xo({cwd}).lintFiles();
	assert.deepEqual(results, []);
});

test('normalize cwd path casing', async () => {
	const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'xo-cwd-case-'));
	const canonicalDirectory = path.join(temporaryDirectory, 'project');
	const mismatchedCaseDirectory = path.join(temporaryDirectory, 'PrOjEcT');

	try {
		await fs.mkdir(canonicalDirectory);

		const hasMismatchedCaseDirectory = await fs.stat(mismatchedCaseDirectory).then(() => true, () => false);
		const resolvedCwd = hasMismatchedCaseDirectory ? mismatchedCaseDirectory : canonicalDirectory;

		// Write a JS file in the canonical directory so lintFiles has something to process.
		const fileName = 'test-casing.js';
		await fs.writeFile(path.join(canonicalDirectory, fileName), 'const x = 1;\n', 'utf8');

		const xo = new Xo({cwd: resolvedCwd});
		// Use a relative glob so ESLint resolves the absolute filePath from the instance's (realpath-normalized) cwd, not from the raw mismatched-case path.
		const {results} = await xo.lintFiles('*.js');

		// The returned filePath must use the realpath-canonical casing, not the mismatched-case path that was passed to the constructor.
		const expectedFilePath = path.join(realpathSync.native(resolvedCwd), fileName);
		assert.ok(results.length > 0, 'Expected at least one lint result');
		assert.equal(results[0]?.filePath, expectedFilePath);
	} finally {
		await fs.rm(temporaryDirectory, {recursive: true, force: true});
	}
});

test('suppressions > no suppression file, violations still reported', async () => {
	const filePath = path.join(cwd, 'test.js');
	await fs.writeFile(filePath, 'console.log(1)\n', 'utf8');

	const {results} = await new Xo({cwd}).lintFiles('**/*');
	const lintResult = results?.find(result => result.filePath === filePath);
	assert.equal(lintResult?.messages.length, 1);
	assert.equal(lintResult?.messages[0]?.ruleId, '@stylistic/semi');
});

test('suppressions > respects eslint-suppressions.json', async () => {
	const filePath = path.join(cwd, 'test.js');
	await fs.writeFile(filePath, 'console.log(1)\n', 'utf8');

	const suppressionsPath = path.join(cwd, 'eslint-suppressions.json');
	await fs.writeFile(suppressionsPath, '{"test.js": {"@stylistic/semi": {"count": 1}}}', 'utf8');

	const {results} = await new Xo({cwd}).lintFiles('**/*');
	const lintResult = results?.find(result => result.filePath === filePath);
	assert.equal(lintResult?.messages.length, 0);
});

test('suppressions > custom suppressionsLocation', async () => {
	const filePath = path.join(cwd, 'test.js');
	await fs.writeFile(filePath, 'console.log(1)\n', 'utf8');

	const suppressionsPath = path.join(cwd, 'custom-suppressions.json');
	await fs.writeFile(suppressionsPath, '{"test.js": {"@stylistic/semi": {"count": 1}}}', 'utf8');

	const {results} = await new Xo({cwd, suppressionsLocation: suppressionsPath}).lintFiles('**/*');
	const lintResult = results?.find(result => result.filePath === filePath);
	assert.equal(lintResult?.messages.length, 0);
});

test('suppressions > throws for missing custom suppressionsLocation', async () => {
	const filePath = path.join(cwd, 'test.js');
	const suppressionsPath = path.join(cwd, 'missing-suppressions.json');
	await fs.writeFile(filePath, 'console.log(1)\n', 'utf8');

	const error = await rejectionOf<Error>(new Xo({cwd, suppressionsLocation: suppressionsPath}).lintFiles('**/*'));
	assert.equal(error.message, 'The suppressions file does not exist. Please run the command with `--suppress-all` or `--suppress-rule` to create it.');
});

test('suppressions > relative suppressionsLocation path is resolved from cwd', async () => {
	const filePath = path.join(cwd, 'test.js');
	await fs.writeFile(filePath, 'console.log(1)\n', 'utf8');

	const suppressionsPath = path.join(cwd, 'eslint-suppressions.json');
	await fs.writeFile(suppressionsPath, '{"test.js": {"@stylistic/semi": {"count": 1}}}', 'utf8');

	const {results} = await new Xo({cwd, suppressionsLocation: 'eslint-suppressions.json'}).lintFiles('**/*');
	const lintResult = results?.find(result => result.filePath === filePath);
	assert.equal(lintResult?.messages.length, 0);
});

test('respects core.excludesfile (global gitignore)', async (t: TestContext) => {
	const ignoredFilePath = path.join(cwd, 'globally-ignored.js');
	const normalFilePath = path.join(cwd, 'normal.js');
	await fs.writeFile(ignoredFilePath, 'console.log("hello")\n', 'utf8');
	await fs.writeFile(normalFilePath, 'console.log("hello")\n', 'utf8');

	const gitignorePath = path.join(cwd, '.global-gitignore');
	await fs.writeFile(gitignorePath, 'globally-ignored.js\n', 'utf8');

	const gitConfigPath = path.join(cwd, '.gitconfig');
	await fs.writeFile(gitConfigPath, `[core]\n\texcludesfile = ${gitignorePath}\n`, 'utf8');

	withEnvironmentVariable(t, 'GIT_CONFIG_GLOBAL', gitConfigPath);

	const {results} = await new Xo({cwd}).lintFiles('**/*.js');
	t.assert.ok(results.every(r => r.filePath !== ignoredFilePath), 'globally-ignored.js should be excluded from lint results');
	t.assert.ok(results.some(r => r.filePath === normalFilePath), 'normal.js should still be linted');
});
