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
	getOptionGroups,
} from './lib/options-manager.js';
import {mergeReports, processReport, getIgnoredReport} from './lib/report.js';

const globFiles = async (patterns, options) => {
	const {
		options: {
			ignores,
			extensions,
			cwd,
		},
	} = await mergeWithFileConfig(options);

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
	const [[options_]] = Object.values(await getOptionGroups([options && options.filePath], options));
	const {filePath, warnIgnored, eslintOptions, isQuiet} = options_;
	const {cwd, baseConfig: {ignorePatterns}} = eslintOptions;

	if (typeof filePath !== 'string' && !isEqual(getIgnores({}), ignorePatterns)) {
		throw new Error('The `ignores` option requires the `filePath` option to be defined.');
	}

	if (
		filePath
		&& (
			micromatch.isMatch(path.relative(cwd, filePath), ignorePatterns)
			// TODO: Use async version when `globby` fix `isGitIgnored`
			|| isGitIgnoredSync({cwd})(filePath)
		)
	) {
		return getIgnoredReport(filePath);
	}

	const eslint = new ESLint(eslintOptions);

	if (filePath && await eslint.isPathIgnored(filePath)) {
		return getIgnoredReport(filePath);
	}

	const report = await eslint.lintText(string, {filePath, warnIgnored});

	const rulesMeta = eslint.getRulesMetaForResults(report);

	return processReport(report, {isQuiet, rulesMeta});
};

const lintFiles = async (patterns, options) => {
	const files = await globFiles(patterns, options);

	const groups = await getOptionGroups(files, options);

	const reports = await Promise.all(
		Object.values(groups)
			.map(async filesWithOptions => {
				const options = filesWithOptions[0];
				const eslint = new ESLint(options.eslintOptions);
				const files = [];

				for (const options of filesWithOptions) {
					const {filePath, eslintOptions} = options;
					const {cwd, baseConfig: {ignorePatterns}} = eslintOptions;
					if (
						micromatch.isMatch(path.relative(cwd, filePath), ignorePatterns)
						// eslint-disable-next-line no-await-in-loop
						|| await eslint.isPathIgnored(filePath)
					) {
						continue;
					}

					files.push(filePath);
				}

				const report = await eslint.lintFiles(files);

				const rulesMeta = eslint.getRulesMetaForResults(report);

				return processReport(report, {isQuiet: options.isQuiet, rulesMeta});
			}));

	const report = mergeReports(reports);

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
