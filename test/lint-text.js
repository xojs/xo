import {promises as fs} from 'fs';
import path from 'path';
import test from 'ava';
import createEsmUtils from 'esm-utils';
import xo from '../index.js';

const {__dirname} = createEsmUtils(import.meta);
process.chdir(__dirname);

const hasRule = (results, expectedRuleId) => results[0].messages.some(({ruleId}) => ruleId === expectedRuleId);

test('.lintText()', async t => {
	const {results} = await xo.lintText('\'use strict\'\nconsole.log(\'unicorn\');\n');
	t.true(hasRule(results, 'semi'));
});

test('default `ignores`', async t => {
	const result = await xo.lintText('\'use strict\'\nconsole.log(\'unicorn\');\n', {
		filePath: 'node_modules/ignored/index.js',
	});
	t.is(result.errorCount, 0);
	t.is(result.warningCount, 0);
});

test('`ignores` option', async t => {
	const result = await xo.lintText('\'use strict\'\nconsole.log(\'unicorn\');\n', {
		filePath: 'ignored/index.js',
		ignores: ['ignored/**/*.js'],
	});
	t.is(result.errorCount, 0);
	t.is(result.warningCount, 0);
});

test('`ignores` option without cwd', async t => {
	const result = await xo.lintText('\'use strict\'\nconsole.log(\'unicorn\');\n', {
		filePath: 'ignored/index.js',
		ignores: ['ignored/**/*.js'],
	});
	t.is(result.errorCount, 0);
	t.is(result.warningCount, 0);
});

test('respect overrides', async t => {
	const result = await xo.lintText('\'use strict\'\nconsole.log(\'unicorn\');\n', {
		filePath: 'ignored/index.js',
		ignores: ['ignored/**/*.js'],
		overrides: [
			{
				files: ['ignored/**/*.js'],
				ignores: [],
			},
		],
		rules: {
			'unicorn/prefer-module': 'off',
			'unicorn/prefer-node-protocol': 'off',
		},
	});
	t.is(result.errorCount, 1);
	t.is(result.warningCount, 0);
});

test('overriden ignore', async t => {
	const result = await xo.lintText('\'use strict\'\nconsole.log(\'unicorn\');\n', {
		filePath: 'unignored.js',
		overrides: [
			{
				files: ['unignored.js'],
				ignores: ['unignored.js'],
			},
		],
	});
	t.is(result.errorCount, 0);
	t.is(result.warningCount, 0);
});

test('`ignores` option without filename', async t => {
	await t.throwsAsync(async () => {
		await xo.lintText('\'use strict\'\nconsole.log(\'unicorn\');\n', {
			ignores: ['ignored/**/*.js'],
		});
	}, {message: /The `ignores` option requires the `filePath` option to be defined./u});
});

test('JSX support', async t => {
	const {results} = await xo.lintText('const app = <div className="appClass">Hello, React!</div>;\n');
	t.true(hasRule(results, 'no-unused-vars'));
});

test('plugin support', async t => {
	const {results} = await xo.lintText('var React;\nReact.render(<App/>);\n', {
		plugins: ['react'],
		rules: {'react/jsx-no-undef': 'error'},
	});
	t.true(hasRule(results, 'react/jsx-no-undef'));
});

test('prevent use of extended native objects', async t => {
	const {results} = await xo.lintText('[].unicorn();\n');
	t.true(hasRule(results, 'no-use-extend-native/no-use-extend-native'));
});

test('extends support', async t => {
	const {results} = await xo.lintText('var React;\nReact.render(<App/>);\n', {
		extends: 'xo-react',
	});
	t.true(hasRule(results, 'react/jsx-no-undef'));
});

test('disable style rules when `prettier` option is enabled', async t => {
	const {results: withoutPrettier} = await xo.lintText('(a) => {}\n', {filePath: 'test.js'});
	// `arrow-parens` is enabled
	t.true(hasRule(withoutPrettier, 'arrow-parens'));
	// `prettier/prettier` is disabled
	t.false(hasRule(withoutPrettier, 'prettier/prettier'));

	const {results: withPrettier} = await xo.lintText('(a) => {}\n', {prettier: true, filePath: 'test.js'});
	// `arrow-parens` is disabled by `eslint-config-prettier`
	t.false(hasRule(withPrettier, 'arrow-parens'));
	// `prettier/prettier` is enabled
	t.true(hasRule(withPrettier, 'prettier/prettier'));
});

