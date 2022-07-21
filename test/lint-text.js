import process from 'node:process';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import test from 'ava';
import createEsmUtils from 'esm-utils';
import xo from '../index.js';

const {__dirname} = createEsmUtils(import.meta);
process.chdir(__dirname);

const hasRule = (results, expectedRuleId, rulesMeta) => {
	const hasRuleInResults = results[0].messages.some(({ruleId}) => ruleId === expectedRuleId);
	const hasRuleInMeta = rulesMeta ? typeof rulesMeta[expectedRuleId] === 'object' : true;
	return hasRuleInResults && hasRuleInMeta;
};

test('.lintText()', async t => {
	const {results, rulesMeta} = await xo.lintText('\'use strict\'\nconsole.log(\'unicorn\');\n');
	t.true(hasRule(results, 'semi', rulesMeta));
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
	const {results, rulesMeta} = await xo.lintText('const app = <div className="appClass">Hello, React!</div>;\n');
	t.true(hasRule(results, 'no-unused-vars', rulesMeta));
});

test('plugin support', async t => {
	const {results, rulesMeta} = await xo.lintText('var React;\nReact.render(<App/>);\n', {
		plugins: ['react'],
		rules: {'react/jsx-no-undef': 'error'},
	});
	t.true(hasRule(results, 'react/jsx-no-undef', rulesMeta));
});

test('prevent use of extended native objects', async t => {
	const {results, rulesMeta} = await xo.lintText('[].unicorn();\n');
	t.true(hasRule(results, 'no-use-extend-native/no-use-extend-native', rulesMeta));
});

test('extends support', async t => {
	const {results, rulesMeta} = await xo.lintText('var React;\nReact.render(<App/>);\n', {
		extends: 'xo-react',
	});
	t.true(hasRule(results, 'react/jsx-no-undef', rulesMeta));
});

test('disable style rules when `prettier` option is enabled', async t => {
	const {results: withoutPrettier, rulesMeta} = await xo.lintText('(a) => {}\n', {filePath: 'test.js'});
	// `arrow-parens` is enabled
	t.true(hasRule(withoutPrettier, 'arrow-parens', rulesMeta));
	// `prettier/prettier` is disabled
	t.false(hasRule(withoutPrettier, 'prettier/prettier', rulesMeta));

	const {results: withPrettier} = await xo.lintText('(a) => {}\n', {prettier: true, filePath: 'test.js'});
	// `arrow-parens` is disabled by `eslint-config-prettier`
	t.false(hasRule(withPrettier, 'arrow-parens', rulesMeta));
	// `prettier/prettier` is enabled - this is a special case for rulesMeta - so we remove it from this test
	t.true(hasRule(withPrettier, 'prettier/prettier'));
});

