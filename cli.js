#!/usr/bin/env node
/* eslint-disable import/order */
'use strict';
const debug = require('debug')('xo');

// Prefer the local installation of XO.
const resolveCwd = require('resolve-cwd');
const hasFlag = require('has-flag');

const localCLI = resolveCwd('xo/cli');

if (!hasFlag('no-local') && localCLI && localCLI !== __filename) {
	debug('Using local install of XO.');
	require(localCLI);
	return;
}

const path = require('path');
const spawn = require('child_process').spawn;
const updateNotifier = require('update-notifier');
const getStdin = require('get-stdin');
const meow = require('meow');
const formatterPretty = require('eslint-formatter-pretty');
const xo = require('./');

const cli = meow(`
	Usage
	  $ xo [<file|glob> ...]

	Options
	  --init          Add XO to your project
	  --fix           Automagically fix issues
	  --reporter      Reporter to use
	  --stdin         Validate code from stdin
	  --esnext        Enforce ES2015+ rules
	  --env           Environment preset  [Can be set multiple times]
	  --global        Global variable  [Can be set multiple times]
	  --ignore        Additional paths to ignore  [Can be set multiple times]
	  --space         Use space indent instead of tabs  [Default: 2]
	  --no-semicolon  Prevent use of semicolons
	  --plugin        Include third-party plugins  [Can be set multiple times]
	  --extend        Extend defaults with a custom config  [Can be set multiple times]
	  --open          Open files with issues in your editor
	  --quiet         Show only errors and no warnings
	  --extension     Additional extensions to lint [Can be set multiple times]

	Examples
	  $ xo
	  $ xo index.js
	  $ xo *.js !foo.js
	  $ xo --esnext --space
	  $ xo --env=node --env=mocha
	  $ xo --init --esnext
	  $ xo --plugin=react
	  $ xo --plugin=html --extension=html

	Tips
	  Put options in package.json instead of using flags so other tools can read it.
`, {
	string: [
		'_'
	],
	boolean: [
		'init',
		'compact',
		'stdin',
		'fix',
		'open'
	]
});

updateNotifier({pkg: cli.pkg}).notify();

const input = cli.input;
const opts = cli.flags;

function log(report) {
	// legacy
	// TODO: remove in 1.0.0
	if (opts.compact) {
		opts.reporter = 'compact';
	}

	const reporter = opts.reporter ? xo.getFormatter(opts.reporter) : formatterPretty;

	process.stdout.write(reporter(report.results));
	process.exit(report.errorCount === 0 ? 0 : 1);
}

function open(report) {
	if (report.errorCount === 0) {
		return;
	}

	const editor = process.env.EDITOR;

	if (!editor) {
		console.log(`
\`open\` option was used, but your $EDITOR environment variable is empty.
Fix it by setting path to your editor of choice in ~/.bashrc or ~/.zshrc:

    export EDITOR=atom
`);
		return;
	}

	const executableName = editor.split(path.sep).pop();

	function lineColumn(message) {
		return `${message.line}:${message.column}`;
	}

	const args = [];

	report.results
		.filter(file => file.errorCount > 0)
		.forEach(file => {
			// Sublime Text and Atom support opening file at exact position
			if (['subl', 'atom'].indexOf(executableName) >= 0) {
				args.push(file.filePath + ':' + lineColumn(file.messages[0]));
				return;
			}

			// WebStorm supports opening file on a specific line (no column support)
			if (executableName === 'wstorm') {
				args.push(file.filePath + ':' + file.messages[0].line);
				return;
			}

			// TextMate requires a `--line` option
			if (executableName === 'mate') {
				args.push('--line', lineColumn(file.messages[0]), file.filePath);
				return;
			}

			args.push(file.filePath);
		});

	spawn(editor, args, {
		detached: true,
		stdio: 'ignore'
	}).unref();
}

// `xo -` => `xo --stdin`
if (input[0] === '-') {
	opts.stdin = true;
	input.shift();
}

if (opts.init) {
	require('xo-init')();
} else if (opts.stdin) {
	getStdin().then(str => {
		if (opts.fix) {
			console.error('The `fix` option is not supported on stdin');
			process.exit(1);
		}

		if (opts.open) {
			console.error('The `open` option is not supported on stdin');
			process.exit(1);
		}

		log(xo.lintText(str, opts));
	});
} else {
	xo.lintFiles(input, opts).then(report => {
		if (opts.fix) {
			xo.outputFixes(report);
		}

		if (opts.open) {
			open(report);
		}

		log(report);
	});
}