test('extends `react` support with `prettier` option', async t => {
	const {results} = await xo.lintText('<Hello name={ firstname } />;\n', {extends: 'xo-react', prettier: true, filePath: 'test.jsx'});
	// `react/jsx-curly-spacing` is disabled by `eslint-config-prettier`
	t.false(hasRule(results, 'react/jsx-curly-spacing'));
	// `prettier/prettier` is enabled
	t.true(hasRule(results, 'prettier/prettier'));
});

test('regression test for #71', async t => {
	const {results} = await xo.lintText('const foo = { key: \'value\' };\nconsole.log(foo);\n', {
		extends: path.join(__dirname, 'fixtures/extends.js'),
	});
	t.is(results[0].errorCount, 0);
});

test('lintText() - overrides support', async t => {
	const cwd = path.join(__dirname, 'fixtures/overrides');
	const bar = path.join(cwd, 'test/bar.js');
	const {results: barResults} = await xo.lintText(await fs.readFile(bar, 'utf8'), {filePath: bar, cwd});
	t.is(barResults[0].errorCount, 0);

	const foo = path.join(cwd, 'test/foo.js');
	const {results: fooResults} = await xo.lintText(await fs.readFile(foo, 'utf8'), {filePath: foo, cwd});
	t.is(fooResults[0].errorCount, 0);

	const index = path.join(cwd, 'test/index.js');
	const {results: indexResults} = await xo.lintText(await fs.readFile(bar, 'utf8'), {filePath: index, cwd});
	t.is(indexResults[0].errorCount, 0);
});

test('do not lint gitignored files if filename is given', async t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore');
	const ignoredPath = path.resolve('fixtures/gitignore/test/foo.js');
	const ignored = await fs.readFile(ignoredPath, 'utf8');
	const {results} = await xo.lintText(ignored, {filePath: ignoredPath, cwd});
	t.is(results[0].errorCount, 0);
});

test('lint gitignored files if filename is not given', async t => {
	const ignoredPath = path.resolve('fixtures/gitignore/test/foo.js');
	const ignored = await fs.readFile(ignoredPath, 'utf8');
	const {results} = await xo.lintText(ignored);
	t.true(results[0].errorCount > 0);
});

test('do not lint gitignored files in file with negative gitignores', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const ignoredPath = path.resolve('fixtures/negative-gitignore/bar.js');
	const ignored = await fs.readFile(ignoredPath, 'utf8');
	const {results} = await xo.lintText(ignored, {filePath: ignoredPath, cwd});
	t.is(results[0].errorCount, 0);
});

test('multiple negative patterns should act as positive patterns', async t => {
	const cwd = path.join(__dirname, 'fixtures', 'gitignore-multiple-negation');
	const filePath = path.join(cwd, '!!!unicorn.js');
	const text = await fs.readFile(filePath, 'utf8');
	const {results} = await xo.lintText(text, {filePath, cwd});
	t.is(results[0].errorCount, 0);
});

test('lint negatively gitignored files', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const glob = path.posix.join(cwd, '*');
	const {results} = await xo.lintFiles(glob, {cwd});

	t.true(results[0].errorCount > 0);
});

test('do not lint eslintignored files if filename is given', async t => {
	const cwd = path.join(__dirname, 'fixtures/eslintignore');
	const ignoredPath = path.resolve('fixtures/eslintignore/bar.js');
	const ignored = await fs.readFile(ignoredPath, 'utf8');
	const {results} = await xo.lintText(ignored, {filePath: ignoredPath, cwd});
	t.is(results[0].errorCount, 0);
});

test('lint eslintignored files if filename is not given', async t => {
	const ignoredPath = path.resolve('fixtures/eslintignore/bar.js');
	const ignored = await fs.readFile(ignoredPath, 'utf8');
	const {results} = await xo.lintText(ignored);
	t.true(results[0].errorCount > 0);
});

test('enable rules based on nodeVersion', async t => {
	const cwd = path.join(__dirname, 'fixtures', 'engines-overrides');
	const filePath = path.join(cwd, 'promise-then.js');
	const text = await fs.readFile(filePath, 'utf8');

	let {results} = await xo.lintText(text, {nodeVersion: '>=8.0.0'});
	t.true(hasRule(results, 'promise/prefer-await-to-then'));

	({results} = await xo.lintText(text, {nodeVersion: '>=6.0.0'}));
	t.false(hasRule(results, 'promise/prefer-await-to-then'));
});

