
import process from 'node:process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {availableParallelism, tmpdir} from 'node:os';
import test, {describe, type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import dedent from 'dedent';
import {$} from 'execa';
import {pathExists} from 'path-exists';
import {type TsConfigJson} from 'get-tsconfig';
import {ignoredFileWarningMessage, noFilesFoundErrorMessage} from '../lib/xo.js';
import {copyTestProject} from './helpers/copy-test-project.js';
import {rejectionOf} from './helpers/rejection-of.js';

/**
Creates an isolated copy of the test project for a single test and removes it afterwards.

@returns The path to the test project.
*/
const createProject = async (t: TestContext) => {
	const cwd = await copyTestProject();
	t.after(async () => {
		await fs.rm(cwd, {recursive: true, force: true});
	});
	return cwd;
};

// The tests run concurrently because each gets its own project directory and only shells out to the CLI.
// Concurrency is capped at the core count since each test spawns a CPU-heavy `node ./dist/cli` subprocess.
describe('xo CLI', {concurrency: availableParallelism()}, () => {
	test('xo --cwd', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');

		await $`node ./dist/cli --cwd ${cwd}`;
	});

	test('xo throws when no files match explicit pattern', async t => {
		const cwd = await createProject(t);
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd} nonexistent.js`);
		assert.ok((error.stderr as string)?.includes(noFilesFoundErrorMessage));
	});

	test('xo warns when explicit file is ignored', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
		// eslint-disable-next-line @typescript-eslint/naming-convention
		const {stdout} = await $({env: {...process.env, GITHUB_ACTIONS: ''}})`node ./dist/cli --cwd ${cwd} --ignore="test.js" test.js`;
		assert.ok(stdout.includes(ignoredFileWarningMessage));
	});

	test('xo warns when the project TypeScript is older than the bundled version', async t => {
		const cwd = await fs.mkdtemp(path.join(tmpdir(), 'xo-ts-version-'));
		t.after(async () => {
			await fs.rm(cwd, {recursive: true, force: true});
		});

		await fs.writeFile(path.join(cwd, 'package.json'), JSON.stringify({type: 'module', name: 'ts-version-test'}), 'utf8');
		await fs.writeFile(path.join(cwd, 'tsconfig.json'), '{}', 'utf8');
		await fs.writeFile(path.join(cwd, 'foo.ts'), dedent`export const x = 1;\n`, 'utf8');

		// Simulate an older-major project-level TypeScript so the version-mismatch warning triggers.
		await fs.mkdir(path.join(cwd, 'node_modules', 'typescript'), {recursive: true});
		await fs.writeFile(path.join(cwd, 'node_modules', 'typescript', 'package.json'), JSON.stringify({name: 'typescript', version: '5.0.0'}), 'utf8');

		const {stderr} = await $({reject: false})`node ./dist/cli --cwd ${cwd} foo.ts`;
		assert.ok(stderr.includes('XO bundles TypeScript'));
		assert.ok(stderr.includes('5.0.0'));
	});

	test('xo fails with exit code 2 for missing custom suppressions file', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello')\n`, 'utf8');

		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd} --suppressions-location missing-suppressions.json`);
		assert.equal(error.exitCode, 2);
		assert.ok((error.stderr as string).includes('The suppressions file does not exist.'));
	});

	test('xo --fix', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello')\n`, 'utf8');
		await $`node ./dist/cli --cwd ${cwd} --fix`;
		const fileContent = await fs.readFile(filePath, 'utf8');
		assert.equal(fileContent, dedent`console.log('hello');\n`);
	});

	test('xo --fix-dry-run', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		const original = dedent`console.log('hello')\n`;
		await fs.writeFile(filePath, original, 'utf8');
		await $`node ./dist/cli --cwd ${cwd} --fix-dry-run`;
		const fileContent = await fs.readFile(filePath, 'utf8');
		assert.equal(fileContent, original, 'File should not be modified with --fix-dry-run');
	});

	test('xo --fix --space', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`function test() {\n   return true;\n}\n`, 'utf8');
		await rejectionOf($`node ./dist/cli --cwd ${cwd} --fix --space`);
		const fileContent = await fs.readFile(filePath, 'utf8');
		assert.equal(fileContent, 'function test() {\n  return true;\n}\n');
	});

	test('xo --fix --semicolon=false', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
		await $`node ./dist/cli --cwd ${cwd} --fix --semicolon=false`;
		const fileContent = await fs.readFile(filePath, 'utf8');
		assert.equal(fileContent, dedent`console.log('hello')\n`);
	});

	test('xo --fix --no-semicolon', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
		await $`node ./dist/cli --cwd ${cwd} --fix --no-semicolon`;
		const fileContent = await fs.readFile(filePath, 'utf8');
		assert.equal(fileContent, dedent`console.log('hello')\n`);
	});

	test('xo --fix --prettier', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`function test(){return true}\n`, 'utf8');
		await rejectionOf($`node ./dist/cli --cwd ${cwd} --fix --prettier`);
		const fileContent = await fs.readFile(filePath, 'utf8');
		assert.equal(fileContent, 'function test() {\n\treturn true;\n}\n');
	});

	test('xo --space', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`function test() {\n   return true;\n}\n`, 'utf8');
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd} --space`);
		assert.ok(error.message.includes('@stylistic/indent'));
	});

	test('xo --semicolon=false', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd} --semicolon=false`);

		assert.ok(error.message.includes('@stylistic/semi'));
	});

	test('xo --no-semicolon', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd} --no-semicolon`);
		assert.ok(error.message.includes('@stylistic/semi'));
	});

	test('xo --prettier', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`export function test(){return true}\n`, 'utf8');
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd} --prettier`);
		assert.ok(error.message.includes('prettier/prettier'));
	});

	test('xo --print-config', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
		const {stdout} = await $`node ./dist/cli --cwd ${cwd} --print-config=${filePath}`;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const config = JSON.parse(stdout);
		assert.ok(typeof config === 'object');
		assert.ok('rules' in config);
	});

	test('xo --print-config ts', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.ts');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
		const {stdout} = await $`node ./dist/cli --cwd ${cwd} --print-config=${filePath}`;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const config = JSON.parse(stdout);
		assert.ok(typeof config === 'object');
		assert.ok('rules' in config);
	});

	test('xo --print-config relative path', async t => {
		const cwd = await createProject(t);
		const fileName = 'test.ts';
		const filePath = path.join(cwd, fileName);
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
		const {stdout} = await $`node ./dist/cli --cwd ${cwd} --print-config=${fileName}`;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const config = JSON.parse(stdout);
		assert.ok(typeof config === 'object');
		assert.ok('rules' in config);
	});

	test('xo --print-config no path', async t => {
		const cwd = await createProject(t);
		const {stderr} = await rejectionOf($`node ./dist/cli --cwd ${cwd} --print-config`);
		assert.equal(stderr?.toString() ?? '', 'The `--print-config` flag must be used with exactly one filename');
	});

	test('xo --ignore', async t => {
		const cwd = await createProject(t);
		const testFile = path.join(cwd, 'test.js');
		const ignoredFile = path.join(cwd, 'ignored.js');

		await fs.writeFile(testFile, dedent`console.log('test');\n`, 'utf8');
		await fs.writeFile(ignoredFile, dedent`console.log('ignored');\n`, 'utf8');

		const {stdout} = await $`node ./dist/cli --cwd ${cwd} --ignore="ignored.js"`;
		assert.ok(!stdout.includes('ignored.js'));
	});

	test('xo --stdin', async t => {
		const cwd = await createProject(t);
		const {stdout} = await $`echo ${'const x = true'}`.pipe`node ./dist/cli --cwd=${cwd} --stdin`;
		assert.ok(stdout.includes('stdin.js'));
	});

	test('xo --stdin --fix', async t => {
		const cwd = await createProject(t);
		const {stdout} = await $`echo ${'const x = true'}`.pipe`node ./dist/cli --cwd=${cwd} --stdin --fix`;
		// Not sure what these extra escaped single quotes are
		assert.equal(stdout, 'const x = true;');
	});

	test('xo --stdin --fix-dry-run', async t => {
		const cwd = await createProject(t);
		const {stdout} = await $`echo ${'const x = true'}`.pipe`node ./dist/cli --cwd=${cwd} --stdin --fix-dry-run`;
		assert.equal(stdout, 'const x = true;');
	});

	test('xo --stdin --stdin-filename=test.js', async t => {
		const cwd = await createProject(t);
		const {stdout} = await $`echo ${'const x = true'}`.pipe`node ./dist/cli --cwd=${cwd} --stdin --stdin-filename=test.js`;
		assert.ok(stdout.includes('test.js'));
	});

	test('xo --stdin --stdin-filename=test.ts', async t => {
		const cwd = await createProject(t);
		const {stdout} = await $`echo ${'const x: boolean = true'}`.pipe`node ./dist/cli --cwd=${cwd} --stdin --stdin-filename=test.ts`;
		assert.ok(stdout.includes('test.ts'));
	});

	test('xo --reporter json', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello')\n`, 'utf8');

		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd} --reporter=json`);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const results: unknown[] = JSON.parse(error?.stdout?.toString() ?? '');

		assert.ok(Array.isArray(results));
		assert.equal(results.length, 1);
		assert.equal(typeof results[0], 'object');
	});

	test('xo --reporter json keeps warning-only results when errors exist', async t => {
		const cwd = await createProject(t);
		const warningFilePath = path.join(cwd, 'warning.js');
		const errorFilePath = path.join(cwd, 'error.js');
		await fs.writeFile(warningFilePath, dedent`const x = true;\n`, 'utf8');
		await fs.writeFile(errorFilePath, dedent`console.log('hello')\n`, 'utf8');

		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd} --reporter=json ${warningFilePath} ${errorFilePath}`);

		const results = JSON.parse(error?.stdout?.toString() ?? '') as Array<{filePath: string}>;

		assert.equal(results.length, 2);
		assert.deepEqual(
			results.map(result => path.basename(result.filePath)).toSorted(),
			['error.js', 'warning.js'],
		);
	});

	test('xo --stdin --stdin-filename=test.ts --fix', async t => {
		const cwd = await createProject(t);
		const {stdout} = await $`echo ${'const x: boolean = true'}`.pipe`node ./dist/cli --cwd=${cwd} --stdin --stdin-filename=test.ts --fix`;
		assert.equal(stdout, 'const x = true;');
	});

	test('xo lints ts files with no tsconfig.json', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.ts');
		const tsConfigPath = path.join(cwd, 'tsconfig.json');
		const xoTsConfigPath = path.join(cwd, 'tsconfig.xo.json');
		const tsConfig = await fs.readFile(tsConfigPath, 'utf8');
		await fs.writeFile(xoTsConfigPath, tsConfig);
		await fs.rm(tsConfigPath);
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
		await $`node ./dist/cli --cwd ${cwd}`;
		await fs.writeFile(tsConfigPath, tsConfig);
		await fs.rm(xoTsConfigPath);
	});

	test('xo lints ts files explicitly excluded from tsconfig.json', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.ts');
		const tsConfigPath = path.join(cwd, 'tsconfig.json');
		const xoTsConfigPath = path.join(cwd, 'tsconfig.xo.json');
		const originalTsConfig = await fs.readFile(tsConfigPath, 'utf8');
		const tsConfigContent = JSON.stringify({
			compilerOptions: {
				module: 'node16',
				target: 'ES2022',
				strictNullChecks: true,
				lib: ['DOM', 'DOM.Iterable', 'ES2022'],
			},
			exclude: ['test.ts'],
		}, null, 2);
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
		await fs.writeFile(tsConfigPath, tsConfigContent, 'utf8');
		await $`node ./dist/cli --cwd ${cwd}`;
		await fs.writeFile(xoTsConfigPath, originalTsConfig);
	});

	test('xo lints ts files implicitly excluded from tsconfig.json', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.ts');
		const tsConfigPath = path.join(cwd, 'tsconfig.json');
		const xoTsConfigPath = path.join(cwd, 'tsconfig.xo.json');
		const originalTsConfig = await fs.readFile(tsConfigPath, 'utf8');
		const tsConfigContent = JSON.stringify({
			compilerOptions: {
				module: 'node16',
				target: 'ES2022',
				strictNullChecks: true,
				lib: ['DOM', 'DOM.Iterable', 'ES2022'],
			},
			include: ['not-a-real-file.ts'],
			exclude: [],
		}, null, 2);
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
		await fs.writeFile(tsConfigPath, tsConfigContent, 'utf8');
		await $`node ./dist/cli --cwd ${cwd}`;
		await fs.writeFile(xoTsConfigPath, originalTsConfig);
	});

	test('xo lints ts files implicitly excluded from tsconfig.json with baseUrl', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.ts');
		const tsConfigPath = path.join(cwd, 'tsconfig.json');
		const xoTsConfigPath = path.join(cwd, 'tsconfig.xo.json');
		const originalTsConfig = await fs.readFile(tsConfigPath, 'utf8');
		const tsConfigContent = JSON.stringify({
			compilerOptions: {
				module: 'node16',
				target: 'ES2022',
				strictNullChecks: true,
				baseUrl: './nonsense',
				lib: ['DOM', 'DOM.Iterable', 'ES2022'],
			},
			include: ['not-a-real-file.ts'],
			exclude: [],
		}, null, 2);
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
		await fs.writeFile(tsConfigPath, tsConfigContent, 'utf8');
		await $`node ./dist/cli --cwd ${cwd}`;
		await fs.writeFile(xoTsConfigPath, originalTsConfig);
	});

	test('xo lints ts files implicitly excluded from tsconfig.json with rootDir', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.ts');
		const tsConfigPath = path.join(cwd, 'tsconfig.json');
		const xoTsConfigPath = path.join(cwd, 'tsconfig.xo.json');
		const originalTsConfig = await fs.readFile(tsConfigPath, 'utf8');
		const tsConfigContent = JSON.stringify({
			compilerOptions: {
				module: 'node16',
				target: 'ES2022',
				strictNullChecks: true,
				rootDir: './nonsense',
				lib: ['DOM', 'DOM.Iterable', 'ES2022'],
			},
			include: ['not-a-real-file.ts'],
			exclude: [],
		}, null, 2);
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
		await fs.writeFile(tsConfigPath, tsConfigContent, 'utf8');
		await $`node ./dist/cli --cwd ${cwd}`;
		await fs.writeFile(xoTsConfigPath, originalTsConfig);
	});

	// For some reason, this test fails on CI but not locally on my mac
	// the following test is identical with a dot file and it passes CI for some unknown reason
	// test.skip('ts rules properly split to avoid errors with cjs files when no options.files is set', async t => {
	// 	// Write the test.cjs file
	// 	const filePath = path.join(cwd, 'whatever.cjs');
	// 	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');

	// 	// Write and xo config file with ts rules
	// 	const xoConfigPath = path.join(cwd, 'xo.config.js');
	// 	const xoConfig = dedent`
	// 		export default [
	// 			{ ignores: "xo.config.js" },
	// 			{
	// 				rules: {
	// 					'@typescript-eslint/no-unused-vars': 'error',
	// 				}
	// 			}
	// 		]
	// 	`;

	// 	await fs.writeFile(xoConfigPath, xoConfig, 'utf8');

	// 	await t.notThrowsAsync($`node ./dist/cli --cwd ${cwd}`);
	// });

	test('applies type aware lint rules to .lintstagedrc.cjs', async t => {
		const cwd = await createProject(t);
		// Write the test.cjs file
		const filePath = path.join(cwd, '.lintstagedrc.cjs');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');

		// Write and xo config file with ts rules
		const xoConfigPath = path.join(cwd, 'xo.config.js');
		const xoConfig = dedent`
			export default [
				{ ignores: "xo.config.js" },
				{
					rules: {
						'@typescript-eslint/no-unsafe-call': 'error',
						'@typescript-eslint/no-unused-vars': 'error',
					}
				}
			]
		`;

		await fs.writeFile(xoConfigPath, xoConfig, 'utf8');

		await $`node ./dist/cli --cwd ${cwd}`;
	});

	test('gives helpful error message when config creates a circular dependency', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
		const xoConfigPath = path.join(cwd, 'xo.config.js');
		const xoConfig = dedent`
			import xo from './dist/index.js';

			export default [
				{space: true}
			]
		`;
		await fs.writeFile(xoConfigPath, xoConfig, 'utf8');
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd}`);
		assert.ok((error.stderr as string)?.includes('Error resolving XO config'));
	});

	test('Config errors bubble up from ESLint when incorrect config options are set', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
		const xoConfigPath = path.join(cwd, 'xo.config.js');
		const xoConfig = dedent`
			export default [
				{
					invalidOption: 'some invalid value',
					space: true
				}
			]
		`;
		await fs.writeFile(xoConfigPath, xoConfig, 'utf8');
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd}`);
		assert.ok((error.stderr as string)?.includes('ConfigError:') && (error.stderr as string)?.includes('Unexpected key "invalidOption" found'));
	});

	test('ts in nested directory', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'nested', 'src', 'test.ts');
		const baseTsConfigPath = path.join(cwd, 'tsconfig.json');
		const tsConfigNestedPath = path.join(cwd, 'nested', 'tsconfig.json');
		const tsconfigCachePath = path.join(cwd, 'node_modules', '.cache', 'xo-linter', 'tsconfig.xo.json');

		// Remove any previous cache file
		await fs.rm(tsconfigCachePath, {force: true});

		// Write the test.ts file
		await fs.mkdir(path.dirname(filePath), {recursive: true});
		await fs.writeFile(filePath, dedent`console.log('hello');\nconst test = 1;\n`, 'utf8');

		// Copy the base tsconfig to the nested directory
		await fs.copyFile(baseTsConfigPath, tsConfigNestedPath);
		await fs.rm(baseTsConfigPath);
		const tsconfig = JSON.parse(await fs.readFile(tsConfigNestedPath, 'utf8')) as TsConfigJson;
		if (tsconfig.compilerOptions) {
			tsconfig.compilerOptions.baseUrl = './';
		}

		tsconfig.include = ['src'];

		await fs.writeFile(tsConfigNestedPath, JSON.stringify(tsconfig, null, 2), 'utf8');
		// Add an xo config file in root dir
		const xoConfigPath = path.join(cwd, 'xo.config.js');
		const xoConfig = dedent`
			export default [
				{ ignores: "xo.config.js" },
				{
					rules: {
						'@typescript-eslint/no-unused-vars': 'off',
					}
				}
			]
		`;
		await fs.writeFile(xoConfigPath, xoConfig, 'utf8');
		await $`node ./dist/cli --cwd ${cwd}`;
		assert.ok(!(await pathExists(tsconfigCachePath)), 'tsconfig.xo.json should not be created in the cache directory when tsconfig.json is present in the nested directory');
	});

	test('handles mixed project structure with nested tsconfig and root ts files', async t => {
		const cwd = await createProject(t);
		// Set up nested TypeScript files with a tsconfig
		const nestedFilePath = path.join(cwd, 'nested', 'src', 'test.ts');
		const nestedFile2Path = path.join(cwd, 'nested', 'src', 'test2.ts');
		const baseTsConfigPath = path.join(cwd, 'tsconfig.json');
		const tsConfigNestedPath = path.join(cwd, 'nested', 'tsconfig.json');
		const tsconfigCachePath = path.join(cwd, 'node_modules', '.cache', 'xo-linter', 'tsconfig.xo.json');

		// Root ts file with no tsconfig
		const rootTsFilePath = path.join(cwd, 'root.ts');

		// Remove any previous cache file
		await fs.rm(tsconfigCachePath, {force: true});

		// Create directory structure and files
		await fs.mkdir(path.dirname(nestedFilePath), {recursive: true});
		await fs.writeFile(nestedFilePath, dedent`console.log('nested file 1');\nconst test1 = 1;\n`, 'utf8');
		await fs.writeFile(nestedFile2Path, dedent`console.log('nested file 2');\nconst test2 = 2;\n`, 'utf8');

		// Create the root TS file with no accompanying tsconfig
		await fs.writeFile(rootTsFilePath, dedent`console.log('root file');\nconst rootVar = 3;\n`, 'utf8');

		// Copy the base tsconfig to the nested directory only
		await fs.copyFile(baseTsConfigPath, tsConfigNestedPath);
		await fs.rm(baseTsConfigPath);
		const tsconfig = JSON.parse(await fs.readFile(tsConfigNestedPath, 'utf8')) as TsConfigJson;

		if (tsconfig.compilerOptions) {
			tsconfig.compilerOptions.baseUrl = './';
		}

		// Configure the nested tsconfig to include only the nested src directory
		tsconfig.include = ['src'];
		await fs.writeFile(tsConfigNestedPath, JSON.stringify(tsconfig, null, 2), 'utf8');

		// Add an xo config file in root dir
		const xoConfigPath = path.join(cwd, 'xo.config.js');
		const xoConfig = dedent`
			export default [
				{ignores: "xo.config.js"},
				{
					rules: {
						'@typescript-eslint/no-unused-vars': 'off',
					}
				}
			]
		`;
		await fs.writeFile(xoConfigPath, xoConfig, 'utf8');

		// Run XO on the entire directory structure - should handle unincluded files with in-memory programs
		await $`node ./dist/cli --cwd ${cwd}`;
	});

	test('handles basic TypeScript imports between files', async t => {
		const cwd = await createProject(t);
		// Create directories
		const srcDir = path.join(cwd, 'src');
		await fs.mkdir(srcDir, {recursive: true});

		// Create a module file to be imported
		const moduleFilePath = path.join(srcDir, 'module.ts');
		const moduleContent = dedent`
			export type Person = {
				name: string;
				age: number;
			};

			export const greet = (person: Person): string => \`Hello, \${person.name}! You are \${person.age} years old.\`;
		`
			+ '\n';
		await fs.writeFile(moduleFilePath, moduleContent, 'utf8');

		// Create a main file that imports from the module
		const mainFilePath = path.join(srcDir, 'main.ts');
		const mainFileContent = dedent`
			import {greet, type Person} from './module.js';

			const person: Person = {
				name: 'Alice',
				age: 30,
			};

			export const message = greet(person);
		`
			+ '\n';
		await fs.writeFile(mainFilePath, mainFileContent, 'utf8');

		// Create a simple tsconfig.json
		const tsconfigPath = path.join(cwd, 'tsconfig.json');
		const tsconfig = {
			compilerOptions: {
				target: 'ES2022',
				module: 'NodeNext',
				moduleResolution: 'NodeNext',
				strictNullChecks: true,
			},
			include: ['src/**/*'],
		};
		await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2), 'utf8');

		// Run XO on the project - should not throw because the imports are valid
		await $`node ./dist/cli --cwd ${cwd}`;

		// Test with an invalid import to verify error detection
		const brokenFilePath = path.join(srcDir, 'broken.ts');
		const brokenFileContent = dedent`
			import {nonExistentFunction} from './module.js';

			export const result = nonExistentFunction();
		`
			+ '\n';
		await fs.writeFile(brokenFilePath, brokenFileContent, 'utf8');

		// This should throw an error because the import doesn't exist in module.ts
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd}`);

		// Verify that the error is related to an import error
		assert.ok(
			(error.stderr as string)?.includes('@typescript-eslint/')
			|| (error.stdout as string)?.includes('@typescript-eslint/'),
			'Error should be reported for invalid import',
		);
	});

	test('handles TypeScript path aliases correctly', async t => {
		const cwd = await createProject(t);
		// Create a directory structure with source and utility files
		const srcDir = path.join(cwd, 'src');
		const utilsDir = path.join(cwd, 'utils');
		await fs.mkdir(srcDir, {recursive: true});
		await fs.mkdir(utilsDir, {recursive: true});

		// Create a utility file that will be imported using path alias
		const helperPath = path.join(utilsDir, 'helper.ts');
		const helperContent = dedent`
			export const helper = (value: string): string => value.toUpperCase();
		`
			+ '\n';
		await fs.writeFile(helperPath, helperContent, 'utf8');

		// Create a source file that imports the utility using the path alias
		const mainFilePath = path.join(srcDir, 'main.ts');
		const mainFileContent = dedent`
			import {helper} from '@utils/helper.js';

			export const result = helper('hello world');
		`
			+ '\n';
		await fs.writeFile(mainFilePath, mainFileContent, 'utf8');

		// Create a tsconfig.json with path aliases
		const tsconfigPath = path.join(cwd, 'tsconfig.json');
		const tsconfig = {
			compilerOptions: {
				target: 'ES2022',
				module: 'NodeNext',
				moduleResolution: 'NodeNext',
				baseUrl: '.',
				paths: {

					'@utils/*': ['utils/*'],
				},
				strictNullChecks: true,
			},
			include: ['src/**/*', 'utils/**/*'],
		};
		await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2), 'utf8');

		// Run XO on the project - should not throw because the imports should resolve correctly
		await $`node ./dist/cli --cwd ${cwd}`;

		// Create a broken import to verify that XO would catch unresolved imports
		const brokenFilePath = path.join(srcDir, 'broken.ts');
		const brokenFileContent = dedent`
			import {nonExistent} from '@utils/missing.js';

			export const result = nonExistent('test');\n
		`
			+ '\n';

		await fs.writeFile(brokenFilePath, brokenFileContent, 'utf8');

		// This should throw an error because the import doesn't resolve
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd}`);

		// Verify that the error is related to an unresolved import
		assert.ok(
			(error.stderr as string)?.includes('no-unsafe')
			|| (error.stdout as string)?.includes('no-unsafe'),
			'Error should mention unresolved import',
		);
	});

	test('respects custom tsconfig with manually set parserOptions.project', async t => {
		const cwd = await createProject(t);
		// Create necessary directories
		const srcDir = path.join(cwd, 'src');
		await fs.mkdir(srcDir, {recursive: true});

		// Create a custom tsconfig in a non-standard location
		const customTsConfigDir = path.join(cwd, 'config');
		await fs.mkdir(customTsConfigDir, {recursive: true});
		const customTsConfigPath = path.join(customTsConfigDir, 'tsconfig.custom.json');

		// Remove any standard tsconfig
		const defaultTsConfigPath = path.join(cwd, 'tsconfig.json');
		await fs.rm(defaultTsConfigPath, {force: true});

		// Define a strict custom tsconfig
		const customTsConfig: TsConfigJson = {
			compilerOptions: {
				target: 'ES2022',
				module: 'NodeNext',
				moduleResolution: 'NodeNext',
				strict: true,
				noImplicitAny: true,
				strictNullChecks: true,
				noUnusedLocals: true,
				baseUrl: '.',
			},
			include: ['../src/**/*'],
		};
		await fs.writeFile(customTsConfigPath, JSON.stringify(customTsConfig, null, 2), 'utf8');

		// Create a TypeScript file with a no-implicit-any error
		const tsFilePath = path.join(srcDir, 'test.ts');
		const tsFileContent = dedent`
			// This should trigger an error with noImplicitAny
			function process(value) {
				return value.toString();
			}

			console.log(process(42));
		`
			+ '\n';
		await fs.writeFile(tsFilePath, tsFileContent, 'utf8');

		// Create an XO config with a manually set parserOptions.project
		const xoConfigPath = path.join(cwd, 'xo.config.js');
		const xoConfig = dedent`
			export default [
				{ ignores: ["xo.config.js"] },
				{
					languageOptions: {
						parserOptions: {
							projectService: false,
							project: "./config/tsconfig.custom.json",
							tsconfigRootDir: "${cwd}",
						}
					}
				}
			]
		`;
		await fs.writeFile(xoConfigPath, xoConfig, 'utf8');

		// Run XO - should fail because of noImplicitAny from the custom tsconfig
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd}`);

		// Verify the error is specifically related to our custom tsconfig's noImplicitAny rule
		assert.ok(
			(error.stdout as string)?.includes('@typescript-eslint/no-unsafe')
			|| (error.stderr as string)?.includes('@typescript-eslint/no-unsafe'),
			'Error should mention no-unsafe rules',
		);

		// Make sure no cache tsconfig was created (since we've manually specified one)
		const tsconfigCachePath = path.join(cwd, 'node_modules', '.cache', 'xo-linter', 'tsconfig.xo.json');
		assert.ok(!(await pathExists(tsconfigCachePath)), 'Cache tsconfig should not be created when manually specifying parserOptions.project');

		// Fix the TypeScript file to pass the strict check
		const fixedTsContent = dedent`
			// This should pass with explicit type
			function process(value: number): string {
				return value.toString();
			}

			console.log(process(42));
		`
			+ '\n';
		await fs.writeFile(tsFilePath, fixedTsContent, 'utf8');

		// Run XO again - should pass now
		await $`node ./dist/cli --cwd ${cwd}`;
		// Test that the custom tsconfig is actually being used with the --print-config option
		const {stdout} = await $`node ./dist/cli --cwd ${cwd} --print-config=${tsFilePath}`;

		// Verify the path to our custom tsconfig appears in the printed config
		assert.ok(
			stdout.includes('tsconfig.custom.json'),
			'Printed config should include reference to custom tsconfig path',
		);
	});

	test('ts rules apply to js files when "files" is not set', async t => {
		const cwd = await createProject(t);
		// Create TS and JS files with similar content
		const tsFilePath = path.join(cwd, 'test.ts');
		const jsFilePath = path.join(cwd, 'test.js');
		const tsconfigCachePath = path.join(cwd, 'node_modules', '.cache', 'xo-linter', 'tsconfig.xo.json');
		// Remove any previous cache file
		await fs.rm(tsconfigCachePath, {force: true});
		// Remove the tsconfig so that neither file is covered by an existing tsconfig
		const tsConfigPath = path.join(cwd, 'tsconfig.json');
		await fs.rm(tsConfigPath, {force: true});

		// Create a TS file with a type annotation that would cause @typescript-eslint/naming-convention to trigger
		const fileContent = dedent`
			// This should trigger naming convention rules
			const Count = 5;
			console.log(Count);
		`
			+ '\n';

		// Write it as both TS and JS files
		await fs.writeFile(tsFilePath, fileContent, 'utf8');
		await fs.writeFile(jsFilePath, fileContent, 'utf8');

		// Create XO config that explicitly enables a TypeScript rule and a type aware ts rule
		const xoConfigPath = path.join(cwd, 'xo.config.js');
		const xoConfig = dedent`
			export default [
				{ignores: ["xo.config.js"] },
				{
					rules: {
						'@typescript-eslint/naming-convention': 'error',
						'@typescript-eslint/no-unsafe-assignment': 'error'
					}
				}
			]
		`;
		await fs.writeFile(xoConfigPath, xoConfig, 'utf8');

		// Run XO - should handle both TS and JS files with in-memory TypeScript programs
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd}`);
		assert.ok((error.stdout as string)?.includes('test.ts'), 'Error should be reported for the TypeScript file');
		assert.ok((error.stdout as string)?.includes('test.js'), 'Errors should be reported for the JavaScript file');
		assert.ok((error.stdout as string)?.includes('@typescript-eslint/naming-convention'), 'The specific TypeScript rule should be mentioned in the output');
	});

	test('ts rules apply to js files when "files" is set to a glob', async t => {
		const cwd = await createProject(t);
		// Create TS and JS files with similar content
		const tsFilePath = path.join(cwd, 'test.ts');
		const jsFilePath = path.join(cwd, 'test.js');
		const tsconfigCachePath = path.join(cwd, 'node_modules', '.cache', 'xo-linter', 'tsconfig.xo.json');
		// Remove any previous cache file
		await fs.rm(tsconfigCachePath, {force: true});
		// Remove the tsconfig so that neither file is covered by an existing tsconfig
		const tsConfigPath = path.join(cwd, 'tsconfig.json');
		await fs.rm(tsConfigPath, {force: true});

		// Create a TS file with a type annotation that would cause @typescript-eslint/naming-convention to trigger
		const fileContent = dedent`
			// This should trigger naming convention rules
			const Count = 5;
			console.log(Count);
		`
			+ '\n';

		// Write it as both TS and JS files
		await fs.writeFile(tsFilePath, fileContent, 'utf8');
		await fs.writeFile(jsFilePath, fileContent, 'utf8');

		// Create XO config that explicitly enables a TypeScript rule and a type aware ts rule
		const xoConfigPath = path.join(cwd, 'xo.config.js');
		const xoConfig = dedent`
			export default [
				{ignores: ["xo.config.js"] },
				{
					files: ['**/*.ts', '**/*.js'],
					rules: {
						'@typescript-eslint/naming-convention': 'error',
						'@typescript-eslint/no-unsafe-assignment': 'error'
					}
				}
			]
		`;
		await fs.writeFile(xoConfigPath, xoConfig, 'utf8');

		// Run XO - should handle both TS and JS files with in-memory TypeScript programs
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd}`);
		assert.ok((error.stdout as string)?.includes('test.ts'), 'Error should be reported for the TypeScript file');
		assert.ok((error.stdout as string)?.includes('test.js'), 'Errors should be reported for the JavaScript file');
		assert.ok((error.stdout as string)?.includes('@typescript-eslint/naming-convention'), 'The specific TypeScript rule should be mentioned in the output');
	});

	test('ts rules apply to js files when "files" is set to a file path', async t => {
		const cwd = await createProject(t);
		// Create TS and JS files with similar content
		const tsFilePath = path.join(cwd, 'test.ts');
		const jsFilePath = path.join(cwd, 'test.js');
		const tsconfigCachePath = path.join(cwd, 'node_modules', '.cache', 'xo-linter', 'tsconfig.xo.json');
		// Remove any previous cache file
		await fs.rm(tsconfigCachePath, {force: true});
		// Remove the tsconfig so that neither file is covered by an existing tsconfig
		const tsConfigPath = path.join(cwd, 'tsconfig.json');
		await fs.rm(tsConfigPath, {force: true});

		// Create a TS file with a type annotation that would cause @typescript-eslint/naming-convention to trigger
		const fileContent = dedent`
			// This should trigger naming convention rules
			const Count = 5;
			console.log(Count);
		`
			+ '\n';

		// Write it as both TS and JS files
		await fs.writeFile(tsFilePath, fileContent, 'utf8');
		await fs.writeFile(jsFilePath, fileContent, 'utf8');

		// Create XO config that explicitly enables a TypeScript rule and a type aware ts rule
		const xoConfigPath = path.join(cwd, 'xo.config.js');
		const xoConfig = dedent`
			export default [
				{ignores: ["xo.config.js"] },
				{
					files: ['test.ts', 'test.js'],
					rules: {
						'@typescript-eslint/naming-convention': 'error',
						'@typescript-eslint/no-unsafe-assignment': 'error'
					}
				}
			]
		`;
		await fs.writeFile(xoConfigPath, xoConfig, 'utf8');

		// Run XO - should handle both TS and JS files with in-memory TypeScript programs
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd}`);
		assert.ok((error.stdout as string)?.includes('test.ts'), 'Error should be reported for the TypeScript file');
		assert.ok((error.stdout as string)?.includes('test.js'), 'Errors should be reported for the JavaScript file');
		assert.ok((error.stdout as string)?.includes('@typescript-eslint/naming-convention'), 'The specific TypeScript rule should be mentioned in the output');
	});

	test('ts rules apply to js files when "files" is set to a relative file path', async t => {
		const cwd = await createProject(t);
		// Create src folder
		const srcDir = path.join(cwd, 'src');
		await fs.mkdir(srcDir, {recursive: true});
		// Create TS and JS files with similar content

		const tsFilePath = path.join(srcDir, 'test.ts');
		const jsFilePath = path.join(srcDir, 'test.js');
		const tsconfigCachePath = path.join(cwd, 'node_modules', '.cache', 'xo-linter', 'tsconfig.xo.json');
		// Remove any previous cache file
		await fs.rm(tsconfigCachePath, {force: true});
		// Remove the tsconfig so that neither file is covered by an existing tsconfig
		const tsConfigPath = path.join(cwd, 'tsconfig.json');
		await fs.rm(tsConfigPath, {force: true});

		// Create a TS file with a type annotation that would cause @typescript-eslint/naming-convention to trigger
		const fileContent = dedent`
			// This should trigger naming convention rules
			const Count = 5;
			console.log(Count);
		`
			+ '\n';

		// Write it as both TS and JS files
		await fs.writeFile(tsFilePath, fileContent, 'utf8');
		await fs.writeFile(jsFilePath, fileContent, 'utf8');

		// Create XO config that explicitly enables a TypeScript rule and a type aware ts rule
		const xoConfigPath = path.join(cwd, 'xo.config.js');
		const xoConfig = dedent`
			export default [
				{ignores: ["xo.config.js"] },
				{
					files: ['./src/test.ts', './src/test.js'],
					rules: {
						'@typescript-eslint/naming-convention': 'error',
						'@typescript-eslint/no-unsafe-assignment': 'error'
					}
				}
			]
		`;
		await fs.writeFile(xoConfigPath, xoConfig, 'utf8');

		// Run XO - should handle both TS and JS files with in-memory TypeScript programs
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd}`);
		assert.ok((error.stdout as string)?.includes('test.ts'), 'Error should be reported for the TypeScript file');
		assert.ok((error.stdout as string)?.includes('test.js'), 'Errors should be reported for the JavaScript file');
		assert.ok((error.stdout as string)?.includes('@typescript-eslint/naming-convention'), 'The specific TypeScript rule should be mentioned in the output');
	});

	test('ts rules apply to js files when "files" is set to a relative glob path', async t => {
		const cwd = await createProject(t);
		// Create src folder
		const srcDir = path.join(cwd, 'src');
		await fs.mkdir(srcDir, {recursive: true});
		// Create TS and JS files with similar content

		const tsFilePath = path.join(srcDir, 'test.ts');
		const jsFilePath = path.join(srcDir, 'test.js');
		const tsconfigCachePath = path.join(cwd, 'node_modules', '.cache', 'xo-linter', 'tsconfig.xo.json');
		// Remove any previous cache file
		await fs.rm(tsconfigCachePath, {force: true});
		// Remove the tsconfig so that neither file is covered by an existing tsconfig
		const tsConfigPath = path.join(cwd, 'tsconfig.json');
		await fs.rm(tsConfigPath, {force: true});

		// Create a TS file with a type annotation that would cause @typescript-eslint/naming-convention to trigger
		const fileContent = dedent`
			// This should trigger naming convention rules
			const Count = 5;
			console.log(Count);
		`
			+ '\n';

		// Write it as both TS and JS files
		await fs.writeFile(tsFilePath, fileContent, 'utf8');
		await fs.writeFile(jsFilePath, fileContent, 'utf8');

		// Create XO config that explicitly enables a TypeScript rule and a type aware ts rule
		const xoConfigPath = path.join(cwd, 'xo.config.js');
		const xoConfig = dedent`
			export default [
				{ignores: ["xo.config.js"] },
				{
					files: ['./src/*.ts', './src/*.js'],
					rules: {
						'@typescript-eslint/naming-convention': 'error',
						'@typescript-eslint/no-unsafe-assignment': 'error'
					}
				}
			]
		`;
		await fs.writeFile(xoConfigPath, xoConfig, 'utf8');

		// Run XO - should handle both TS and JS files with in-memory TypeScript programs
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd}`);
		assert.ok((error.stdout as string)?.includes('test.ts'), 'Error should be reported for the TypeScript file');
		assert.ok((error.stdout as string)?.includes('test.js'), 'Errors should be reported for the JavaScript file');
		assert.ok((error.stdout as string)?.includes('@typescript-eslint/naming-convention'), 'The specific TypeScript rule should be mentioned in the output');
	});

	// Supports a custom config file
	test('supports a custom config file with absolute path', async t => {
		const cwd = await createProject(t);
		// Create a simple JS file
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');

		// Create a custom XO config file
		const customConfigPath = path.join(cwd, 'custom.xo.config.js');
		const customConfig = dedent`
			export default [
				{ ignores: "xo.config.js" },
				{
					rules: {
						'no-console': 'error',
					}
				}
			]
		`;
		await fs.writeFile(customConfigPath, customConfig, 'utf8');

		// Run XO with the custom config file
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd} --config ${customConfigPath}`);
		assert.ok((error.stdout as string)?.includes('test.js'), 'Error should be reported for the test.js file');
		assert.ok((error.stdout as string)?.includes('no-console'), 'The specific rule should be mentioned in the output');
	});

	test('supports a custom config file with relative path', async t => {
		const cwd = await createProject(t);
		// Create a simple JS file
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');

		// Create a custom XO config file
		const customConfigPath = path.join(cwd, 'custom.xo.config.js');
		const customConfig = dedent`
			export default [
				{ ignores: "xo.config.js" },
				{
					rules: {
						'no-console': 'error',
					}
				}
			]
		`;
		await fs.writeFile(customConfigPath, customConfig, 'utf8');

		// Run XO with the custom config file with relative path
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd} --config ${path.relative(cwd, customConfigPath)}`);
		assert.ok((error.stdout as string)?.includes('test.js'), 'Error should be reported for the test.js file');
		assert.ok((error.stdout as string)?.includes('no-console'), 'The specific rule should be mentioned in the output');
	});

	test('supports a custom config file with relative dot slash path', async t => {
		const cwd = await createProject(t);
		// Create a simple JS file
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');

		// Create a custom XO config file
		const customConfigPath = path.join(cwd, 'custom.xo.config.js');
		const customConfig = dedent`
			export default [
				{ ignores: "xo.config.js" },
				{
					rules: {
						'no-console': 'error',
					}
				}
			]
		`;
		await fs.writeFile(customConfigPath, customConfig, 'utf8');

		// Run XO with the custom config file with relative path
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd} --config ./${path.relative(cwd, customConfigPath)}`);
		assert.ok((error.stdout as string)?.includes('test.js'), 'Error should be reported for the test.js file');
		assert.ok((error.stdout as string)?.includes('no-console'), 'The specific rule should be mentioned in the output');
	});

	// Supports custom config file with ts path
	test('supports a custom config file with absolute path for TypeScript', async t => {
		const cwd = await createProject(t);
		// Create a simple TS file
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');

		// Create a custom XO config file
		const customConfigPath = path.join(cwd, 'custom.xo.config.ts');
		const customConfig = dedent`
			export default [
				{ ignores: "custom.xo.config.ts" },
				{
					rules: {
						'no-console': 'error',
					}
				}
			]
		`;
		await fs.writeFile(customConfigPath, customConfig, 'utf8');

		// Run XO with the custom config file
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd} --config ${customConfigPath}`);
		assert.ok((error.stdout as string)?.includes('test.js'), 'Error should be reported for the test.js file');
		assert.ok((error.stdout as string)?.includes('no-console'), 'The specific TypeScript rule should be mentioned in the output');
	});

	// Supports custom config file with ts path
	test('supports a custom config file with relative path for TypeScript', async t => {
		const cwd = await createProject(t);
		// Create a simple TS file
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');

		// Create a custom XO config file
		const customConfigPath = path.join(cwd, 'custom.xo.config.ts');
		const customConfig = dedent`
			export default [
				{ ignores: "custom.xo.config.ts" },
				{
					rules: {
						'no-console': 'error',
					}
				}
			]
		`;
		await fs.writeFile(customConfigPath, customConfig, 'utf8');

		// Run XO with the custom config file
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd} --config ${path.relative(cwd, customConfigPath)}`);
		assert.ok((error.stdout as string)?.includes('test.js'), 'Error should be reported for the test.js file');
		assert.ok((error.stdout as string)?.includes('no-console'), 'The specific TypeScript rule should be mentioned in the output');
	});
	// Supports custom config file with ts path
	test('supports a custom config file with relative dot slash path for TypeScript', async t => {
		const cwd = await createProject(t);
		// Create a simple TS file
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');

		// Create a custom XO config file
		const customConfigPath = path.join(cwd, 'custom.xo.config.ts');
		const customConfig = dedent`
			export default [
				{ ignores: "custom.xo.config.ts" },
				{
					rules: {
						'no-console': 'error',
					}
				}
			]
		`;
		await fs.writeFile(customConfigPath, customConfig, 'utf8');

		// Run XO with the custom config file
		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd} --config ./${path.relative(cwd, customConfigPath)}`);
		assert.ok((error.stdout as string)?.includes('test.js'), 'Error should be reported for the test.js file');
		assert.ok((error.stdout as string)?.includes('no-console'), 'The specific TypeScript rule should be mentioned in the output');
	});

	test('replaces cache file with directory when file exists at cache path', async t => {
		const cwd = await createProject(t);
		// Create a simple TS file that will trigger cache creation
		const filePath = path.join(cwd, 'test.ts');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');

		// Remove the default tsconfig to force cache creation
		const tsConfigPath = path.join(cwd, 'tsconfig.json');
		await fs.rm(tsConfigPath, {force: true});

		// Create the cache directory structure up to the parent
		const cacheParentDir = path.join(cwd, 'node_modules', '.cache');
		await fs.mkdir(cacheParentDir, {recursive: true});

		// Create a FILE at the path where XO needs to create a directory
		const cacheDir = path.join(cacheParentDir, 'xo-linter');
		await fs.writeFile(cacheDir, 'this is a file that should be replaced with a directory', 'utf8');

		// Verify the file exists before running XO
		const statsBeforeRun = await fs.stat(cacheDir);
		assert.ok(statsBeforeRun.isFile(), 'Cache path should initially be a file');

		// Run XO - this should handle the file-to-directory conversion
		await $`node ./dist/cli --cwd ${cwd}`;

		// Verify the cache path is now a directory
		const statsAfterRun = await fs.stat(cacheDir);
		assert.ok(statsAfterRun.isDirectory(), 'Cache path should now be a directory');

		// Verify the eslint cache file was created
		const cachedFiles = await fs.readdir(cacheDir);
		assert.ok(cachedFiles.some(file => file.startsWith('.cache')), 'ESLint cache should exist');
	});

	test('prettier validation detects semicolon conflicts', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, 'const x = true\n', 'utf8'); // No semicolon

		// XO: no semicolons, Prettier: semicolons = conflict
		const packageJson = {
			xo: {
				semicolon: false,
				prettier: true,
			},
		};
		await fs.writeFile(path.join(cwd, 'package.json'), JSON.stringify(packageJson), 'utf8');
		await fs.writeFile(path.join(cwd, '.prettierrc'), '{"semi": true}', 'utf8');

		const error = await rejectionOf($`node ./dist/cli --cwd ${cwd}`);
		assert.ok(error.message.includes('semicolon'));
	});

	test('xo --max-warnings=0 fails when file has warnings', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');

		const xoConfigPath = path.join(cwd, 'xo.config.js');
		const xoConfig = dedent`
			export default [
				{ignores: ['xo.config.js']},
				{
					rules: {
						'no-console': 'warn',
					}
				}
			]
		`;
		await fs.writeFile(xoConfigPath, xoConfig, 'utf8');

		// eslint-disable-next-line @typescript-eslint/naming-convention
		const error = await rejectionOf($({env: {...process.env, GITHUB_ACTIONS: ''}})`node ./dist/cli --cwd ${cwd} --max-warnings=0`);
		assert.ok((error.stderr as string)?.includes('XO found too many warnings (maximum: 0).'));
	});

	test('xo --max-warnings=1 succeeds when warning count is within threshold', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');

		const xoConfigPath = path.join(cwd, 'xo.config.js');
		const xoConfig = dedent`
			export default [
				{ignores: ['xo.config.js']},
				{
					rules: {
						'no-console': 'warn',
					}
				}
			]
		`;
		await fs.writeFile(xoConfigPath, xoConfig, 'utf8');

		// eslint-disable-next-line @typescript-eslint/naming-convention
		await $({env: {...process.env, GITHUB_ACTIONS: ''}})`node ./dist/cli --cwd ${cwd} --max-warnings=1`;
	});

	test('xo --max-warnings=0 succeeds when file has no warnings', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');

		await $`node ./dist/cli --cwd ${cwd} --max-warnings=0`;
	});

	test('xo default does not fail on warnings', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');

		const xoConfigPath = path.join(cwd, 'xo.config.js');
		const xoConfig = dedent`
			export default [
				{ignores: ['xo.config.js']},
				{
					rules: {
						'no-console': 'warn',
					}
				}
			]
		`;
		await fs.writeFile(xoConfigPath, xoConfig, 'utf8');

		// eslint-disable-next-line @typescript-eslint/naming-convention
		await $({env: {...process.env, GITHUB_ACTIONS: ''}})`node ./dist/cli --cwd ${cwd}`;
	});

	test('xo hides warnings when file has both errors and warnings', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`
				var x = 1;
				console.log('hello');
			\n
		`, 'utf8');

		const xoConfigPath = path.join(cwd, 'xo.config.js');
		const xoConfig = dedent`
			export default [
				{ignores: ['xo.config.js']},
				{
					rules: {
						'no-console': 'error',
						'no-var': 'warn',
					}
				}
			]
		`;
		await fs.writeFile(xoConfigPath, xoConfig, 'utf8');

		// eslint-disable-next-line @typescript-eslint/naming-convention
		const error = await rejectionOf($({env: {...process.env, GITHUB_ACTIONS: ''}})`node ./dist/cli --cwd ${cwd}`);
		assert.ok((error.stdout as string)?.includes('no-console'), 'Error should appear in output');
		assert.ok(!(error.stdout as string)?.includes('no-var'), 'Warning should be hidden when errors exist');
	});

	test('xo shows warnings when file has both errors and warnings with --max-warnings', async t => {
		const cwd = await createProject(t);
		const filePath = path.join(cwd, 'test.js');
		await fs.writeFile(filePath, dedent`
				var x = 1;
				console.log('hello');
			\n
		`, 'utf8');

		const xoConfigPath = path.join(cwd, 'xo.config.js');
		const xoConfig = dedent`
			export default [
				{ignores: ['xo.config.js']},
				{
					rules: {
						'no-console': 'error',
						'no-var': 'warn',
					}
				}
			]
		`;
		await fs.writeFile(xoConfigPath, xoConfig, 'utf8');

		// eslint-disable-next-line @typescript-eslint/naming-convention
		const error = await rejectionOf($({env: {...process.env, GITHUB_ACTIONS: ''}})`node ./dist/cli --cwd ${cwd} --max-warnings=0`);
		assert.ok((error.stdout as string)?.includes('no-console'), 'Error should appear in output');
		assert.ok((error.stdout as string)?.includes('no-var'), 'Warning should appear when --max-warnings is set');
	});

	test('xo does not hang when node_modules is missing', async t => {
		const cwd = await createProject(t);
		const noModulesCwd = path.join(cwd, 'no-modules');
		await fs.mkdir(noModulesCwd, {recursive: true});
		await fs.writeFile(path.join(noModulesCwd, 'package.json'), '{}', 'utf8');
		await fs.writeFile(path.join(noModulesCwd, 'test.js'), 'console.log(\'hello\');\n', 'utf8');

		await $`node ./dist/cli --cwd ${noModulesCwd}`;
	});
});
