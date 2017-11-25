#!/usr/bin/env node
'use strict';
const updateNotifier = require('update-notifier');
const getStdin = require('get-stdin');
const meow = require('meow');
const formatterPretty = require('eslint-formatter-pretty');
const openReport = require('./lib/open-report');
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
		--prettier        Format code with Prettier [Default: false]
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
	flags: {
		init: {
			type: 'boolean'
		},
		fix: {
			type: 'boolean'
		},
		reporter: {
			type: 'string'
		},
		env: {
			type: 'string'
		},
		global: {
			type: 'string'
		},
		ignore: {
			type: 'string'
		},
		space: {
			type: 'string'
		},
		// TODO: We need to be able to tell whether it was specified
		// or not as CLI arguments overrides package.json config
		// semicolon: {
		// 	type: 'boolean',
		// 	default: true
		// },
		plugin: {
			type: 'string'
		},
		extend: {
			type: 'string'
		},
		open: {
			type: 'boolean'
		},
		quiet: {
			type: 'boolean'
		},
		extension: {
			type: 'string'
		},
		esnext: {
			type: 'boolean',
			default: true
		},
		cwd: {
			type: 'string'
		},
		stdin: {
			type: 'boolean'
		},
		stdinFilename: {
			type: 'string',
			alias: 'filename'
		},
		// TODO: Remove in 1.0.0
		compact: {
			type: 'boolean'
		}
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
			openReport(report);
		}

		log(report);
	});
}
