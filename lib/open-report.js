'use strict';
const openEditor = require('open-editor');

const sortResults = (a, b) => a.errorCount + b.errorCount > 0 ? (a.errorCount - b.errorCount) : (a.warningCount - b.warningCount);

const resultToFile = result => {
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
		line: message.line,
		column: message.column
	};
};

const files = (report, predicate) => report.results
	.filter(result => predicate(result))
	.sort(sortResults)
	.map(result => resultToFile(result));

module.exports = report => {
	const count = report.errorCount > 0 ? 'errorCount' : 'warningCount';
	openEditor(files(report, result => result[count] > 0));
};
