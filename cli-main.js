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

const {input, flags: options} = cli;

// Make data types for `options.space` match those of the API
// Check for string type because `xo --no-space` sets `options.space` to `false`
if (typeof options.space === 'string') {
	if (/^\d+$/u.test(options.space)) {
		options.space = parseInt(options.space, 10);
	} else if (options.space === 'true') {
		options.space = true;
	} else if (options.space === 'false') {
		options.space = false;
	} else {
		if (options.space !== '') {
			// Assume `options.space` was set to a filename when run as `xo --space file.js`
			input.push(options.space);
		}

		options.space = true;
	}
}

const log = report => {
	const reporter = options.reporter ? xo.getFormatter(options.reporter) : formatterPretty;
	process.stdout.write(reporter(report.results));
	process.exit(report.errorCount === 0 ? 0 : 1);
};

// `xo -` => `xo --stdin`
if (input[0] === '-') {
	options.stdin = true;
	input.shift();
}

if (options.nodeVersion) {
	if (options.nodeVersion === 'false') {
		options.nodeVersion = false;
	} else if (!semver.validRange(options.nodeVersion)) {
		console.error('The `node-engine` option must be a valid semver range (for example `>=6`)');
		process.exit(1);
	}
}

(async () => {
	if (options.init) {
		require('xo-init')();
	} else if (options.stdin) {
		const stdin = await getStdin();

		if (options.fix) {
			const result = xo.lintText(stdin, options).results[0];
			// If there is no output, pass the stdin back out
			console.log(result.output || stdin);
			return;
		}

		if (options.open) {
			console.error('The `open` option is not supported on stdin');
			process.exit(1);
		}

		log(xo.lintText(stdin, options));
	} else {
		const report = await xo.lintFiles(input, options);

		if (options.fix) {
			xo.outputFixes(report);
		}

		if (options.open) {
			openReport(report);
		}

		log(report);
	}
})();
