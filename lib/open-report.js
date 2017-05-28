'use strict';
const openEditor = require('open-editor');

const sortResults = (a, b) => a.errorCount + b.errorCount > 0 ? (a.errorCount - b.errorCount) : (a.warningCount - b.warningCount);

const resultToFile = result => ({
	file: result.filePath,
	line: result.messages[0].line,
	column: result.messages[0].column
});

const files = (report, predicate) => report.results
  .filter(predicate)
  .sort(sortResults)
  .map(resultToFile);

const filesToOpen = report => {
	if (report.errorCount > 0) {
		return files(report, result => result.errorCount > 0);
	} else if (report.warningCount > 0) {
		return files(report, result => result.warningCount > 0);
	}

	return [];
};

module.exports = report => openEditor(filesToOpen(report));
module.exports.openEditor = openEditor;
