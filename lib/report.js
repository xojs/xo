import defineLazyProperty from 'define-lazy-prop';
import {ESLint} from 'eslint';

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
		report.rulesMeta = {...report.rulesMeta, ...currentReport.rulesMeta};
	}

	return report;
};

const processReport = (report, {isQuiet = false, rulesMeta} = {}) => {
	if (isQuiet) {
		report = ESLint.getErrorResults(report);
	}

	const result = {
		results: report,
		rulesMeta,
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

const getIgnoredReport = filePath => ({
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
});

export {mergeReports, processReport, getIgnoredReport};