test('extends `react` support with `prettier` option', async t => {
	const {results, rulesMeta} = await xo.lintText('<Hello name={ firstname } />;\n', {extends: 'xo-react', prettier: true, filePath: 'test.jsx'});
	// `react/jsx-curly-spacing` is disabled by `eslint-config-prettier`
	t.false(hasRule(results, 'react/jsx-curly-spacing', rulesMeta));
	// `prettier/prettier` is enabled
	t.true(hasRule(results, 'prettier/prettier', rulesMeta));
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

test.failing('enable rules based on nodeVersion', async t => {
	const cwd = path.join(__dirname, 'fixtures', 'engines-overrides');
	const filePath = path.join(cwd, 'promise-then.js');
	const text = await fs.readFile(filePath, 'utf8');

	let {results, rulesMeta} = await xo.lintText(text, {nodeVersion: '>=8.0.0'});
	t.true(hasRule(results, 'promise/prefer-await-to-then', rulesMeta));

	({results, rulesMeta} = await xo.lintText(text, {nodeVersion: '>=6.0.0'}));
	t.false(hasRule(results, 'promise/prefer-await-to-then', rulesMeta));
});

test.failing('enable rules based on nodeVersion in override', async t => {
	const cwd = path.join(__dirname, 'fixtures', 'engines-overrides');
	const filePath = path.join(cwd, 'promise-then.js');
	const text = await fs.readFile(filePath, 'utf8');

	let {results, rulesMeta} = await xo.lintText(text, {
		nodeVersion: '>=8.0.0',
		filePath: 'promise-then.js',
		overrides: [
			{
				files: 'promise-*.js',
				nodeVersion: '>=6.0.0',
			},
		],
	});
	t.false(hasRule(results, 'promise/prefer-await-to-then', rulesMeta));

	({results, rulesMeta} = await xo.lintText(text, {
		nodeVersion: '>=6.0.0',
		filePath: 'promise-then.js',
		overrides: [
			{
				files: 'promise-*.js',
				nodeVersion: '>=8.0.0',
			},
		],
	}));
	t.true(hasRule(results, 'promise/prefer-await-to-then', rulesMeta));
});

test('allow unassigned stylesheet imports', async t => {
	let {results, rulesMeta} = await xo.lintText('import \'stylesheet.css\'');
	t.false(hasRule(results, 'import/no-unassigned-import', rulesMeta));

	({results, rulesMeta} = await xo.lintText('import \'stylesheet.scss\''));
	t.false(hasRule(results, 'import/no-unassigned-import', rulesMeta));

	({results, rulesMeta} = await xo.lintText('import \'stylesheet.sass\''));
	t.false(hasRule(results, 'import/no-unassigned-import', rulesMeta));

	({results, rulesMeta} = await xo.lintText('import \'stylesheet.less\''));
	t.false(hasRule(results, 'import/no-unassigned-import', rulesMeta));
});

test('find configurations close to linted file', async t => {
	let {results, rulesMeta} = await xo.lintText('console.log(\'semicolon\');\n', {filePath: 'fixtures/nested-configs/child/semicolon.js'});
	t.true(hasRule(results, 'semi', rulesMeta));

	({results, rulesMeta} = await xo.lintText('console.log(\'semicolon\');\n', {filePath: 'fixtures/nested-configs/child-override/child-prettier-override/semicolon.js'}));
	t.true(hasRule(results, 'prettier/prettier', rulesMeta));

	({results, rulesMeta} = await xo.lintText('console.log(\'no-semicolon\')\n', {filePath: 'fixtures/nested-configs/no-semicolon.js'}));
	t.true(hasRule(results, 'semi', rulesMeta));

	({results, rulesMeta} = await xo.lintText(`console.log([
  2
]);\n`, {filePath: 'fixtures/nested-configs/child-override/two-spaces.js'}));
	t.true(hasRule(results, 'indent', rulesMeta));
});

test('rulesMeta is added to the report by default', async t => {
	const report = await xo.lintText('\'use strict\'\nconsole.log(\'unicorn\');\n');
	t.is(typeof report.rulesMeta, 'object');
});

test('typescript files: two spaces fails', async t => {
	const twoSpacesCwd = path.resolve('fixtures', 'typescript');
	const twoSpacesfilePath = path.resolve(twoSpacesCwd, 'two-spaces.tsx');
	const twoSpacesText = await fs.readFile(twoSpacesfilePath, 'utf8');
	const {results, rulesMeta} = await xo.lintText(twoSpacesText, {
		filePath: twoSpacesfilePath,
	});
	t.true(hasRule(results, '@typescript-eslint/indent', rulesMeta));
});

test('typescript files: two spaces pass', async t => {
	const twoSpacesCwd = path.resolve('fixtures', 'typescript');
	const twoSpacesfilePath = path.resolve(twoSpacesCwd, 'two-spaces.tsx');
	const twoSpacesText = await fs.readFile(twoSpacesfilePath, 'utf8');
	const {results} = await xo.lintText(twoSpacesText, {
		filePath: twoSpacesfilePath,
		space: 2,
	});
	t.is(results[0].errorCount, 0);
});

test('typescript files: extra semi fail', async t => {
	const extraSemiCwd = path.resolve('fixtures', 'typescript', 'child');
	const extraSemiFilePath = path.resolve(extraSemiCwd, 'extra-semicolon.ts');
	const extraSemiText = await fs.readFile(extraSemiFilePath, 'utf8');
	const {results, rulesMeta} = await xo.lintText(extraSemiText, {
		filePath: extraSemiFilePath,
	});
	t.true(hasRule(results, '@typescript-eslint/no-extra-semi', rulesMeta));
});

test('typescript files: extra semi pass', async t => {
	const noSemiCwd = path.resolve('fixtures', 'typescript', 'child');
	const noSemiFilePath = path.resolve(noSemiCwd, 'no-semicolon.ts');
	const noSemiText = await fs.readFile(noSemiFilePath, 'utf8');
	const {results} = await xo.lintText(noSemiText, {
		filePath: noSemiFilePath,
		semicolon: false,
	});
	t.is(results[0].errorCount, 0);
});

test('typescript files: four space fail', async t => {
	const fourSpacesCwd = path.resolve('fixtures', 'typescript', 'child', 'sub-child');
	const fourSpacesFilePath = path.resolve(fourSpacesCwd, 'four-spaces.ts');
	const fourSpacesText = await fs.readFile(fourSpacesFilePath, 'utf8');
	const {results, rulesMeta} = await xo.lintText(fourSpacesText, {
		filePath: fourSpacesFilePath,
	});
	t.true(hasRule(results, '@typescript-eslint/indent', rulesMeta));
});

test('typescript files: four space pass', async t => {
	const fourSpacesCwd = path.resolve('fixtures', 'typescript', 'child', 'sub-child');
	const fourSpacesFilePath = path.resolve(fourSpacesCwd, 'four-spaces.ts');
	const fourSpacesText = await fs.readFile(fourSpacesFilePath, 'utf8');
	const {results} = await xo.lintText(fourSpacesText, {
		filePath: fourSpacesFilePath,
		space: 4,
	});
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
	const {results, rulesMeta} = await xo.lintText('var obj = { a: 1 };\n', {cwd: path.resolve('fixtures', 'config-files', dir), filePath: 'file.js'});
	t.true(hasRule(results, 'no-var', rulesMeta));
}

configType.title = (_, {type}) => `load config from ${type}`.trim();

test(configType, {type: 'xo.config.js', dir: 'xo-config_js'});
test(configType, {type: 'xo.config.cjs', dir: 'xo-config_cjs'});
test(configType, {type: '.xo-config.js', dir: 'xo-config_js'});
test(configType, {type: '.xo-config.cjs', dir: 'xo-config_cjs'});
test(configType, {type: '.xo-config.json', dir: 'xo-config_json'});
test(configType, {type: '.xo-config', dir: 'xo-config'});
