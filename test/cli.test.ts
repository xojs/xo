/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import fs from 'node:fs/promises';
import path from 'node:path';
import _test, {type TestFn} from 'ava'; // eslint-disable-line ava/use-test
import dedent from 'dedent';
import {$, type ExecaError} from 'execa';
import {pathExists} from 'path-exists';
import {type TsConfigJson} from 'get-tsconfig';
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

test('xo --print-config relative path', async t => {
	const fileName = 'test.ts';
	const filePath = path.join(t.context.cwd, fileName);
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	const {stdout} = await $`node ./dist/cli --cwd ${t.context.cwd} --print-config=${fileName}`;
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const config = JSON.parse(stdout);
	t.true(typeof config === 'object');
	t.true('rules' in config);
});

test('xo --print-config no path', async t => {
	const {stderr}: ExecaError = await t.throwsAsync($`node ./dist/cli --cwd ${t.context.cwd} --print-config`);
	t.is('The `--print-config` flag must be used with exactly one filename', stderr?.toString() ?? '');
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
	const results: unknown[] = JSON.parse(error?.stdout?.toString() ?? '');

	t.true(Array.isArray(results));
	t.is(results.length, 1);
	t.is(typeof results[0], 'object');
});

test('xo --stdin --stdin-filename=test.ts --fix', async t => {
	const {stdout} = await $`echo ${'const x: boolean = true'}`.pipe`node ./dist/cli --cwd=${t.context.cwd} --stdin --stdin-filename=test.ts --fix`;
	t.is(stdout, 'const x = true;');
});

test('xo lints ts files with no tsconfig.json', async t => {
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

test('xo lints ts files explicitly excluded from tsconfig.json', async t => {
	const filePath = path.join(t.context.cwd, 'test.ts');
	const tsConfigPath = path.join(t.context.cwd, 'tsconfig.json');
	const xoTsConfigPath = path.join(t.context.cwd, 'tsconfig.xo.json');
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
	await t.notThrowsAsync($`node ./dist/cli --cwd ${t.context.cwd}`);
	await fs.writeFile(xoTsConfigPath, originalTsConfig);
});

test('xo lints ts files implicitly excluded from tsconfig.json', async t => {
	const filePath = path.join(t.context.cwd, 'test.ts');
	const tsConfigPath = path.join(t.context.cwd, 'tsconfig.json');
	const xoTsConfigPath = path.join(t.context.cwd, 'tsconfig.xo.json');
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
	await t.notThrowsAsync($`node ./dist/cli --cwd ${t.context.cwd}`);
	await fs.writeFile(xoTsConfigPath, originalTsConfig);
});

test('xo lints ts files implicitly excluded from tsconfig.json with baseUrl', async t => {
	const filePath = path.join(t.context.cwd, 'test.ts');
	const tsConfigPath = path.join(t.context.cwd, 'tsconfig.json');
	const xoTsConfigPath = path.join(t.context.cwd, 'tsconfig.xo.json');
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
	await t.notThrowsAsync($`node ./dist/cli --cwd ${t.context.cwd}`);
	await fs.writeFile(xoTsConfigPath, originalTsConfig);
});

test('xo lints ts files implicitly excluded from tsconfig.json with rootDir', async t => {
	const filePath = path.join(t.context.cwd, 'test.ts');
	const tsConfigPath = path.join(t.context.cwd, 'tsconfig.json');
	const xoTsConfigPath = path.join(t.context.cwd, 'tsconfig.xo.json');
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
	await t.notThrowsAsync($`node ./dist/cli --cwd ${t.context.cwd}`);
	await fs.writeFile(xoTsConfigPath, originalTsConfig);
});

// For some reason, this test fails on CI but not locally on my mac
// the following test is identical with a dot file and it passes CI for some unknown reason
test.skip('ts rules properly split to avoid errors with cjs files when no options.files is set', async t => {
	// Write the test.cjs file
	const filePath = path.join(t.context.cwd, 'whatever.cjs');
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');

	// Write and xo config file with ts rules
	const xoConfigPath = path.join(t.context.cwd, 'xo.config.js');
	const xoConfig = dedent`
		export default [
			{ ignores: "xo.config.js" },
			{
				rules: {
					'@typescript-eslint/no-unused-vars': 'error',
				}
			}
		]
	`;

	await fs.writeFile(xoConfigPath, xoConfig, 'utf8');

	await t.notThrowsAsync($`node ./dist/cli --cwd ${t.context.cwd}`);
});

test('applies type aware lint rules to .lintstagedrc.cjs', async t => {
	// Write the test.cjs file
	const filePath = path.join(t.context.cwd, '.lintstagedrc.cjs');
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');

	// Write and xo config file with ts rules
	const xoConfigPath = path.join(t.context.cwd, 'xo.config.js');
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

	await t.notThrowsAsync($`node ./dist/cli --cwd ${t.context.cwd}`);
});

test('gives helpful error message when config creates a circular dependency', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	const xoConfigPath = path.join(t.context.cwd, 'xo.config.js');
	const xoConfig = dedent`
		import xo from './dist/index.js';

		export default [
			{space: true}
		]
	`;
	await fs.writeFile(xoConfigPath, xoConfig, 'utf8');
	const error = await t.throwsAsync<ExecaError>($`node ./dist/cli --cwd ${t.context.cwd}`);
	t.true((error.stderr as string)?.includes('Error resolving XO config'));
});

test('Config errors bubble up from ESLint when incorrect config options are set', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');
	const xoConfigPath = path.join(t.context.cwd, 'xo.config.js');
	const xoConfig = dedent`
		export default [
			{
				invalidOption: 'some invalid value',
				space: true
			}
		]
	`;
	await fs.writeFile(xoConfigPath, xoConfig, 'utf8');
	const error = await t.throwsAsync<ExecaError>($`node ./dist/cli --cwd ${t.context.cwd}`);
	t.true((error.stderr as string)?.includes('ConfigError:') && (error.stderr as string)?.includes('Unexpected key "invalidOption" found'));
});