test('enable rules based on nodeVersion in override', async t => {
	const cwd = path.join(__dirname, 'fixtures', 'engines-overrides');
	const filePath = path.join(cwd, 'promise-then.js');
	const text = await fs.readFile(filePath, 'utf8');

	let {results} = await xo.lintText(text, {
		nodeVersion: '>=8.0.0',
		filePath: 'promise-then.js',
		overrides: [
			{
				files: 'promise-*.js',
				nodeVersion: '>=6.0.0',
			},
		],
	});
	t.false(hasRule(results, 'promise/prefer-await-to-then'));

	({results} = await xo.lintText(text, {
		nodeVersion: '>=6.0.0',
		filePath: 'promise-then.js',
		overrides: [
			{
				files: 'promise-*.js',
				nodeVersion: '>=8.0.0',
			},
		],
	}));
	t.true(hasRule(results, 'promise/prefer-await-to-then'));
});

test('allow unassigned stylesheet imports', async t => {
	let {results} = await xo.lintText('import \'stylesheet.css\'');
	t.false(hasRule(results, 'import/no-unassigned-import'));

	({results} = await xo.lintText('import \'stylesheet.scss\''));
	t.false(hasRule(results, 'import/no-unassigned-import'));

	({results} = await xo.lintText('import \'stylesheet.sass\''));
	t.false(hasRule(results, 'import/no-unassigned-import'));

	({results} = await xo.lintText('import \'stylesheet.less\''));
	t.false(hasRule(results, 'import/no-unassigned-import'));
});

test('find configurations close to linted file', async t => {
	let {results} = await xo.lintText('console.log(\'semicolon\');\n', {filePath: 'fixtures/nested-configs/child/semicolon.js'});
	t.true(hasRule(results, 'semi'));

	({results} = await xo.lintText('console.log(\'semicolon\');\n', {filePath: 'fixtures/nested-configs/child-override/child-prettier-override/semicolon.js'}));
	t.true(hasRule(results, 'prettier/prettier'));

	({results} = await xo.lintText('console.log(\'no-semicolon\')\n', {filePath: 'fixtures/nested-configs/no-semicolon.js'}));
	t.true(hasRule(results, 'semi'));

	({results} = await xo.lintText(`console.log([
  2
]);\n`, {filePath: 'fixtures/nested-configs/child-override/two-spaces.js'}));
	t.true(hasRule(results, 'indent'));
});

test('typescript files', async t => {
	let {results} = await xo.lintText(`console.log([
  2,
]);
`, {filePath: 'fixtures/typescript/two-spaces.tsx'});

	t.true(hasRule(results, '@typescript-eslint/indent'));

	({results} = await xo.lintText(`console.log([
  2,
]);
`, {filePath: 'fixtures/typescript/two-spaces.tsx', space: 2}));
	t.is(results[0].errorCount, 0);

	({results} = await xo.lintText('console.log(\'extra-semicolon\');;\n', {filePath: 'fixtures/typescript/child/extra-semicolon.ts'}));
	t.true(hasRule(results, '@typescript-eslint/no-extra-semi'));

	({results} = await xo.lintText('console.log(\'no-semicolon\')\n', {filePath: 'fixtures/typescript/child/no-semicolon.ts', semicolon: false}));
	t.is(results[0].errorCount, 0);

	({results} = await xo.lintText(`console.log([
    4,
]);
`, {filePath: 'fixtures/typescript/child/sub-child/four-spaces.ts'}));
	t.true(hasRule(results, '@typescript-eslint/indent'));

	({results} = await xo.lintText(`console.log([
    4,
]);
`, {filePath: 'fixtures/typescript/child/sub-child/four-spaces.ts', space: 4}));
	t.is(results[0].errorCount, 0);
});

test('deprecated rules', async t => {
	const {usedDeprecatedRules} = await xo.lintText('\'use strict\'\nconsole.log(\'unicorn\');\n');

	for (const {ruleId, replacedBy} of usedDeprecatedRules) {
		t.is(typeof ruleId, 'string');
		t.true(Array.isArray(replacedBy));
	}
});

async function configType(t, {dir}) {
	const {results} = await xo.lintText('var obj = { a: 1 };\n', {cwd: path.resolve('fixtures', 'config-files', dir), filePath: 'file.js'});
	t.true(hasRule(results, 'no-var'));
}

configType.title = (_, {type}) => `load config from ${type}`.trim();

test(configType, {type: 'xo.config.js', dir: 'xo-config_js'});
test(configType, {type: 'xo.config.cjs', dir: 'xo-config_cjs'});
test(configType, {type: '.xo-config.js', dir: 'xo-config_js'});
test(configType, {type: '.xo-config.cjs', dir: 'xo-config_cjs'});
test(configType, {type: '.xo-config.json', dir: 'xo-config_json'});
test(configType, {type: '.xo-config', dir: 'xo-config'});
