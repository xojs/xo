import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'ava';
import execa from 'execa';
import slash from 'slash';
import createEsmUtils from 'esm-utils';

const {__dirname} = createEsmUtils(import.meta);
process.chdir(__dirname);

const main = (arguments_, options) => execa(path.join(__dirname, '../cli.js'), arguments_, options);

test('fix option', async t => {
	const cwd = await fs.promises.mkdtemp(path.join(__dirname, './temp/'));
	const filepath = path.join(cwd, 'x.js');
	await fs.promises.writeFile(filepath, 'console.log()\n');
	await main(['--fix', filepath], {cwd});
	t.is(fs.readFileSync(filepath, 'utf8').trim(), 'console.log();');
});

test('fix option with stdin', async t => {
	const {stdout} = await main(['--fix', '--stdin'], {
		input: 'console.log()',
	});
	t.is(stdout, 'console.log();');
});

test('stdin-filename option with stdin', async t => {
	const {stdout} = await main(['--stdin', '--stdin-filename=unicorn-file'], {
		input: 'console.log()\n',
		reject: false,
	});
	t.regex(stdout, /unicorn-file:/u);
});

test('reporter option', async t => {
	const cwd = await fs.promises.mkdtemp(path.join(__dirname, './temp/'));
	const filepath = path.join(cwd, 'x.js');
	await fs.promises.writeFile(filepath, 'console.log()\n');

	const error = await t.throwsAsync(() =>
		main(['--reporter=compact', filepath], {cwd}),
	);
	t.true(error.stdout.includes('Error - '));
});

test('overrides fixture', async t => {
	const cwd = path.join(__dirname, 'fixtures/overrides');
	await t.notThrowsAsync(main([], {cwd}));
});

test('overrides work with relative path', async t => {
	const cwd = path.join(__dirname, 'fixtures/overrides');
	const file = path.join('test', 'bar.js');
	await t.notThrowsAsync(main([file], {cwd}));
});

test('overrides work with relative path starting with `./`', async t => {
	const cwd = path.join(__dirname, 'fixtures/overrides');
	const file = '.' + path.sep + path.join('test', 'bar.js');
	await t.notThrowsAsync(main([file], {cwd}));
});

test('overrides work with absolute path', async t => {
	const cwd = path.join(__dirname, 'fixtures/overrides');
	const file = path.join(cwd, 'test', 'bar.js');
	await t.notThrowsAsync(main([file], {cwd}));
});

test.failing('override default ignore', async t => {
	const cwd = path.join(__dirname, 'fixtures/ignores');
	await t.throwsAsync(main([], {cwd}));
});

test('ignore files in .gitignore', async t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore');
	const error = await t.throwsAsync(main(['--reporter=json'], {cwd}));
	const reports = JSON.parse(error.stdout);
	const files = reports
		.map(report => path.relative(cwd, report.filePath))
		.map(report => slash(report));
	t.deepEqual(files.sort(), ['index.js', 'test/bar.js'].sort());
});

test('ignore explicit files when in .gitgnore', async t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore');
	await t.notThrowsAsync(main(['test/foo.js', '--reporter=json'], {cwd}));
});

test('negative gitignores', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const error = await t.throwsAsync(main(['--reporter=json'], {cwd}));
	const reports = JSON.parse(error.stdout);
	const files = reports.map(report => path.relative(cwd, report.filePath));
	t.deepEqual(files, ['foo.js']);
});

test('supports being extended with a shareable config', async t => {
	const cwd = path.join(__dirname, 'fixtures/project');
	await t.notThrowsAsync(main([], {cwd}));
});

test('quiet option', async t => {
	const cwd = await fs.promises.mkdtemp(path.join(__dirname, './temp/'));
	const filepath = path.join(cwd, 'x.js');
	await fs.promises.writeFile(filepath, '// TODO: quiet\nconsole.log()\n');
	const error = await t.throwsAsync(main(['--quiet', '--reporter=json', filepath], {cwd}));
	const [report] = JSON.parse(error.stdout);
	t.is(report.warningCount, 0);
});

test('invalid node-engine option', async t => {
	const cwd = await fs.promises.mkdtemp(path.join(__dirname, './temp/'));
	const filepath = path.join(cwd, 'x.js');
	await fs.promises.writeFile(filepath, 'console.log()\n');
	const error = await t.throwsAsync(main(['--node-version', 'v', filepath], {cwd}));
	t.is(error.exitCode, 1);
});

test('cli option takes precedence over config', async t => {
	const cwd = path.join(__dirname, 'fixtures/default-options');
	const input = 'console.log()\n';

	// Use config from package.json
	await t.notThrowsAsync(main(['--stdin'], {cwd, input}));

	// Override package.json config with cli flag
	await t.throwsAsync(main(['--semicolon=true', '--stdin'], {cwd, input}));

	// Use XO default (`true`) even if option is not set in package.json nor cli arg
	// i.e make sure absent cli flags are not parsed as `false`
	await t.throwsAsync(main(['--stdin'], {input}));
});

test('space option with number value', async t => {
	const cwd = path.join(__dirname, 'fixtures/space');
	const {stdout} = await t.throwsAsync(main(['--space=4', 'one-space.js'], {cwd}));
	t.true(stdout.includes('Expected indentation of 4 spaces'));
});

test('space option as boolean', async t => {
	const cwd = path.join(__dirname, 'fixtures/space');
	const {stdout} = await t.throwsAsync(main(['--space'], {cwd}));
	t.true(stdout.includes('Expected indentation of 2 spaces'));
});

test('space option as boolean with filename', async t => {
	const cwd = path.join(__dirname, 'fixtures/space');
	const {stdout} = await main(['--reporter=json', '--space', 'two-spaces.js'], {
		cwd,
		reject: false,
	});
	const reports = JSON.parse(stdout);

	// Only the specified file was checked (filename was not the value of `space`)
	t.is(reports.length, 1);

	// The default space value of 2 was expected
	t.is(reports[0].errorCount, 0);
});

test('space option with boolean strings', async t => {
	const cwd = path.join(__dirname, 'fixtures/space');
	const trueResult = await t.throwsAsync(main(['--space=true'], {cwd}));
	const falseResult = await t.throwsAsync(main(['--space=false'], {cwd}));
	t.true(trueResult.stdout.includes('Expected indentation of 2 spaces'));
	t.true(falseResult.stdout.includes('Expected indentation of 1 tab'));
});

test('extension option', async t => {
	const cwd = path.join(__dirname, 'fixtures/custom-extension');
	const {stdout} = await t.throwsAsync(main(['--reporter=json', '--extension=unknown'], {cwd}));
	const reports = JSON.parse(stdout);

	t.is(reports.length, 1);
	t.true(reports[0].filePath.endsWith('.unknown'));
});

test('invalid print-config flag with stdin', async t => {
	const error = await t.throwsAsync(() =>
		main(['--print-config', 'x.js', '--stdin'], {input: 'console.log()\n'}),
	);
	t.is(error.stderr.trim(), 'The `--print-config` flag is not supported on stdin');
});

test('print-config flag requires a single filename', async t => {
	const error = await t.throwsAsync(() =>
		main(['--print-config', 'x.js', 'y.js']),
	);
	t.is(error.stderr.trim(), 'The `--print-config` flag must be used with exactly one filename');
});
