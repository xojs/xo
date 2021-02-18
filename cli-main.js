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
	  $ xo --plugin=react
	  $ xo --plugin=html --extension=html
	  $ echo 'const x=true' | xo --stdin --fix

	Tips
	  - Add XO to your project with \`npm init xo\`.
	  - Put options in package.json instead of using flags so other tools can read it.
`, {
	autoVersion: false,
	booleanDefault: undefined,
	flags: {
		fix: {
			type: 'boolean'
		},
		reporter: {
			type: 'string'
		},
		env: {
			type: 'string',
			isMultiple: true
		},
		global: {
			type: 'string',
			isMultiple: true
		},
		ignore: {
			type: 'string',
			isMultiple: true
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
			type: 'string',
			isMultiple: true
		},
		extend: {
			type: 'string',
			isMultiple: true
		},
		open: {
			type: 'boolean'
		},
		quiet: {
			type: 'boolean'
		},
		extension: {
			type: 'string',
			isMultiple: true
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
			type: 'string'
		}
	}
});

updateNotifier({pkg: cli.pkg}).notify();

const {input, flags: options, showVersion} = cli;

// Revert behavior of meow >8 to pre-8 (7.1.1) for flags using `isMultiple: true``
// Otherwise options defined in package.json can't be merged by lib/options-manager.js mergeOptions()
for (const key in options) {
	if (Array.isArray(options[key]) && options[key].length === 0) {
		delete options[key];
	}
}

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

if (process.env.GITHUB_ACTIONS && !options.fix && !options.reporter) {
	options.quiet = true;
}

const log = report => {
	const reporter = options.reporter || process.env.GITHUB_ACTIONS ? xo.getFormatter(options.reporter || 'compact') : formatterPretty;
	process.stdout.write(reporter(report.results));
	process.exitCode = report.errorCount === 0 ? 0 : 1;
};

// `xo -` => `xo --stdin`
if (input[0] === '-') {
	options.stdin = true;
	input.shift();
}

if (options.version) {
	showVersion();
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
	if (options.stdin) {
		const stdin = await getStdin();

		if (options.stdinFilename) {
			options.filename = options.stdinFilename;
		}

		if (options.fix) {
			const result = xo.lintText(stdin, options).results[0];
			// If there is no output, pass the stdin back out
			process.stdout.write((result && result.output) || stdin);
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