test('ts in nested directory', async t => {
	const filePath = path.join(t.context.cwd, 'nested', 'src', 'test.ts');
	const baseTsConfigPath = path.join(t.context.cwd, 'tsconfig.json');
	const tsConfigNestedPath = path.join(t.context.cwd, 'nested', 'tsconfig.json');
	const tsconfigCachePath = path.join(t.context.cwd, 'node_modules', '.cache', 'xo-linter', 'tsconfig.xo.json');

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
	const xoConfigPath = path.join(t.context.cwd, 'xo.config.js');
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
	await t.notThrowsAsync($`node ./dist/cli --cwd ${t.context.cwd}`);
	t.false(await pathExists(tsconfigCachePath), 'tsconfig.xo.json should not be created in the cache directory when tsconfig.json is present in the nested directory');
});

test('handles mixed project structure with nested tsconfig and root ts files', async t => {
	// Set up nested TypeScript files with a tsconfig
	const nestedFilePath = path.join(t.context.cwd, 'nested', 'src', 'test.ts');
	const nestedFile2Path = path.join(t.context.cwd, 'nested', 'src', 'test2.ts');
	const baseTsConfigPath = path.join(t.context.cwd, 'tsconfig.json');
	const tsConfigNestedPath = path.join(t.context.cwd, 'nested', 'tsconfig.json');
	const tsconfigCachePath = path.join(t.context.cwd, 'node_modules', '.cache', 'xo-linter', 'tsconfig.xo.json');

	// Root ts file with no tsconfig
	const rootTsFilePath = path.join(t.context.cwd, 'root.ts');

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
	const xoConfigPath = path.join(t.context.cwd, 'xo.config.js');
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
	await t.notThrowsAsync($`node ./dist/cli --cwd ${t.context.cwd}`);
});

test('handles basic TypeScript imports between files', async t => {
	const {cwd} = t.context;

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
	await t.notThrowsAsync(
		$`node ./dist/cli --cwd ${cwd}`,
		'XO should successfully lint files with basic imports',
	);

	// Test with an invalid import to verify error detection
	const brokenFilePath = path.join(srcDir, 'broken.ts');
	const brokenFileContent = dedent`
		import {nonExistentFunction} from './module.js';

		export const result = nonExistentFunction();
	`
		+ '\n';
	await fs.writeFile(brokenFilePath, brokenFileContent, 'utf8');

	// This should throw an error because the import doesn't exist in module.ts
	const error = await t.throwsAsync<ExecaError>($`node ./dist/cli --cwd ${cwd}`);

	// Verify that the error is related to an import error
	t.true(
		(error.stderr as string)?.includes('@typescript-eslint/')
		|| (error.stdout as string)?.includes('@typescript-eslint/'),
		'Error should be reported for invalid import',
	);
});

