import path from 'node:path';
import {ESLint} from 'eslint';
import {globby, isGitIgnoredSync} from 'globby';
import {isEqual} from 'lodash-es';
import micromatch from 'micromatch';
import arrify from 'arrify';
import slash from 'slash';
import {
	parseOptions,
	getIgnores,
	mergeWithFileConfig,
} from './lib/options-manager.js';
import {mergeReports, processReport} from './lib/report.js';

const globFiles = async (patterns, options) => {
	const {ignores, extensions, cwd} = mergeWithFileConfig(options).options;

	patterns = patterns.length === 0
		? [`**/*.{${extensions.join(',')}}`]
		: arrify(patterns).map(pattern => slash(pattern));

	const files = await globby(
		patterns,
		{ignore: ignores, gitignore: true, absolute: true, cwd},
	);

	return files.filter(file => extensions.includes(path.extname(file).slice(1)));
};

const getConfig = async options => {
	const {filePath, eslintOptions} = parseOptions(options);
	const engine = new ESLint(eslintOptions);
	return engine.calculateConfigForFile(filePath);
};

const runEslint = async (lint, options) => {
	const {filePath, eslintOptions, isQuiet} = options;
	const {cwd, baseConfig: {ignorePatterns}} = eslintOptions;
	const eslint = new ESLint(eslintOptions);

	if (
		filePath
		&& (
			micromatch.isMatch(path.relative(cwd, filePath), ignorePatterns)
			|| isGitIgnoredSync({cwd, ignore: ignorePatterns})(filePath)
			|| await eslint.isPathIgnored(filePath)
		)
	) {
		return {
			errorCount: 0,
			warningCount: 0,
			results: [
				{
					errorCount: 0,
					warningCount: 0,
					filePath,
					messages: [],
				},
			],
			isIgnored: true,
		};
	}

	const report = await lint(eslint);
	return processReport(report, {isQuiet});
};

const lintText = async (string, inputOptions = {}) => {
	const options = parseOptions(inputOptions);
	const {filePath, warnIgnored, eslintOptions} = options;
	const {ignorePatterns} = eslintOptions.baseConfig;

	if (typeof filePath !== 'string' && !isEqual(getIgnores({}), ignorePatterns)) {
		throw new Error('The `ignores` option requires the `filePath` option to be defined.');
	}

	return runEslint(
		eslint => eslint.lintText(string, {filePath, warnIgnored}),
		options,
	);
};

const lintFile = async (filePath, options) => runEslint(
	eslint => eslint.lintFiles([filePath]),
	parseOptions({...options, filePath}),
);

const lintFiles = async (patterns, inputOptions = {}) => {
	const files = await globFiles(patterns, inputOptions);

	const reports = await Promise.all(
		files.map(filePath => lintFile(filePath, inputOptions)),
	);

	const report = mergeReports(reports.filter(({isIgnored}) => !isIgnored));

	return report;
};

const getFormatter = async name => {
	const {format} = await new ESLint().loadFormatter(name);
	return format;
};

const xo = {
	getFormatter,
	getErrorResults: ESLint.getErrorResults,
	outputFixes: async ({results}) => ESLint.outputFixes(results),
	getConfig,
	lintText,
	lintFiles,
};

export default xo;
