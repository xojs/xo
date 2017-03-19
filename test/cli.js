import fs from 'fs';
import path from 'path';
import test from 'ava';
import tempWrite from 'temp-write';
import execa from 'execa';

process.chdir(__dirname);

test('fix option', async t => {
	const filepath = await tempWrite('console.log()\n', 'x.js');
	await execa('../cli.js', ['--no-local', '--fix', filepath]);
	t.is(fs.readFileSync(filepath, 'utf8').trim(), 'console.log();');
});

test('fix option with stdin', async t => {
	const {stdout} = await execa('../cli.js', ['--no-local', '--fix', '--stdin'], {
		input: 'console.log()\n'
	});
	t.is(stdout.trim(), 'console.log();');
});

test('stdin-filename option with stdin', async t => {
	const {stdout} = await execa('../cli.js', ['--no-local', '--stdin', '--stdin-filename=unicorn-file'], {
		input: 'console.log()\n',
		reject: false
	});
	t.regex(stdout, /unicorn-file:/);
});

test('reporter option', async t => {
	const filepath = await tempWrite('console.log()\n', 'x.js');

	try {
		await execa('../cli.js', ['--no-local', '--reporter=compact', filepath]);
	} catch (err) {
		t.true(err.stdout.indexOf('Error - ') !== -1);
	}
});

test('overrides fixture', async () => {
	const cwd = path.join(__dirname, 'fixtures/overrides');
	await execa('../../../cli.js', ['--no-local'], {cwd});
});

// https://github.com/sindresorhus/xo/issues/65
test.failing('ignores fixture', async t => {
	const cwd = path.join(__dirname, 'fixtures/ignores');
	await t.throws(execa('../../../cli.js', ['--no-local'], {cwd}));
});

test('ignore files in .gitignore', async t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore');

	try {
		await execa('../../../cli.js', ['--no-local'], {cwd});
	} catch (err) {
		t.is(err.stdout.indexOf('foo.js'), -1);
		t.true(err.stdout.indexOf('bar.js') !== -1);
	}
});

test.failing('negative gitignores', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');

	try {
		await execa(`../../../cli.js`, [`${cwd}/bar.js`, '--no-local'], {cwd});
	} catch (err) {
		t.is(err.stdout.indexOf('foo.js'), -1, 'Should not lint foo.js');
	}
});

test('supports being extended with a shareable config', async () => {
	const cwd = path.join(__dirname, 'fixtures/project');
	await execa('../../../cli.js', ['--no-local'], {cwd});
});

test('quiet option', async t => {
	const filepath = await tempWrite('// TODO: quiet\nconsole.log()\n', 'x.js');
	const err = await t.throws(execa('../cli.js', ['--no-local', '--quiet', '--reporter=compact', filepath]));
	t.is(err.stdout.indexOf('warning'), -1);
});
