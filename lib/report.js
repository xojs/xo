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
	}

	return report;
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

export {mergeReports, processReport};
