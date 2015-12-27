#!/usr/bin/env node
'use strict';

var debug = require('debug')('xo');

// Prefer the local installation of XO.
var resolveCwd = require('resolve-cwd');
var hasFlag = require('has-flag');
var localCLI = resolveCwd('xo/cli');

if (!hasFlag('no-local') && localCLI && localCLI !== __filename) {
	debug('Using local install of XO.');
	require(localCLI);
	return;
}

var updateNotifier = require('update-notifier');
var getStdin = require('get-stdin');
var spawn = require('child_process').spawn;
var meow = require('meow');
var path = require('path');
var xo = require('./');

var cli = meow({
	help: [
		'Usage',
		'  $ xo [<file|glob> ...]',
		'',
		'Options',
		'  --init          Add XO to your project',
		'  --fix           Automagically fix issues',
		'  --compact       Compact output',
		'  --stdin         Validate code from stdin',
		'  --esnext        Enable ES2015+ rules',
		'  --env           Environment preset  [Can be set multiple times]',
		'  --global        Global variable  [Can be set multiple times]',
		'  --ignore        Additional paths to ignore  [Can be set multiple times]',
		'  --space         Use space indent instead of tabs  [Default: 2]',
		'  --no-semicolon  Prevent use of semicolons',
		'  --plugin        Include third-party plugins  [Can be set multiple times]',
		'  --extend        Extend defaults with a custom config  [Can be set multiple times]',
		'  --open          Open files with issues in your editor',
		'',
		'Examples',
		'  $ xo',
		'  $ xo index.js',
		'  $ xo *.js !foo.js',
		'  $ xo --esnext --space',
		'  $ xo --env=node --env=mocha',
		'  $ xo --init --esnext',
		'  $ xo --plugin=react',
		'',
		'Tips',
		'  Put options in package.json instead of using flags so other tools can read it.'
	]
}, {
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

var input = cli.input;
var opts = cli.flags;

function log(report) {
	process.stdout.write(xo.getFormatter(opts.compact && 'compact')(report.results));
	process.exit(report.errorCount === 0 ? 0 : 1);
}

function open(report) {
	if (report.errorCount === 0) {
		return;
	}

	var editor = process.env.EDITOR;

	if (!editor) {
		console.log();
		console.log('`open` option was used, but your $EDITOR environment variable is empty.');
		console.log('Fix it by setting path to your editor of choice in ~/.bashrc or ~/.zshrc:');
		console.log();
		console.log('    export EDITOR=atom');
		console.log();
		return;
	}

	var executableName = editor.split(path.sep).pop();

	function lineColumn(message) {
		return message.line + ':' + message.column;
	}

	var args = [];

	report.results
		.filter(function (file) {
			return file.errorCount > 0;
		})
		.forEach(function (file) {
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
	getStdin().then(function (str) {
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
	xo.lintFiles(input, opts).then(function (report) {
		if (opts.fix) {
			xo.outputFixes(report);
		}

		if (opts.open) {
			open(report);
		}

		log(report);
	});
}
