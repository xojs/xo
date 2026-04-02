import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import _test, {type TestFn} from 'ava'; // eslint-disable-line ava/use-test
import dedent from 'dedent';
import {$} from 'execa';
import {copyTestProject} from './helpers/copy-test-project.js';

const test = _test as TestFn<{cwd: string}>; // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion

const adapterModuleUrl = new URL('../lib/eslint-adapter.js', import.meta.url).href;
const eslintModuleUrl = new URL('../../node_modules/eslint/lib/api.js', import.meta.url).href;

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

test.serial.beforeEach(async t => {
	t.context.cwd = await copyTestProject();
});

test.serial.afterEach.always(async t => {
	await fs.rm(t.context.cwd, {recursive: true, force: true});
});

test.serial('adapter keeps XO ts fallback for projects without tsconfig.json', async t => {
	const filePath = path.join(t.context.cwd, 'test.ts');
	await fs.rm(path.join(t.context.cwd, 'tsconfig.json'));
	await fs.writeFile(filePath, dedent`console.log('hello')\n`, 'utf8');

	const [ruleIds = []] = await lintWithAdapter({
		cwd: t.context.cwd,
		files: [filePath],
	});

	t.is(ruleIds[0], '@stylistic/semi');
});

test.serial('adapter resolves root xo config from nested cwd using eslint config auto-discovery', async t => {
	const packageDirectory = path.join(t.context.cwd, 'packages', 'foo');
	const filePath = path.join(packageDirectory, 'test.js');
	await fs.mkdir(packageDirectory, {recursive: true});
	await writeEslintConfig(t.context.cwd);
	await writeXoConfig(t.context.cwd, `
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

	t.is(ruleIds[0], '@stylistic/semi');
});

test.serial('adapter preprocesses typed rules so JS files lint like XO', async t => {
	const filePath = path.join(t.context.cwd, 'test.js');
	await fs.writeFile(filePath, dedent`Promise.resolve(1);\n`, 'utf8');
	await writeXoConfig(t.context.cwd, `
		export default [
			{
				rules: {
					'@typescript-eslint/no-floating-promises': 'error',
				},
			},
		];
	`);

	const [ruleIds = []] = await lintWithAdapter({
		cwd: t.context.cwd,
		files: [filePath],
	});

	t.true(ruleIds.includes('@typescript-eslint/no-floating-promises'));
});

test.serial('adapter resolves xo config relative to the eslint config path', async t => {
	const packageDirectory = path.join(t.context.cwd, 'packages', 'foo');
	const filePath = path.join(packageDirectory, 'test.js');
	await fs.mkdir(packageDirectory, {recursive: true});
	await writeXoConfig(t.context.cwd, `
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
		cwd: t.context.cwd,
		lintCwd: packageDirectory,
		files: [filePath],
		argv: ['--config', 'packages/foo/eslint.config.js'],
	});

	t.is(ruleIds[0], '@stylistic/semi');
});
