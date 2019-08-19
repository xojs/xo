import fs from 'fs';
import path from 'path';
import test from 'ava';
import execa from 'execa';
import slash from 'slash';
import tempWrite from 'temp-write';

process.chdir(__dirname);

const main = (arguments_, options) => execa(path.join(__dirname, '../cli-main.js'), arguments_, options);

test('fix option', async t => {
	const filepath = await tempWrite('console.log()\n', 'x.js');
	await main(['--fix', filepath]);
	t.is(fs.readFileSync(filepath, 'utf8').trim(), 'console.log();');
});

test('fix option with stdin', async t => {
	const {stdout} = await main(['--fix', '--stdin'], {
		input: 'console.log()\n'
	});
	t.is(stdout.trim(), 'console.log();');
});

test('stdin-filename option with stdin', async t => {
	const {stdout} = await main(['--stdin', '--stdin-filename=unicorn-file'], {
		input: 'console.log()\n',
		reject: false
	});
	t.regex(stdout, /unicorn-file:/u);
});

test('reporter option', async t => {
	const filepath = await tempWrite('console.log()\n', 'x.js');

	try {
		await main(['--reporter=compact', filepath]);
	} catch (error) {
		t.true(error.stdout.includes('Error - '));
	}
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

// #65
test.failing('ignores fixture', async t => {
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
	t.deepEqual(files, ['index.js', 'test/bar.js']);
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
	const filepath = await tempWrite('// TODO: quiet\nconsole.log()\n', 'x.js');
	const error = await t.throwsAsync(main(['--quiet', '--reporter=json', filepath]));
	const [report] = JSON.parse(error.stdout);
	t.is(report.warningCount, 0);
});

test('init option', async t => {
	const filepath = await tempWrite('{}', 'package.json');
	await main(['--init'], {
		cwd: path.dirname(filepath)
	});
	const packageJson = fs.readFileSync(filepath, 'utf8');
	t.deepEqual(JSON.parse(packageJson).scripts, {test: 'xo'});
});

test('invalid node-engine option', async t => {
	const filepath = await tempWrite('console.log()\n', 'x.js');
	const error = await t.throwsAsync(main(['--node-version', 'v', filepath]));
	t.is(error.code, 1);
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
		reject: false
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