test('handles TypeScript path aliases correctly', async t => {
	const {cwd} = t.context;

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
				// eslint-disable-next-line @typescript-eslint/naming-convention
				'@utils/*': ['utils/*'],
			},
			strictNullChecks: true,
		},
		include: ['src/**/*', 'utils/**/*'],
	};
	await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2), 'utf8');

	// Run XO on the project - should not throw because the imports should resolve correctly
	await t.notThrowsAsync(
		$`node ./dist/cli --cwd ${cwd}`,
		'XO should successfully lint files with path aliases',
	);

	// Create a broken import to verify that XO would catch unresolved imports
	const brokenFilePath = path.join(srcDir, 'broken.ts');
	const brokenFileContent = dedent`
		import {nonExistent} from '@utils/missing.js';

		export const result = nonExistent('test');\n
	`
		+ '\n';

	await fs.writeFile(brokenFilePath, brokenFileContent, 'utf8');

	// This should throw an error because the import doesn't resolve
	const error = await t.throwsAsync<ExecaError>($`node ./dist/cli --cwd ${cwd}`);

	// Verify that the error is related to an unresolved import
	t.true(
		(error.stderr as string)?.includes('no-unsafe')
		|| (error.stdout as string)?.includes('no-unsafe'),
		'Error should mention unresolved import',
	);
});

test('respects custom tsconfig with manually set parserOptions.project', async t => {
	const {cwd} = t.context;

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
	const error = await t.throwsAsync<ExecaError>($`node ./dist/cli --cwd ${cwd}`);

	// Verify the error is specifically related to our custom tsconfig's noImplicitAny rule
	t.true(
		(error.stdout as string)?.includes('@typescript-eslint/no-unsafe')
		|| (error.stderr as string)?.includes('@typescript-eslint/no-unsafe'),
		'Error should mention no-unsafe rules',
	);

	// Make sure no cache tsconfig was created (since we've manually specified one)
	const tsconfigCachePath = path.join(cwd, 'node_modules', '.cache', 'xo-linter', 'tsconfig.xo.json');
	t.false(await pathExists(tsconfigCachePath), 'Cache tsconfig should not be created when manually specifying parserOptions.project');

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
	await t.notThrowsAsync(
		$`node ./dist/cli --cwd ${cwd}`,
		'XO should successfully lint files with manually specified tsconfig',
	);
	// Test that the custom tsconfig is actually being used with the --print-config option
	const {stdout} = await $`node ./dist/cli --cwd ${cwd} --print-config=${tsFilePath}`;

	// Verify the path to our custom tsconfig appears in the printed config
	t.true(
		stdout.includes('tsconfig.custom.json'),
		'Printed config should include reference to custom tsconfig path',
	);
});

test('ts rules apply to js files when "files" is not set', async t => {
	const {cwd} = t.context;
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
	const error = await t.throwsAsync<ExecaError>($`node ./dist/cli --cwd ${cwd}`);
	t.true((error.stdout as string)?.includes('test.ts'), 'Error should be reported for the TypeScript file');
	t.true((error.stdout as string)?.includes('test.js'), 'Errors should be reported for the JavaScript file');
	t.true((error.stdout as string)?.includes('@typescript-eslint/naming-convention'), 'The specific TypeScript rule should be mentioned in the output');
});

test('ts rules apply to js files when "files" is set to a glob', async t => {
	const {cwd} = t.context;
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
	const error = await t.throwsAsync<ExecaError>($`node ./dist/cli --cwd ${cwd}`);
	t.true((error.stdout as string)?.includes('test.ts'), 'Error should be reported for the TypeScript file');
	t.true((error.stdout as string)?.includes('test.js'), 'Errors should be reported for the JavaScript file');
	t.true((error.stdout as string)?.includes('@typescript-eslint/naming-convention'), 'The specific TypeScript rule should be mentioned in the output');
});

test('ts rules apply to js files when "files" is set to a file path', async t => {
	const {cwd} = t.context;
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
	const error = await t.throwsAsync<ExecaError>($`node ./dist/cli --cwd ${cwd}`);
	t.true((error.stdout as string)?.includes('test.ts'), 'Error should be reported for the TypeScript file');
	t.true((error.stdout as string)?.includes('test.js'), 'Errors should be reported for the JavaScript file');
	t.true((error.stdout as string)?.includes('@typescript-eslint/naming-convention'), 'The specific TypeScript rule should be mentioned in the output');
});

test('ts rules apply to js files when "files" is set to a relative file path', async t => {
	const {cwd} = t.context;

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
	const error = await t.throwsAsync<ExecaError>($`node ./dist/cli --cwd ${cwd}`);
	t.true((error.stdout as string)?.includes('test.ts'), 'Error should be reported for the TypeScript file');
	t.true((error.stdout as string)?.includes('test.js'), 'Errors should be reported for the JavaScript file');
	t.true((error.stdout as string)?.includes('@typescript-eslint/naming-convention'), 'The specific TypeScript rule should be mentioned in the output');
});

