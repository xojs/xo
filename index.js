import path from 'node:path';
import {ESLint} from 'eslint';
import globby from 'globby';
import {isEqual} from 'lodash-es';
import micromatch from 'micromatch';
import arrify from 'arrify';
import pReduce from 'p-reduce';
import pMap from 'p-map';
import {cosmiconfig, defaultLoaders} from 'cosmiconfig';
import defineLazyProperty from 'define-lazy-prop';
import pFilter from 'p-filter';
import slash from 'slash';
import {CONFIG_FILES, MODULE_NAME, DEFAULT_IGNORES} from './lib/constants.js';
import {
	normalizeOptions,
	getIgnores,
	mergeWithFileConfig,
	mergeWithFileConfigs,
	buildConfig,
	mergeOptions,
} from './lib/options-manager.js';

/** Merge multiple reports into a single report */
const mergeReports = reports => {
	const report = {
		results: [],
		errorCount: 0,
		warningCount: 0,
	};

	for (const currentReport of reports) {
		report.results.push(...currentReport.results);
		report.errorCount += currentReport.errorCount;
		report.warningCount += currentReport.warningCount;
	}

	return report;
};

const getReportStatistics = results => {
	const statistics = {
		errorCount: 0,
		warningCount: 0,
		fixableErrorCount: 0,
		fixableWarningCount: 0,
	};

	for (const result of results) {
		statistics.errorCount += result.errorCount;
		statistics.warningCount += result.warningCount;
		statistics.fixableErrorCount += result.fixableErrorCount;
		statistics.fixableWarningCount += result.fixableWarningCount;
	}

	return statistics;
};

const processReport = (report, {isQuiet = false} = {}) => {
	if (isQuiet) {
		report = ESLint.getErrorResults(report);
	}

	const result = {
		results: report,
		...getReportStatistics(report),
	};

	defineLazyProperty(result, 'usedDeprecatedRules', () => {
		const seenRules = new Set();
		const rules = [];

		for (const {usedDeprecatedRules} of report) {
			for (const rule of usedDeprecatedRules) {
				if (seenRules.has(rule.ruleId)) {
					continue;
				}

				seenRules.add(rule.ruleId);
				rules.push(rule);
			}
		}

		return rules;
	});

	return result;
};

const runEslint = async (paths, options, processorOptions) => {
	const engine = new ESLint(options);

	const report = await engine.lintFiles(await pFilter(paths, async path => !(await engine.isPathIgnored(path))));
	return processReport(report, processorOptions);
};

const globFiles = async (patterns, {ignores, extensions, cwd}) => (
	await globby(
		patterns.length === 0 ? [`**/*.{${extensions.join(',')}}`] : arrify(patterns).map(pattern => slash(pattern)),
		{ignore: ignores, gitignore: true, absolute: true, cwd},
	)).filter(file => extensions.includes(path.extname(file).slice(1)));

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

	const {filePath, warnIgnored, ...eslintOptions} = options;
	const engine = new ESLint(eslintOptions);

	if (filePath) {
		const filename = path.relative(options.cwd, filePath);

		if (
			micromatch.isMatch(filename, options.baseConfig.ignorePatterns)
			|| globby.gitignore.sync({cwd: options.cwd, ignore: options.baseConfig.ignorePatterns})(filePath)
			|| await engine.isPathIgnored(filePath)
		) {
			return {
				errorCount: 0,
				warningCount: 0,
				results: [{
					errorCount: 0,
					filePath: filename,
					messages: [],
					warningCount: 0,
				}],
			};
		}
	}

	const report = await engine.lintText(string, {filePath, warnIgnored});

	return processReport(report, {isQuiet: inputOptions.quiet});
};

const lintFiles = async (patterns, inputOptions = {}) => {
	inputOptions.cwd = path.resolve(inputOptions.cwd || process.cwd());
	const configExplorer = cosmiconfig(MODULE_NAME, {searchPlaces: CONFIG_FILES, loaders: {noExt: defaultLoaders['.json']}, stopDir: inputOptions.cwd});

	const configFiles = (await Promise.all(
		(await globby(
			CONFIG_FILES.map(configFile => `**/${configFile}`),
			{ignore: DEFAULT_IGNORES, gitignore: true, absolute: true, cwd: inputOptions.cwd},
		)).map(configFile => configExplorer.load(configFile)),
	)).filter(Boolean);

	const paths = configFiles.length > 0
		? await pReduce(
			configFiles,
			async (paths, {filepath, config}) =>
				[...paths, ...(await globFiles(patterns, {...mergeOptions(inputOptions, config), cwd: path.dirname(filepath)}))],
			[])
		: await globFiles(patterns, mergeOptions(inputOptions));

	return mergeReports(await pMap(await mergeWithFileConfigs([...new Set(paths)], inputOptions, configFiles), async ({files, options, prettierOptions}) => runEslint(files, buildConfig(options, prettierOptions), {isQuiet: options.quiet})));
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
