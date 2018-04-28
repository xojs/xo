import fs from 'fs';
import path from 'path';
import test from 'ava';
import execa from 'execa';
import slash from 'slash';
import tempWrite from 'temp-write';

process.chdir(__dirname);

const main = (args, opts) => execa(path.join(__dirname, '../main.js'), args, opts);

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
	t.regex(stdout, /unicorn-file:/);
});

test('reporter option', async t => {
	const filepath = await tempWrite('console.log()\n', 'x.js');

	try {
		await main(['--reporter=compact', filepath]);
	} catch (err) {
		t.true(err.stdout.includes('Error - '));
	}
});

test('overrides fixture', async t => {
	const cwd = path.join(__dirname, 'fixtures/overrides');
	await t.notThrows(main([], {cwd}));
});

// #65
test.failing('ignores fixture', async t => {
	const cwd = path.join(__dirname, 'fixtures/ignores');
	await t.throws(main([], {cwd}));
});

test('ignore files in .gitignore', async t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore');
	const err = await t.throws(main(['--reporter=json'], {cwd}));
	const reports = JSON.parse(err.stdout);
	const files = reports
		.map(report => path.relative(cwd, report.filePath))
		.map(report => slash(report));
	t.deepEqual(files, ['index.js', 'test/bar.js']);
});

test('ignore explicit files when in .gitgnore', async t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore');
	await t.notThrows(main(['test/foo.js', '--reporter=json'], {cwd}));
});

test('negative gitignores', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const err = await t.throws(main(['--reporter=json'], {cwd}));
	const reports = JSON.parse(err.stdout);
	const files = reports.map(report => path.relative(cwd, report.filePath));
	t.deepEqual(files, ['foo.js']);
});

test('supports being extended with a shareable config', async t => {
	const cwd = path.join(__dirname, 'fixtures/project');
	await t.notThrows(main([], {cwd}));
});

test('quiet option', async t => {
	const filepath = await tempWrite('// TODO: quiet\nconsole.log()\n', 'x.js');
	const err = await t.throws(main(['--quiet', '--reporter=json', filepath]));
	const [report] = JSON.parse(err.stdout);
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
	const err = await t.throws(main(['--node-version', 'v', filepath]));
	t.is(err.code, 1);
});

test('cli option takes precedence over config', async t => {
	const cwd = path.join(__dirname, 'fixtures/default-options');
	const input = 'console.log()\n';

	// Use config from package.json
	await t.notThrows(main(['--stdin'], {cwd, input}));

	// Override package.json config with cli flag
	await t.throws(main(['--semicolon=true', '--stdin'], {cwd, input}));

	// Use XO default (`true`) even if option is not set in package.json nor cli arg
	// i.e make sure absent cli flags are not parsed as `false`
	await t.throws(main(['--stdin'], {input}));
});

test('invalid print-config option with stdin', async t => {
	const msg = 'The `print-config` option is not supported on stdin';
	try {
		await main(['--print-config', '--stdin'], {input: 'console.log()\n'});
	} catch (err) {
		t.is(err.stderr.trim(), msg);
	}
});

test('print-config option requires a single filename', async t => {
	const msg = 'The `print-config` option must be used with exactly one file name';
	try {
		await main(['--print-config']);
	} catch (err) {
		t.is(err.stderr.trim(), msg);
	}
});

