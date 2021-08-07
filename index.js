import process from 'node:process';
import path from 'node:path';
import {ESLint} from 'eslint';
import {globby, isGitIgnoredSync} from 'globby';
import {omit, isEqual} from 'lodash-es';
import micromatch from 'micromatch';
import arrify from 'arrify';
import pMap from 'p-map';
import slash from 'slash';
import {
	normalizeOptions,
	getIgnores,
	mergeWithFileConfig,
	buildConfig,
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
	const {options: foundOptions, prettierOptions} = mergeWithFileConfig(normalizeOptions(options));
	const {filePath, warnIgnored, ...eslintOptions} = buildConfig(foundOptions, prettierOptions);
	const engine = new ESLint(eslintOptions);
	return engine.calculateConfigForFile(filePath);
};

const runEslint = async (lint, options, processorOptions) => {
	const {filePath, warnIgnored, ...eslintOptions} = options;
	const engine = new ESLint(eslintOptions);

	if (
		filePath
		&& (
			micromatch.isMatch(path.relative(options.cwd, filePath), options.baseConfig.ignorePatterns)
			|| isGitIgnoredSync({cwd: options.cwd, ignore: options.baseConfig.ignorePatterns})(filePath)
			|| await engine.isPathIgnored(filePath)
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

	const report = await lint(engine);
	return processReport(report, processorOptions);
};

const lintText = async (string, inputOptions = {}) => {
	const {options: foundOptions, prettierOptions} = mergeWithFileConfig(normalizeOptions(inputOptions));
	const options = buildConfig(foundOptions, prettierOptions);
	const {filePath, warnIgnored, ...eslintOptions} = options;

	if (options.baseConfig.ignorePatterns && !isEqual(getIgnores({}), options.baseConfig.ignorePatterns) && typeof options.filePath !== 'string') {
		throw new Error('The `ignores` option requires the `filePath` option to be defined.');
	}

	return runEslint(
		engine => engine.lintText(string, {filePath, warnIgnored}),
		options,
		{isQuiet: inputOptions.quiet},
	);
};

const lintFile = async (filePath, inputOptions) => {
	const {options: foundOptions, prettierOptions} = mergeWithFileConfig({
		...inputOptions,
		filePath,
	});
	const options = buildConfig(foundOptions, prettierOptions);

	return runEslint(
		engine => engine.lintFiles([filePath]),
		options,
		{isQuiet: inputOptions.quiet},
	);
};

const lintFiles = async (patterns, inputOptions = {}) => {
	inputOptions = normalizeOptions(inputOptions);
	inputOptions.cwd = path.resolve(inputOptions.cwd || process.cwd());

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
