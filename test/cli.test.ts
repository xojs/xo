import fs from 'node:fs/promises';
import path from 'node:path';
import _test, {type TestFn} from 'ava'; // eslint-disable-line ava/use-test
import dedent from 'dedent';
import {$, type ExecaError} from 'execa';
import {copyTestProject} from './helpers/copy-test-project.js';

const test = _test as TestFn<{cwd: string}>;

test.beforeEach(async t => {
	t.context.cwd = await copyTestProject();
});

test.afterEach.always(async t => {
	await fs.rm(t.context.cwd, {recursive: true, force: true});
});

test('xo --cwd', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');

	await t.notThrowsAsync($`node ./dist/cli --cwd ${t.context.cwd}`);
});

test('xo --fix', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello')\n`, 'utf8');
	await t.notThrowsAsync($`node ./dist/cli --cwd ${t.context.cwd} --fix`);
	const fileContent = await fs.readFile(filePath, 'utf8');
	t.is(fileContent, dedent`console.log('hello');\n`);
});

test('xo --fix --space', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`function test() {\n   return true;\n}\n`, 'utf8');
	await t.throwsAsync($`node ./dist/cli --cwd ${t.context.cwd} --fix --space`);
	const fileContent = await fs.readFile(filePath, 'utf8');
	t.is(fileContent, 'function test() {\n  return true;\n}\n');
});

test('xo --fix --semicolon=false', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	await t.notThrowsAsync($`node ./dist/cli --cwd ${t.context.cwd} --fix --semicolon=false`);
	const fileContent = await fs.readFile(filePath, 'utf8');
	t.is(fileContent, dedent`console.log('hello')\n`);
});

test('xo --fix --no-semicolon', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	await t.notThrowsAsync($`node ./dist/cli --cwd ${t.context.cwd} --fix --no-semicolon`);
	const fileContent = await fs.readFile(filePath, 'utf8');
	t.is(fileContent, dedent`console.log('hello')\n`);
});

test('xo --fix --prettier', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`function test(){return true}\n`, 'utf8');
	await t.throwsAsync($`node ./dist/cli --cwd ${t.context.cwd} --fix --prettier`);
	const fileContent = await fs.readFile(filePath, 'utf8');
	t.is(fileContent, 'function test() {\n\treturn true;\n}\n');
});

test('xo --space', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`function test() {\n   return true;\n}\n`, 'utf8');
	const error = await t.throwsAsync($`node ./dist/cli --cwd ${t.context.cwd} --space`);
	t.true(error.message.includes('@stylistic/indent'));
});

test('xo --semicolon=false', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	const error = await t.throwsAsync($`node ./dist/cli --cwd ${t.context.cwd} --semicolon=false`);

	t.true(error.message.includes('@stylistic/semi'));
});

test('xo --no-semicolon', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	const error = await t.throwsAsync($`node ./dist/cli --cwd ${t.context.cwd} --no-semicolon`);
	t.true(error.message.includes('@stylistic/semi'));
});

test('xo --prettier', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`export function test(){return true}\n`, 'utf8');
	const error = await t.throwsAsync($`node ./dist/cli --cwd ${t.context.cwd} --prettier`);
	t.true(error.message.includes('prettier/prettier'));
});

test('xo --print-config', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	const {stdout} = await $`node ./dist/cli --cwd ${t.context.cwd} --print-config=${filePath}`;
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const config = JSON.parse(stdout);
	t.true(typeof config === 'object');
	t.true('rules' in config);
});

test('xo --print-config ts', async t => {
	const filePath = path.join(t.context.cwd, 'test.ts');
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	const {stdout} = await $`node ./dist/cli --cwd ${t.context.cwd} --print-config=${filePath}`;
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const config = JSON.parse(stdout);
	t.true(typeof config === 'object');
	t.true('rules' in config);
});

test('xo --ignore', async t => {
	const testFile = path.join(t.context.cwd, 'test.js');
	const ignoredFile = path.join(t.context.cwd, 'ignored.js');

	await fs.writeFile(testFile, dedent`console.log('test');\n`, 'utf8');
	await fs.writeFile(ignoredFile, dedent`console.log('ignored');\n`, 'utf8');

	const {stdout} = await $`node ./dist/cli --cwd ${t.context.cwd} --ignore="ignored.js"`;
	t.false(stdout.includes('ignored.js'));
});

test('xo --stdin', async t => {
	const {stdout} = await $`echo ${'const x = true'}`.pipe`node ./dist/cli --cwd=${t.context.cwd} --stdin`;
	t.true(stdout.includes('stdin.js'));
});

test('xo --stdin --fix', async t => {
	const {stdout} = await $`echo ${'const x = true'}`.pipe`node ./dist/cli --cwd=${t.context.cwd} --stdin --fix`;
	// Not sure what these extra escaped single quotes are
	t.is(stdout, 'const x = true;');
});

test('xo --stdin --stdin-filename=test.js', async t => {
	const {stdout} = await $`echo ${'const x = true'}`.pipe`node ./dist/cli --cwd=${t.context.cwd} --stdin --stdin-filename=test.js`;
	t.true(stdout.includes('test.js'));
});

test('xo --stdin --stdin-filename=test.ts', async t => {
	const {stdout} = await $`echo ${'const x: boolean = true'}`.pipe`node ./dist/cli --cwd=${t.context.cwd} --stdin --stdin-filename=test.ts`;
	t.true(stdout.includes('test.ts'));
});

test('xo --reporter json', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello')\n`, 'utf8');

	const error: ExecaError = await t.throwsAsync($`node ./dist/cli --cwd ${t.context.cwd} --reporter=json`);

	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const results = JSON.parse(error?.stdout?.toString() ?? '');

	t.true(Array.isArray(results));
	t.is(results.length, 1);
	t.is(typeof results[0], 'object');
});

test('xo --stdin --stdin-filename=test.ts --fix', async t => {
	const {stdout} = await $`echo ${'const x: boolean = true'}`.pipe`node ./dist/cli --cwd=${t.context.cwd} --stdin --stdin-filename=test.ts --fix`;
	t.is(stdout, 'const x = true;');
});

test('xo lints ts files not found in tsconfig.json', async t => {
	const filePath = path.join(t.context.cwd, 'test.ts');
	const tsConfigPath = path.join(t.context.cwd, 'tsconfig.json');
	const xoTsConfigPath = path.join(t.context.cwd, 'tsconfig.xo.json');
	const tsConfig = await fs.readFile(tsConfigPath, 'utf8');
	await fs.writeFile(xoTsConfigPath, tsConfig);
	await fs.rm(tsConfigPath);
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	await t.notThrowsAsync($`node ./dist/cli --cwd ${t.context.cwd}`);
	await fs.writeFile(tsConfigPath, tsConfig);
	await fs.rm(xoTsConfigPath);
});

test('xo does not lint ts files not found in tsconfig.json when --ts=false', async t => {
	const filePath = path.join(t.context.cwd, 'test.ts');
	const tsConfigPath = path.join(t.context.cwd, 'tsconfig.json');
	const xoTsConfigPath = path.join(t.context.cwd, 'tsconfig.xo.json');
	const tsConfig = await fs.readFile(tsConfigPath, 'utf8');
	await fs.writeFile(xoTsConfigPath, tsConfig);
	await fs.rm(tsConfigPath);
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	await t.throwsAsync($`node ./dist/cli --cwd ${t.context.cwd} --ts=false`);
	await fs.writeFile(tsConfigPath, tsConfig);
	await fs.rm(xoTsConfigPath);
});