test('ts rules apply to js files when "files" is set to a relative glob path', async t => {
	const {cwd} = t.context;

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
	const error = await t.throwsAsync<ExecaError>($`node ./dist/cli --cwd ${cwd}`);
	t.true((error.stdout as string)?.includes('test.ts'), 'Error should be reported for the TypeScript file');
	t.true((error.stdout as string)?.includes('test.js'), 'Errors should be reported for the JavaScript file');
	t.true((error.stdout as string)?.includes('@typescript-eslint/naming-convention'), 'The specific TypeScript rule should be mentioned in the output');
});

// Supports a custom config file
test('supports a custom config file with absolute path', async t => {
	const {cwd} = t.context;

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
	const error = await t.throwsAsync<ExecaError>($`node ./dist/cli --cwd ${cwd} --config ${customConfigPath}`);
	t.true((error.stdout as string)?.includes('test.js'), 'Error should be reported for the test.js file');
	t.true((error.stdout as string)?.includes('no-console'), 'The specific rule should be mentioned in the output');
});

test('supports a custom config file with relative path', async t => {
	const {cwd} = t.context;

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
	const error = await t.throwsAsync<ExecaError>($`node ./dist/cli --cwd ${cwd} --config ${path.relative(cwd, customConfigPath)}`);
	t.true((error.stdout as string)?.includes('test.js'), 'Error should be reported for the test.js file');
	t.true((error.stdout as string)?.includes('no-console'), 'The specific rule should be mentioned in the output');
});

test('supports a custom config file with relative dot slash path', async t => {
	const {cwd} = t.context;

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
	const error = await t.throwsAsync<ExecaError>($`node ./dist/cli --cwd ${cwd} --config ./${path.relative(cwd, customConfigPath)}`);
	t.true((error.stdout as string)?.includes('test.js'), 'Error should be reported for the test.js file');
	t.true((error.stdout as string)?.includes('no-console'), 'The specific rule should be mentioned in the output');
});

// Supports custom config file with ts path
test('supports a custom config file with absolute path for TypeScript', async t => {
	const {cwd} = t.context;

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
	const error = await t.throwsAsync<ExecaError>($`node ./dist/cli --cwd ${cwd} --config ${customConfigPath}`);
	t.true((error.stdout as string)?.includes('test.js'), 'Error should be reported for the test.js file');
	t.true((error.stdout as string)?.includes('no-console'), 'The specific TypeScript rule should be mentioned in the output');
});

// Supports custom config file with ts path
test('supports a custom config file with relative path for TypeScript', async t => {
	const {cwd} = t.context;

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
	const error = await t.throwsAsync<ExecaError>($`node ./dist/cli --cwd ${cwd} --config ${path.relative(cwd, customConfigPath)}`);
	t.true((error.stdout as string)?.includes('test.js'), 'Error should be reported for the test.js file');
	t.true((error.stdout as string)?.includes('no-console'), 'The specific TypeScript rule should be mentioned in the output');
});
// Supports custom config file with ts path
test('supports a custom config file with relative dot slash path for TypeScript', async t => {
	const {cwd} = t.context;

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
	const error = await t.throwsAsync<ExecaError>($`node ./dist/cli --cwd ${cwd} --config ./${path.relative(cwd, customConfigPath)}`);
	t.true((error.stdout as string)?.includes('test.js'), 'Error should be reported for the test.js file');
	t.true((error.stdout as string)?.includes('no-console'), 'The specific TypeScript rule should be mentioned in the output');
});

test('replaces cache file with directory when file exists at cache path', async t => {
	const {cwd} = t.context;

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
	t.true(statsBeforeRun.isFile(), 'Cache path should initially be a file');

	// Run XO - this should handle the file-to-directory conversion
	await t.notThrowsAsync($`node ./dist/cli --cwd ${cwd}`);

	// Verify the cache path is now a directory
	const statsAfterRun = await fs.stat(cacheDir);
	t.true(statsAfterRun.isDirectory(), 'Cache path should now be a directory');

	// Verify the eslint cache file was created
	const cachedFiles = await fs.readdir(cacheDir);
	t.true(cachedFiles.some(file => file.startsWith('.cache')), 'ESLint cache should exist');
});

test('prettier validation detects semicolon conflicts', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, 'const x = true\n', 'utf8'); // No semicolon

	// XO: no semicolons, Prettier: semicolons = conflict
	const packageJson = {
		xo: {
			semicolon: false,
			prettier: true,
		},
	};
	await fs.writeFile(path.join(t.context.cwd, 'package.json'), JSON.stringify(packageJson), 'utf8');
	await fs.writeFile(path.join(t.context.cwd, '.prettierrc'), '{"semi": true}', 'utf8');

	const error = await t.throwsAsync($`node ./dist/cli --cwd ${t.context.cwd}`);
	t.true(error.message.includes('semicolon'));
});
