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
	mergeOptions,
} from './lib/options-manager.js';
import {mergeReports, processReport} from './lib/report.js';

const getEmptyReport = filePath => ({
	errorCount: 0,
	warningCount: 0,
	results: [{
		errorCount: 0,
		filePath,
		messages: [],
		warningCount: 0,
	}],
});

const runEslint = async (filePath, options, processorOptions) => {
	const engine = new ESLint(omit(options, ['filePath', 'warnIgnored']));
	const filename = path.relative(options.cwd, filePath);

	if (
		micromatch.isMatch(filename, options.baseConfig.ignorePatterns)
			|| isGitIgnoredSync({cwd: options.cwd, ignore: options.baseConfig.ignorePatterns})(filePath)
			|| await engine.isPathIgnored(filePath)
	) {
		return getEmptyReport(filePath);
	}

	const report = await engine.lintFiles([filePath]);
	return processReport(report, processorOptions);
};

const runEslintText = async (string, options, processorOptions) => {
	const {filePath, warnIgnored, ...eslintOptions} = options;
	const engine = new ESLint(eslintOptions);

	if (filePath) {
		const filename = path.relative(options.cwd, filePath);

		if (
			micromatch.isMatch(filename, options.baseConfig.ignorePatterns)
			|| isGitIgnoredSync({cwd: options.cwd, ignore: options.baseConfig.ignorePatterns})(filePath)
			|| await engine.isPathIgnored(filePath)
		) {
			return getEmptyReport(filePath);
		}
	}

	const report = await engine.lintText(string, {filePath, warnIgnored});

	return processReport(report, processorOptions);
};

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

const lintText = async (string, inputOptions = {}) => {
	const {options: foundOptions, prettierOptions} = mergeWithFileConfig(normalizeOptions(inputOptions));
	const options = buildConfig(foundOptions, prettierOptions);

	if (options.baseConfig.ignorePatterns && !isEqual(getIgnores({}), options.baseConfig.ignorePatterns) && typeof options.filePath !== 'string') {
		throw new Error('The `ignores` option requires the `filePath` option to be defined.');
	}

	return runEslintText(string, options, {isQuiet: inputOptions.quiet});
};

const lintFile = async (filePath, inputOptions) => {
	const {options: foundOptions, prettierOptions} = mergeWithFileConfig({
		...inputOptions,
		filePath,
	});
	const options = buildConfig(foundOptions, prettierOptions);
	return runEslint(filePath, options, {isQuiet: inputOptions.quiet});
};

const lintFiles = async (patterns, inputOptions = {}) => {
	inputOptions = normalizeOptions(inputOptions);
	inputOptions.cwd = path.resolve(inputOptions.cwd || process.cwd());

	const files = await globFiles(patterns, inputOptions);

	const reports = await pMap(
		files,
		async filePath => lintFile(filePath, inputOptions),
	);

	return mergeReports(reports);
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
