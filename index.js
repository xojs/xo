import path from 'node:path';
import {ESLint} from 'eslint';
import {globby, isGitIgnoredSync} from 'globby';
import {isEqual, groupBy} from 'lodash-es';
import micromatch from 'micromatch';
import arrify from 'arrify';
import slash from 'slash';
import {
	parseOptions,
	getIgnores,
	mergeWithFileConfig,
} from './lib/options-manager.js';
import {mergeReports, processReport, getIgnoredReport} from './lib/report.js';

const runEslint = async (lint, options, eslint) => {
	const {filePath, eslintOptions, isQuiet} = options;
	const {cwd, baseConfig: {ignorePatterns}} = eslintOptions;

	if (
		filePath
		&& (
			micromatch.isMatch(path.relative(cwd, filePath), ignorePatterns)
			|| isGitIgnoredSync({cwd, ignore: ignorePatterns})(filePath)
		)
	) {
		return getIgnoredReport(filePath);
	}

	eslint = eslint || new ESLint(eslintOptions);

	if (filePath && await eslint.isPathIgnored(filePath)) {
		return getIgnoredReport(filePath);
	}

	const report = await lint(eslint);
	return processReport(report, {isQuiet});
};

const globFiles = async (patterns, options) => {
	const {ignores, extensions, cwd} = (await mergeWithFileConfig(options)).options;

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
	const {filePath, eslintOptions} = await parseOptions(options);
	const engine = new ESLint(eslintOptions);
	return engine.calculateConfigForFile(filePath);
};

const lintText = async (string, options) => {
	options = await parseOptions(options);
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

const lintFiles = async (patterns, options) => {
	const files = await globFiles(patterns, options);

	const allOptions = await Promise.all(
		files.map(filePath => parseOptions({...options, filePath})),
	);

	// Files with same `xoConfigPath` can lint together
	// https://github.com/xojs/xo/issues/599
	const groups = groupBy(allOptions, 'xoConfigPath');
	const reports = await Promise.all(
		Object.values(groups)
			.map(filesWithOptions => {
				const options = filesWithOptions[0];
				const eslint = new ESLint(options.eslintOptions);
				const files = filesWithOptions.map(({filePath}) => filePath);

				return runEslint(
					() => eslint.lintFiles(files),
					options,
					eslint,
				);
			}),
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
