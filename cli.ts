#!/usr/bin/env node

import path from 'node:path';
import fs from 'node:fs/promises';
import process from 'node:process';
import {type Rule, type ESLint} from 'eslint';
import formatterPretty from 'eslint-formatter-pretty';
import getStdin from 'get-stdin';
import meow from 'meow';
import {pathExists} from 'path-exists';
import {tsExtensions} from './lib/constants.js';
import type {LinterOptions, XoConfigOptions} from './lib/types.js';
import {Xo} from './lib/xo.js';
import openReport from './lib/open-report.js';

const cli = meow(
	`
  Usage
    $ xo [<file|glob> ...]

  Options
    --fix             Automagically fix issues
    --reporter        Reporter to use
    --space           Use space indent instead of tabs [Default: 2]
    --semicolon       Use semicolons [Default: true]
    --prettier        Conform to Prettier code style [Default: false]
    --react           Include React specific parsing and xo-react linting rules [Default: false]
    --prettier        Format with prettier or turn off prettier conflicted rules when set to 'compat' [Default: false]
    --ts              Auto configure type aware linting on unincluded ts files [Default: true]
    --print-config    Print the effective ESLint config for the given file
    --open            Open files with issues in your editor
    --stdin           Validate/fix code from stdin
    --stdin-filename  Specify a filename for the --stdin option
    --ignore          Ignore pattern globs, can be set multiple times
    --cwd=<dir>       Working directory for files [Default: process.cwd()]

  Examples
    $ xo
    $ xo index.js
    $ xo *.js !foo.js
    $ xo --space
    $ xo --print-config=index.js
`,
	{
		importMeta: import.meta,
		autoVersion: false,
		booleanDefault: undefined,
		flags: {
			fix: {
				type: 'boolean',
				default: false,
			},
			reporter: {
				type: 'string',
			},
			space: {
				type: 'string',
			},
			config: {
				type: 'string',
			},
			quiet: {
				type: 'boolean',
			},
			semicolon: {
				type: 'boolean',
			},
			prettier: {
				type: 'boolean',
			},
			ts: {
				type: 'boolean',
				default: true,
			},
			react: {
				type: 'boolean',
				default: false,
			},
			cwd: {
				type: 'string',
				default: process.cwd(),
			},
			printConfig: {
				type: 'string',
			},
			version: {
				type: 'boolean',
			},
			stdin: {
				type: 'boolean',
			},
			stdinFilename: {
				type: 'string',
				default: 'stdin.js',
			},
			open: {
				type: 'boolean',
			},
			ignore: {
				type: 'string',
				isMultiple: true,
				aliases: ['ignores'],
			},
		},
	},
);

export type CliOptions = typeof cli;

const {input, flags: cliOptions, showVersion} = cli;

const baseXoConfigOptions: XoConfigOptions = {
	space: cliOptions.space,
	semicolon: cliOptions.semicolon,
	prettier: cliOptions.prettier,
	ignores: cliOptions.ignore,
	react: cliOptions.react,
};

const linterOptions: LinterOptions = {
	fix: cliOptions.fix,
	cwd: (cliOptions.cwd && path.resolve(cliOptions.cwd)) ?? process.cwd(),
	quiet: cliOptions.quiet,
	ts: cliOptions.ts,
};

// Make data types for `options.space` match those of the API
if (typeof cliOptions.space === 'string') {
	cliOptions.space = cliOptions.space.trim();

	if (/^\d+$/u.test(cliOptions.space)) {
		baseXoConfigOptions.space = Number.parseInt(cliOptions.space, 10);
	} else if (cliOptions.space === 'true') {
		baseXoConfigOptions.space = true;
	} else if (cliOptions.space === 'false') {
		baseXoConfigOptions.space = false;
	} else {
		if (cliOptions.space !== '') {
			// Assume `options.space` was set to a filename when run as `xo --space file.js`
			input.push(cliOptions.space);
		}

		baseXoConfigOptions.space = true;
	}
}

