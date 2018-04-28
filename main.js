#!/usr/bin/env node
'use strict';
const updateNotifier = require('update-notifier');
const getStdin = require('get-stdin');
const meow = require('meow');
const formatterPretty = require('eslint-formatter-pretty');
const semver = require('semver');
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
	  --prettier        Conform to Prettier code style
	  --node-version    Range of Node.js version to support
	  --plugin          Include third-party plugins  [Can be set multiple times]
	  --extend          Extend defaults with a custom config  [Can be set multiple times]
	  --open            Open files with issues in your editor
	  --quiet           Show only errors and no warnings
	  --extension       Additional extension to lint [Can be set multiple times]
	  --no-esnext       Don't enforce ES2015+ rules
	  --cwd=<dir>       Working directory for files
	  --stdin           Validate/fix code from stdin
	  --stdin-filename  Specify a filename for the --stdin option
	  --print-config    Print the configuration for the given file

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
	  $ xo --print-config index.js

	Tips
	  Put options in package.json instead of using flags so other tools can read it.
`, {
	booleanDefault: undefined,
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
		semicolon: {
			type: 'boolean'
		},
		prettier: {
			type: 'boolean'
		},
		nodeVersion: {
			type: 'string'
		},
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
			type: 'boolean'
		},
		cwd: {
			type: 'string'
		},
		printConfig: {
			type: 'boolean',
			default: false
		},
		stdin: {
			type: 'boolean'
		},
		stdinFilename: {
			type: 'string',
			alias: 'filename'
		}
	}
});

updateNotifier({pkg: cli.pkg}).notify();

const {input, flags: opts} = cli;

const log = report => {
	const reporter = opts.reporter ? xo.getFormatter(opts.reporter) : formatterPretty;

	process.stdout.write(reporter(report.results));
	process.exit(report.errorCount === 0 ? 0 : 1);
};

// `xo -` => `xo --stdin`
if (input[0] === '-') {
	opts.stdin = true;
	input.shift();
}

if (opts.nodeVersion) {
	if (opts.nodeVersion === 'false') {
		opts.engines = false;
	} else if (semver.validRange(opts.nodeVersion)) {
		opts.engines = {node: opts.nodeVersion};
	} else {
		console.error('The `node-engine` option must be a valid semver range (for example `>=6`)');
		process.exit(1);
	}
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

		if (opts.printConfig) {
			console.error('The `print-config` option is not supported on stdin');
			process.exit(1);
		}

		log(xo.lintText(str, opts));
	});
} else if (opts.printConfig) {
	if (input.length !== 1) {
		console.error('The `print-config` option must be used with exactly one file name');
		process.exit(1);
	}
	const config = xo.getConfigForFile(input[0], opts);
	console.log(JSON.stringify(config, null, '	'));
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
