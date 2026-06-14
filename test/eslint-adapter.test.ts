import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import test, {type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import dedent from 'dedent';
import {$} from 'execa';
import {copyTestProject} from './helpers/copy-test-project.js';

const adapterModuleUrl = new URL('../lib/eslint-adapter.js', import.meta.url).href;
const eslintModuleUrl = new URL('../../node_modules/eslint/lib/api.js', import.meta.url).href;

/**
Creates an isolated copy of the test project for a single test and removes it afterwards.

@returns The path to the test project.
*/
const createProject = async (t: TestContext): Promise<string> => {
	const cwd = await copyTestProject();
	t.after(async () => {
		await fs.rm(cwd, {recursive: true, force: true});
	});
	return cwd;
};

const writeXoConfig = async (cwd: string, config: string): Promise<void> => {
	await fs.writeFile(path.join(cwd, 'xo.config.js'), dedent(config), 'utf8');
};

const writeEslintConfig = async (cwd: string): Promise<void> => {
	await fs.writeFile(path.join(cwd, 'eslint.config.js'), 'export {default} from \'xo/eslint-adapter\';\n', 'utf8');
};

const isRuleIdMatrix = (value: unknown): value is string[][] => {
	if (!Array.isArray(value)) {
		return false;
	}

	return value.every(result => Array.isArray(result) && result.every(ruleId => typeof ruleId === 'string'));
};

const lintWithAdapter = async ({cwd, lintCwd = cwd, files, argv = []}: {
	cwd: string;
	lintCwd?: string;
	files: string[];
	argv?: string[];
}): Promise<string[][]> => {
	const script = dedent`
		import process from 'node:process';
		import {ESLint} from ${JSON.stringify(eslintModuleUrl)};

		process.argv = ${JSON.stringify(['node', ...argv])};

		const {default: adapterConfig} = await import(${JSON.stringify(`${adapterModuleUrl}?${randomUUID()}`)});
		const eslint = new ESLint({
			cwd: ${JSON.stringify(lintCwd)},
			overrideConfig: adapterConfig,
			overrideConfigFile: true,
		});
		const results = await eslint.lintFiles(${JSON.stringify(files)});
		console.log(JSON.stringify(results.map(result => result.messages.flatMap(message => typeof message.ruleId === 'string' ? [message.ruleId] : []))));
	`;
	const {stdout} = await $({cwd})`node --input-type=module -e ${script}`;
	const ruleIds: unknown = JSON.parse(stdout);

	if (!isRuleIdMatrix(ruleIds)) {
		throw new TypeError('Invalid lint result payload');
	}

	return ruleIds;
};

test('adapter keeps XO ts fallback for projects without tsconfig.json', async t => {
	const cwd = await createProject(t);
	const filePath = path.join(cwd, 'test.ts');
	await fs.rm(path.join(cwd, 'tsconfig.json'));
	await fs.writeFile(filePath, dedent`console.log('hello')\n`, 'utf8');

	const [ruleIds = []] = await lintWithAdapter({
		cwd,
		files: [filePath],
	});

	assert.ok(ruleIds.includes('@stylistic/semi'));
});

test('adapter resolves root xo config from nested cwd using eslint config auto-discovery', async t => {
	const cwd = await createProject(t);
	const packageDirectory = path.join(cwd, 'packages', 'foo');
	const filePath = path.join(packageDirectory, 'test.js');
	await fs.mkdir(packageDirectory, {recursive: true});
	await writeEslintConfig(cwd);
	await writeXoConfig(cwd, `
		export default [
			{
				semicolon: false,
			},
		];
	`);
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');

	const [ruleIds = []] = await lintWithAdapter({
		cwd: packageDirectory,
		files: [filePath],
	});

	assert.ok(ruleIds.includes('@stylistic/semi'));
});

test('adapter preprocesses typed rules so JS files lint like XO', async t => {
	const cwd = await createProject(t);
	const filePath = path.join(cwd, 'test.js');
	await fs.writeFile(filePath, dedent`Promise.resolve(1);\n`, 'utf8');
	await writeXoConfig(cwd, `
		export default [
			{
				rules: {
					'@typescript-eslint/no-floating-promises': 'error',
				},
			},
		];
	`);

	const [ruleIds = []] = await lintWithAdapter({
		cwd,
		files: [filePath],
	});

	assert.ok(ruleIds.includes('@typescript-eslint/no-floating-promises'));
});

test('adapter applies the Prettier option from the XO config', async t => {
	const cwd = await createProject(t);
	const filePath = path.join(cwd, 'test.js');
	// Double quotes violate XO's Prettier style (`singleQuote: true`).
	await fs.writeFile(filePath, dedent`console.log("hello");\n`, 'utf8');
	await writeXoConfig(cwd, `
		export default [
			{
				prettier: true,
			},
		];
	`);

	const [ruleIds = []] = await lintWithAdapter({
		cwd,
		files: [filePath],
	});

	assert.ok(ruleIds.includes('prettier/prettier'));
});

test('adapter resolves xo config relative to the eslint config path', async t => {
	const cwd = await createProject(t);
	const packageDirectory = path.join(cwd, 'packages', 'foo');
	const filePath = path.join(packageDirectory, 'test.js');
	await fs.mkdir(packageDirectory, {recursive: true});
	await writeXoConfig(cwd, `
		export default [
			{
				semicolon: true,
			},
		];
	`);
	await writeXoConfig(packageDirectory, `
		export default [
			{
				semicolon: false,
			},
		];
	`);
	await fs.writeFile(filePath, dedent`console.log('hello');\n`, 'utf8');

	const [ruleIds = []] = await lintWithAdapter({
		cwd,
		lintCwd: packageDirectory,
		files: [filePath],
		argv: ['--config', 'packages/foo/eslint.config.js'],
	});

	assert.ok(ruleIds.includes('@stylistic/semi'));
});