if (
	process.env['GITHUB_ACTIONS']
	&& !linterOptions.fix
	&& !cliOptions.reporter
) {
	linterOptions.quiet = true;
}

const log = async (report: {
	errorCount: number;
	warningCount: number;
	fixableErrorCount: number;
	fixableWarningCount: number;
	results: ESLint.LintResult[];
	rulesMeta: Record<string, Rule.RuleMetaData>;
}) => {
	const reporter = cliOptions.reporter
		? await new Xo(linterOptions, baseXoConfigOptions).getFormatter(cliOptions.reporter)
		: {format: formatterPretty};

	// @ts-expect-error the types don't quite match up here
	console.log(reporter.format(report.results, {cwd: linterOptions.cwd, ...report}));

	process.exitCode = report.errorCount === 0 ? 0 : 1;
};

if (cliOptions.version) {
	showVersion();
}

if (cliOptions.stdin) {
	const stdin = await getStdin();

	let shouldRemoveStdInFile = false;

	// For ts, we need a file on the filesystem to lint it or else @typescript-eslint will blow up.
	// We create a temporary file in the node_modules/.cache/xo-linter directory to avoid conflicts with the user's files and lint that file as if it were the stdin input as a work around.
	// We clean up the file after linting.
	if (cliOptions.stdinFilename && tsExtensions.includes(path.extname(cliOptions.stdinFilename).slice(1))) {
		const absoluteFilePath = path.resolve(cliOptions.cwd, cliOptions.stdinFilename);
		if (!await pathExists(absoluteFilePath)) {
			cliOptions.stdinFilename = path.join(cliOptions.cwd, 'node_modules', '.cache', 'xo-linter', path.basename(absoluteFilePath));
			shouldRemoveStdInFile = true;
			baseXoConfigOptions.ignores = [
				'!**/node_modules/**',
				'!node_modules/**',
				'!node_modules/',
				`!${path.relative(cliOptions.cwd, cliOptions.stdinFilename)}`,
			];
			if (!await pathExists(path.dirname(cliOptions.stdinFilename))) {
				await fs.mkdir(path.dirname(cliOptions.stdinFilename), {recursive: true});
			}

			await fs.writeFile(cliOptions.stdinFilename, stdin);
		}
	}

	if (cliOptions.fix) {
		const xo = new Xo(linterOptions, baseXoConfigOptions);
		const {results: [result]} = await xo.lintText(stdin, {
			filePath: cliOptions.stdinFilename,
		});
		process.stdout.write((result?.output) ?? stdin);
		process.exit(0);
	}

	if (cliOptions.open) {
		console.error('The `--open` flag is not supported on stdin');
		if (shouldRemoveStdInFile) {
			await fs.rm(cliOptions.stdinFilename);
		}

		process.exit(1);
	}

	const xo = new Xo(linterOptions, baseXoConfigOptions);
	await log(await xo.lintText(stdin, {filePath: cliOptions.stdinFilename, warnIgnored: true}));
	if (shouldRemoveStdInFile) {
		await fs.rm(cliOptions.stdinFilename);
	}

	process.exit(0);
}

if (typeof cliOptions.printConfig === 'string') {
	if (input.length > 0 || cliOptions.printConfig === '') {
		console.error('The `--print-config` flag must be used with exactly one filename');
		process.exit(1);
	}

	const config = await new Xo(linterOptions, baseXoConfigOptions).calculateConfigForFile(cliOptions.printConfig);
	console.log(JSON.stringify(config, undefined, '\t'));
} else {
	const xo = new Xo(linterOptions, baseXoConfigOptions);

	const report = await xo.lintFiles(input);

	if (cliOptions.fix) {
		await Xo.outputFixes(report);
	}

	if (cliOptions.open) {
		await openReport(report);
	}

	await log(report);
}
