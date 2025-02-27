import openEditor from 'open-editor';
import type {ESLint} from 'eslint';
import {type XoLintResult} from './types.js';

const sortResults = (a: ESLint.LintResult, b: ESLint.LintResult) => a.errorCount + b.errorCount > 0 ? (a.errorCount - b.errorCount) : (a.warningCount - b.warningCount);

const resultToFile = (result: ESLint.LintResult) => {
	const [message] = result.messages
		.sort((a, b) => {
			if (a.severity < b.severity) {
				return 1;
			}

			if (a.severity > b.severity) {
				return -1;
			}

			if (a.line < b.line) {
				return -1;
			}

			if (a.line > b.line) {
				return 1;
			}

			return 0;
		});

	return {
		file: result.filePath,
		line: message?.line,
		column: message?.column,
	};
};

const getFiles = (report: XoLintResult, predicate: (result: ESLint.LintResult) => boolean) => report.results
	.filter(result => predicate(result))
	.sort(sortResults)
	.map(result => resultToFile(result));

const openReport = async (report: XoLintResult) => {
	const count = report.errorCount > 0 ? 'errorCount' : 'warningCount';
	const files = getFiles(report, result => result[count] > 0);
	await openEditor(files);
};

export default openReport;
