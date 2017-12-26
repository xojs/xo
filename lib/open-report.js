'use strict';
const openEditor = require('open-editor');

const sortResults = (a, b) => a.errorCount + b.errorCount > 0 ? (a.errorCount - b.errorCount) : (a.warningCount - b.warningCount);

const resultToFile = result => {
	const message = result.messages
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
		})[0];

	return {
		file: result.filePath,
		line: message.line,
		column: message.column
	};
};

const files = (report, predicate) => report.results
	.filter(v => predicate(v))
	.sort(sortResults)
	.map(v => resultToFile(v));

module.exports = report => {
	if (report.errorCount > 0) {
		openEditor(files(report, result => result.errorCount > 0));
	} else if (report.warningCount > 0) {
		openEditor(files(report, result => result.warningCount > 0));
	}
};
