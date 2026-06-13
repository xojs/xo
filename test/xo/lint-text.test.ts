
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import test, {beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import dedent from 'dedent';
import {pathExists} from 'path-exists';
import {Xo} from '../../lib/xo.js';
import {copyTestProject} from '../helpers/copy-test-project.js';
import {rejectionOf} from '../helpers/rejection-of.js';

let cwd: string;

beforeEach(async () => {
	cwd = await copyTestProject();
});

afterEach(async () => {
	await fs.rm(cwd, {recursive: true, force: true});
});

test('no config > js > semi', async () => {
	const filePath = path.join(cwd, 'test.js');
	const {results} = await new Xo({cwd}).lintText(
		dedent`console.log('hello')\n`,
		{filePath},
	);
	assert.equal(results.length, 1);
	assert.equal(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/semi');
});

test('no config > ts > semi', async () => {
	const filePath = path.join(cwd, 'test.ts');
	const text = dedent`console.log('hello')\n`;
	await fs.writeFile(filePath, text, 'utf8');
	const {results} = await new Xo({cwd}).lintText(text, {filePath});

	assert.equal(results?.[0]?.messages?.length, 1);
	assert.equal(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/semi');
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
	const xo = new Xo({cwd});
	const {results} = await xo.lintText(dedent`console.log('hello');\n`, {
		filePath,
	});
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
	const text = dedent`console.log('hello');\n`;
	await fs.writeFile(filePath, text, 'utf8');
	const xo = new Xo({cwd});
	const {results} = await xo.lintText(text, {filePath});
	assert.equal(results?.[0]?.messages?.length, 1);
	assert.equal(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/semi');
});

test('flat config > ts > semicolon false > member-delimiter-style', async () => {
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
	const text = dedent`
		type FooProps = {
			thing: string
		}

		export const foo: FooProps = {thing: 'bar'}\n
	`;
	await fs.writeFile(filePath, text, 'utf8');
	const xo = new Xo({cwd});
	const {results} = await xo.lintText(text, {filePath});
	const ruleIds = results[0]?.messages?.map(({ruleId}) => ruleId) ?? [];
	assert.ok(!ruleIds.includes('@stylistic/member-delimiter-style'), 'member-delimiter-style should not report when semicolon is false');
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
	const text = dedent`console.log('hello');\n`;
	// It is required that an actual file exists for ts to apply type-aware linting when no tsconfig includes it
	// If the file does not exist, linting ts will fail, js lint text does not require a file to exist
	await fs.writeFile(filePath, text, 'utf8');
	const {results} = await Xo.lintText(text, {
		cwd,
		filePath,
	});
	assert.equal(results?.[0]?.messages?.length, 1);
	assert.equal(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/semi');
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
	assert.equal(results?.[0]?.messages.length, 1);
	assert.equal(results?.[0]?.messages?.[0]?.messageId, 'wrongIndentation');
	assert.equal(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/indent');
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

	const text = dedent`
		export function foo() {
		    console.log('hello');
		}\n
	`;
	await fs.writeFile(filePath, text, 'utf8');

	const xo = new Xo({cwd});
	const {results} = await xo.lintText(text, {filePath});
	assert.equal(results?.[0]?.messages.length, 1);
	assert.equal(results?.[0]?.messages?.[0]?.messageId, 'wrongIndentation');
	assert.equal(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/indent');
});

test('plugin > js > eslint-plugin-import import-x/order', async () => {
	const filePath = path.join(cwd, 'test.js');
	const {results} = await (new Xo({cwd}).lintText(
		dedent`
			import foo from 'foo';
			import {util} from 'node:util';

			util.inspect(foo);\n
		`,
		{filePath},
	));

	assert.equal(results[0]?.messages?.length, 1);
	assert.ok(results[0]?.messages?.[0]);
	assert.equal(results[0]?.messages?.[0]?.ruleId, 'import-x/order');
});

test('plugin > ts > eslint-plugin-import import-x/order', async () => {
	const filePath = path.join(cwd, 'test.ts');
	const text = dedent`
		import foo from 'foo';
		import util from 'node:util';

		util.inspect(foo);\n
	`;
	await fs.writeFile(filePath, text, 'utf8');
	const {results} = await new Xo({cwd}).lintText(text, {filePath});
	const ruleIds = results[0]?.messages?.map(({ruleId}) => ruleId) ?? [];
	assert.ok(ruleIds.includes('import-x/order'));
	assert.ok(results[0]?.messages?.[0]);
});

test('plugin > js > eslint-plugin-import import-x/extensions', async () => {
	const filePath = path.join(cwd, 'test.js');
	const {results} = await new Xo({cwd}).lintText(
		dedent`
			import foo from './foo';

			console.log(foo);\n
		`,
		{filePath},
	);
	assert.equal(results[0]?.messages?.length, 1);
	assert.ok(results[0]?.messages?.[0]);
	assert.equal(results[0]?.messages?.[0]?.ruleId, 'import-x/extensions');
});

test('plugin > ts > eslint-plugin-import import-x/extensions is disabled for TypeScript', async () => {
	const filePath = path.join(cwd, 'test.ts');
	const text = dedent`
		import foo from './foo';

		console.log(foo);\n
	`;
	await fs.writeFile(filePath, text, 'utf8');
	const {results} = await new Xo({cwd}).lintText(text, {filePath});
	// `import-x/extensions` is intentionally disabled for TypeScript because it cannot model TS ESM's `.js`-extension-for-`.ts` convention.
	assert.ok(!results[0]?.messages?.some(({ruleId}) => ruleId === 'import-x/extensions'));
});

test('plugin > ts > eslint-plugin-import import-x/no-absolute-path', async () => {
	const filePath = path.join(cwd, 'test.ts');
	const text = dedent`
		import foo from '/foo';

		console.log(foo);\n
	`;
	await fs.writeFile(filePath, text, 'utf8');
	const {results} = await new Xo({cwd}).lintText(text, {filePath});
	assert.ok(results[0]?.messages?.some(({ruleId}) => ruleId === 'import-x/no-absolute-path'));
});

test('plugin > js > eslint-plugin-import import-x/no-anonymous-default-export', async () => {
	const filePath = path.join(cwd, 'test.js');
	const {results} = await new Xo({cwd}).lintText(
		dedent`
			export default () => {};\n
		`,
		{filePath},
	);

	assert.ok(results[0]?.messages?.some(({ruleId}) => ruleId === 'import-x/no-anonymous-default-export'));
});

test('plugin > js > eslint-plugin-n n/prefer-global/process', async () => {
	const filePath = path.join(cwd, 'test.js');
	const {results} = await new Xo({cwd}).lintText(
		dedent`
			process.cwd();\n
		`,
		{filePath},
	);
	assert.equal(results[0]?.messages?.length, 1);
	assert.ok(results[0]?.messages?.[0]);
	assert.equal(results[0]?.messages?.[0]?.ruleId, 'n/prefer-global/process');
});

test('plugin > ts > eslint-plugin-n n/prefer-global/process', async () => {
	const filePath = path.join(cwd, 'test.ts');
	const text = dedent`
		process.cwd();\n
	`;
	await fs.writeFile(filePath, text, 'utf8');
	const {results} = await new Xo({cwd}).lintText(text, {filePath});
	const ruleIds = results[0]?.messages?.map(({ruleId}) => ruleId) ?? [];
	assert.ok(ruleIds.includes('n/prefer-global/process'));
	assert.ok(results[0]?.messages?.[0]);
});

test('plugin > js > eslint-plugin-eslint-comments enable-duplicate-disable', async () => {
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
	assert.ok(results[0]?.messages.some(({ruleId}) =>
		ruleId === '@eslint-community/eslint-comments/no-duplicate-disable'));
});

test('plugin > ts > eslint-plugin-eslint-comments no-duplicate-disable', async () => {
	const tsFilePath = path.join(cwd, 'test.ts');
	const text = dedent`
		/* eslint-disable no-undef */
		export const foo = 10; // eslint-disable-line no-undef
		\n
	`;
	await fs.writeFile(tsFilePath, text, 'utf8');
	const {results} = await new Xo({cwd}).lintText(text, {filePath: tsFilePath});
	assert.ok(results[0]?.messages.some(({ruleId}) =>
		ruleId === '@eslint-community/eslint-comments/no-duplicate-disable'));
});

test('lint-text can be ran multiple times in a row with top level typescript rules', async () => {
	const filePath = path.join(cwd, 'test.ts');
	// Text should violate the @typescript-eslint/naming-convention rule
	const text = dedent`
		const fooBar = 10;
		const FooBar = 10;
		const FOO_BAR = 10;
		const foo_bar = 10;\n
		export const usedValues = [fooBar, FooBar, FOO_BAR, foo_bar];\n
	`;

	// We must write tsfiles to disk for the typescript rules to apply
	await fs.writeFile(filePath, text, 'utf8');

	const {results: resultsNoConfig} = await Xo.lintText(text, {cwd, filePath});
	// Ensure that with no config, the text is linted and errors are found.
	// `FOO_BAR` is valid because UPPER_CASE is allowed for module-level `const`, so only `FooBar` and `foo_bar` violate the rule.
	assert.equal(resultsNoConfig[0]?.errorCount, 2);

	await fs.writeFile(
		path.join(cwd, 'xo.config.js'),
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
	// and should not have naming-convention messages when ran multiple times
	const {results} = await Xo.lintText(text, {cwd, filePath});
	const firstRuleIds = results[0]?.messages?.map(({ruleId}) => ruleId) ?? [];
	assert.ok(!firstRuleIds.includes('@typescript-eslint/naming-convention'));
	const {results: results2} = await Xo.lintText(text, {cwd, filePath});
	const secondRuleIds = results2[0]?.messages?.map(({ruleId}) => ruleId) ?? [];
	assert.deepEqual(secondRuleIds, firstRuleIds);
	const {results: results3} = await Xo.lintText(text, {cwd, filePath});
	const thirdRuleIds = results3[0]?.messages?.map(({ruleId}) => ruleId) ?? [];
	assert.deepEqual(thirdRuleIds, firstRuleIds);
});

test('lint-text refreshes TypeScript program for unincluded files', async () => {
	const filePath = path.join(cwd, 'excluded', 'stale.ts');
	const xo = new Xo({cwd, ts: true});

	await fs.writeFile(
		path.join(cwd, 'tsconfig.json'),
		JSON.stringify({
			compilerOptions: {
				module: 'node16',
				target: 'ES2022',
				strictNullChecks: true,
				lib: ['DOM', 'DOM.Iterable', 'ES2022'],
			},
			exclude: ['node_modules', 'excluded'],
		}),
		'utf8',
	);

	await fs.mkdir(path.dirname(filePath), {recursive: true});

	const unsafeText = dedent`
		const parsed = JSON.parse('{"count":1}');
		parsed.count.toFixed(1);\n
	`;

	await fs.writeFile(filePath, unsafeText, 'utf8');
	const {results: unsafeResults} = await xo.lintText(unsafeText, {filePath});
	const unsafeRuleIds = unsafeResults[0]?.messages?.map(({ruleId}) => ruleId) ?? [];
	assert.ok(unsafeRuleIds.includes('@typescript-eslint/no-unsafe-assignment'));
	assert.ok(unsafeRuleIds.includes('@typescript-eslint/no-unsafe-member-access'));

	const safeText = dedent`
		const parsed = {count: 1};
		parsed.count.toFixed(1);\n
	`;

	await fs.writeFile(filePath, safeText, 'utf8');
	const {results: safeResults} = await xo.lintText(safeText, {filePath});
	const safeRuleIds = safeResults[0]?.messages?.map(({ruleId}) => ruleId) ?? [];
	assert.ok(!safeRuleIds.includes('@typescript-eslint/no-unsafe-assignment'));
	assert.ok(!safeRuleIds.includes('@typescript-eslint/no-unsafe-member-access'));
});

test('virtual TypeScript configs are pruned when no virtual files remain', async () => {
	const xo = new Xo({cwd, ts: true});
	const {_cacheLocation} = xo;
	const tsconfigPath = path.join(_cacheLocation, 'tsconfig.stdin.json');
	const virtualFilePath = path.join(_cacheLocation, 'stdin', 'virtual.ts');

	await fs.mkdir(path.dirname(virtualFilePath), {recursive: true});
	await fs.writeFile(virtualFilePath, 'export const virtualValue = 1;\n', 'utf8');

	await xo.lintText('export const virtualValue = 1;\n', {filePath: virtualFilePath});

	assert.ok(await pathExists(tsconfigPath));
	const virtualConfig = xo._xoConfig?.find(({languageOptions}) => {
		const parserOptions = (languageOptions?.['parserOptions'] ?? {}) as {project?: string};
		return parserOptions?.project === tsconfigPath;
	});
	assert.deepEqual(virtualConfig?.files, [path.relative(cwd, virtualFilePath)]);

	const existingFilePath = path.join(cwd, 'src', 'existing.ts');
	await fs.mkdir(path.dirname(existingFilePath), {recursive: true});
	await fs.writeFile(existingFilePath, 'export const existingValue = 1;\n', 'utf8');

	await xo.lintText('export const existingValue = 1;\n', {filePath: existingFilePath});

	assert.ok(!(await pathExists(tsconfigPath)));
	const configAfterCleanup = xo._xoConfig?.find(({languageOptions}) => {
		const parserOptions = (languageOptions?.['parserOptions'] ?? {}) as {project?: string};
		return parserOptions?.project === tsconfigPath;
	});
	assert.equal(configAfterCleanup, undefined);
});

test('virtual TypeScript files are reclassified once they exist on disk', async () => {
	const xo = new Xo({cwd, ts: true});
	const {_cacheLocation} = xo;
	const tsconfigPath = path.join(_cacheLocation, 'tsconfig.stdin.json');
	const virtualFilePath = path.join(cwd, 'excluded', 'virtual.ts');
	const source = 'export const virtualValue = 1;\n';

	await fs.writeFile(
		path.join(cwd, 'tsconfig.json'),
		JSON.stringify({
			compilerOptions: {
				module: 'node16',
				target: 'ES2022',
				strictNullChecks: true,
				lib: ['DOM', 'DOM.Iterable', 'ES2022'],
			},
			exclude: ['node_modules', 'excluded'],
		}),
		'utf8',
	);

	await xo.lintText(source, {filePath: virtualFilePath});

	assert.ok(await pathExists(tsconfigPath));
	const virtualConfig = xo._xoConfig?.find(({languageOptions}) => {
		const parserOptions = (languageOptions?.['parserOptions'] ?? {}) as {project?: string};
		return parserOptions?.project === tsconfigPath;
	});
	assert.deepEqual(virtualConfig?.files, [path.relative(cwd, virtualFilePath)]);

	await fs.mkdir(path.dirname(virtualFilePath), {recursive: true});
	await fs.writeFile(virtualFilePath, source, 'utf8');

	await xo.lintText(source, {filePath: virtualFilePath});

	assert.ok(!(await pathExists(tsconfigPath)));
	const configAfterReclassification = xo._xoConfig?.find(({languageOptions}) => {
		const parserOptions = (languageOptions?.['parserOptions'] ?? {}) as {project?: string};
		return parserOptions?.project === tsconfigPath;
	});
	assert.equal(configAfterReclassification, undefined);
});

test('config with custom plugin', async () => {
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

	assert.equal(results[0]?.messages?.length, 1);
	assert.equal(results[0]?.messages[0]?.ruleId, 'test-plugin/test-rule');
	assert.equal(results[0]?.messages[0]?.message, 'Custom error');
});

test('rulesMeta is included in lint results', async () => {
	const filePath = path.join(cwd, 'test.js');
	const {rulesMeta, results} = await new Xo({cwd}).lintText(
		dedent`console.log('hello')\n`,
		{filePath},
	);
	assert.equal(results?.[0]?.messages?.[0]?.ruleId, '@stylistic/semi');
	assert.ok(rulesMeta['@stylistic/semi']);
	assert.equal(rulesMeta['@stylistic/semi']?.type, 'layout');
});

test('no-mixed-operators catches ?? mixed with comparison', async () => {
	const filePath = path.join(cwd, 'test.js');
	await fs.writeFile(
		path.join(cwd, 'xo.config.js'),
		dedent`
			export default [
				{
					rules: {
						'@stylistic/no-mixed-operators': [
							'error',
							{
								groups: [
									['==', '!=', '===', '!==', '>', '>=', '<', '<=', '??'],
								],
							},
						],
						'no-unused-vars': 'off',
						'no-undef': 'off',
					},
				},
			];\n
		`,
		'utf8',
	);
	const {results} = await new Xo({cwd}).lintText(
		dedent`const x = a ?? b === c;\n`,
		{filePath},
	);
	const messages = results?.[0]?.messages ?? [];
	assert.ok(messages.some(m => m.ruleId === '@stylistic/no-mixed-operators'));
});

test('prettier > unicorn/template-indent is disabled', async () => {
	const filePath = path.join(cwd, 'test.js');
	await fs.writeFile(
		path.join(cwd, 'xo.config.js'),
		'export default [{prettier: true}];\n',
		'utf8',
	);
	const code = dedent`
		const html = String.raw;

		export function hello(condition) {
			return condition
				? html\`
					<div>
						<p>Hello, world!</p>
					</div>
				\`
				: html\`<div></div>\`;
		}\n
	`;
	const {results} = await new Xo({cwd}).lintText(code, {filePath});
	const ruleIds = results[0]?.messages?.map(({ruleId}) => ruleId) ?? [];
	assert.ok(!ruleIds.includes('unicorn/template-indent'));
});

// Anchor createRequire to a path inside the xo project tree so test configs can resolve eslint-plugin-vue
const vuePluginRequireAnchor = JSON.stringify(fileURLToPath(import.meta.url));

test('vue > lints vue files with eslint-plugin-vue', async () => {
	const filePath = path.join(cwd, 'test.vue');
	await fs.writeFile(
		path.join(cwd, 'xo.config.js'),
		dedent`
			import {createRequire} from 'node:module';
			const require = createRequire(${vuePluginRequireAnchor});
			const vuePlugin = require('eslint-plugin-vue');
			export default [...vuePlugin.configs['flat/recommended']];\n
		`,
		'utf8',
	);
	const text = dedent`
		<template>
			<div>{{ message }}</div>
		</template>

		<script>
		export default {
			name: 'a',
			data() {
				return {
					message: 'hello',
				};
			},
		};
		</script>\n
	`;
	await fs.writeFile(filePath, text, 'utf8');
	const {results} = await new Xo({cwd}).lintText(text, {filePath});
	const ruleIds = results[0]?.messages?.map(({ruleId}) => ruleId) ?? [];
	assert.ok(ruleIds.includes('vue/multi-word-component-names'));
});

test('vue > semicolon option applies to vue files', async () => {
	const filePath = path.join(cwd, 'test.vue');
	await fs.writeFile(
		path.join(cwd, 'xo.config.js'),
		dedent`
			import {createRequire} from 'node:module';
			const require = createRequire(${vuePluginRequireAnchor});
			const vuePlugin = require('eslint-plugin-vue');
			export default [{semicolon: false}, ...vuePlugin.configs['flat/recommended']];\n
		`,
		'utf8',
	);
	const text = dedent`
		<template>
			<div>{{ message }}</div>
		</template>

		<script>
		export default {
			name: 'MyComponent',
			data() {
				return {
					message: 'hello',
				};
			},
		};
		</script>\n
	`;
	await fs.writeFile(filePath, text, 'utf8');
	const {results} = await new Xo({cwd}).lintText(text, {filePath});
	const ruleIds = results[0]?.messages?.map(({ruleId}) => ruleId) ?? [];
	assert.ok(ruleIds.includes('@stylistic/semi'));
});

test('negated default ignore in config allows lintText on files in default-ignored directories', async () => {
	const distDirectory = path.join(cwd, 'dist');
	await fs.mkdir(distDirectory, {recursive: true});
	const filePath = path.join(distDirectory, 'index.js');
	const text = dedent`console.log('hello')\n`;
	await fs.writeFile(filePath, text, 'utf8');
	await fs.writeFile(path.join(cwd, 'xo.config.js'), dedent`
		export default [
			{
				ignores: ['!dist/**'],
			},
		];
	`, 'utf8');
	const xo = new Xo({cwd});
	const {results} = await xo.lintText(text, {filePath});
	assert.equal(results.length, 1);
	assert.equal(results[0]?.messages[0]?.ruleId, '@stylistic/semi');
});

test('suppressions > lintText respects suppressions file', async () => {
	const filePath = path.join(cwd, 'test.js');
	const suppressionsPath = path.join(cwd, 'eslint-suppressions.json');
	await fs.writeFile(suppressionsPath, '{"test.js": {"@stylistic/semi": {"count": 1}}}', 'utf8');

	const {results} = await new Xo({cwd, suppressionsLocation: 'eslint-suppressions.json'}).lintText('console.log(1)\n', {filePath});
	assert.equal(results[0]?.messages.length, 0);
});

test('suppressions > lintText throws for missing custom suppressionsLocation', async () => {
	const filePath = path.join(cwd, 'test.js');

	const error = await rejectionOf<Error>(new Xo({cwd, suppressionsLocation: 'missing-suppressions.json'}).lintText('console.log(1)\n', {filePath}));
	assert.equal(error.message, 'The suppressions file does not exist. Please run the command with `--suppress-all` or `--suppress-rule` to create it.');
});
