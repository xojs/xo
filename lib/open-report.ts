'use strict';
 openEditor = require('open-editor');

 sortResults = (a, b) => a.errorCount + b.errorCount > 0 ? (a.errorCount - b.errorCount) : (a.warningCount - b.warningCount);

 resultToFile = result => {
	 [message] = result.messages
		.sort((a, b) => {
			(a.severity < b.severity) {
				 1;
			}

			(a.severity > b.severity) {
				 -1;
			}

		         (a.line < b.line) {
				 -1;
			}

			 (a.line > b.line) {
				 1;
			}

			 0;
		});

	 {
		file: result.filePath,
		line: message.line,
		column: message.column
	};
};

 getFiles = (report, predicate) => report.results
	.filter(result => predicate(result))
	.sort(sortResults)
	.map(result => resultToFile(result));

module.exports = report => {
	 count = report.errorCount > 0 ? 'errorCount' : 'warningCount';
	 files = getFiles(report, result => result[count] > 0);
	openEditor(files);
};
