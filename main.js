#!/usr/bin/env node
'use strict';
const updateNotifier = require('update-notifier');
const getStdin = require('get-stdin');
const meow = require('meow');
const formatterPretty = require('eslint-formatter-pretty');
const openEditor = require('open-editor');
const xo = require('.');

const cli = meow(`
	Usage
	  $ xo [<file|glob> ...]

	Options
	  --init            Add XO to your project
	  --fix             Automagically fix issues
	  --reporter        Reporter to use
	  --env             Environment preset  [Can be set multiple times]
	  --global          Global variable  [Can be set multiple times]
	  --ignore          Additional paths to ignore  [Can be set multiple times]
	  --space           Use space indent instead of tabs  [Default: 2]
	  --no-semicolon    Prevent use of semicolons
	  --plugin          Include third-party plugins  [Can be set multiple times]
	  --extend          Extend defaults with a custom config  [Can be set multiple times]
	  --open            Open files with issues in your editor
	  --quiet           Show only errors and no warnings
	  --extension       Additional extension to lint [Can be set multiple times]
	  --no-esnext       Don't enforce ES2015+ rules
	  --cwd=<dir>       Working directory for files
	  --stdin           Validate/fix code from stdin
	  --stdin-filename  Specify a filename for the --stdin option

	Examples
	  $ xo
	  $ xo index.js
	  $ xo *.js !foo.js
	  $ xo --space
	  $ xo --env=node --env=mocha
	  $ xo --init --space
	  $ xo --plugin=react
	  $ xo --plugin=html --extension=html
	  $ echo 'const x=true' | xo --stdin --fix

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
	],
	alias: {
		'stdin-filename': 'filename'
	}
});

updateNotifier({pkg: cli.pkg}).notify();

const input = cli.input;
const opts = cli.flags;

const log = report => {
	// Legacy
	// TODO: Remove in 1.0.0
	if (opts.compact) {
		opts.reporter = 'compact';
	}

	const reporter = opts.reporter ? xo.getFormatter(opts.reporter) : formatterPretty;

	process.stdout.write(reporter(report.results));
	process.exit(report.errorCount === 0 ? 0 : 1);
};

const files = (report, predicate) => report.results
	.filter(predicate)
	.map(result => ({
		file: result.filePath,
		line: result.messages[0].line,
		column: result.messages[0].column
	}));

const open = report => {
	if (report.errorCount > 0) {
		openEditor(files(report, result => result.errorCount > 0));
	}	else if (report.warningCount > 0) {
		openEditor(files(report, result => result.warningCount > 0));
	}
};

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
			console.log(xo.lintText(str, opts).results[0].output);
			return;
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
