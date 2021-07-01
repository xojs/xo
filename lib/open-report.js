'use strict';
import openEditor from 'open-editor';

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

const getFiles = (report, predicate) => report.results
	.filter(result => predicate(result))
	.sort(sortResults)
	.map(result => resultToFile(result));

export default report => {
	const count = report.errorCount > 0 ? 'errorCount' : 'warningCount';
	const files = getFiles(report, result => result[count] > 0);
	openEditor(files);
};
