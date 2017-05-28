import test from 'ava';
import proxyquire from 'proxyquire';

const openReport = proxyquire('../lib/open-report', {
	'open-editor': files => files
});

const createReport = ({results = [], errorCount = 0, warningCount = 0} = {}) => ({
	results, errorCount, warningCount
});

const createResult = ({errorCount = 0, warningCount = 0, filePath = '', messages = []} = {}) => ({
	errorCount, warningCount, filePath, messages
});

const createMessage = ({line = 1, column = 10} = {}) => ({
	line, column
});

test('opens nothing when there are no errors nor warnings', t => {
	const expected = openReport(createReport());
	const actual = [];

	t.deepEqual(actual, expected);
});

test('only opens errors if there are errors and warnings', t => {
	const report = createReport({
		errorCount: 1,
		warningCount: 2,
		results: [
			createResult({errorCount: 7, filePath: 'seven-errors.js', messages: [createMessage({line: 7, column: 17})]}),
			createResult({warningCount: 3, filePath: 'three-warnings.js', messages: [createMessage({line: 3, column: 13})]}),
			createResult({errorCount: 1, filePath: 'one-error.js', messages: [createMessage()]}),
			createResult({warningCount: 1, filePath: 'one-warning.js', messages: [createMessage()]})
		]
	});

	const expected = openReport(report);
	const actual = [{
		file: 'one-error.js',
		line: 1,
		column: 10
	},
	{
		file: 'seven-errors.js',
		line: 7,
		column: 17
	}
	];

	t.deepEqual(actual, expected);
});

test('only opens warnings if there are no errors', t => {
	const report = createReport({
		warningCount: 2,
		results: [
			createResult({warningCount: 3, filePath: 'three-warnings.js', messages: [createMessage({line: 3, column: 13})]}),
			createResult({warningCount: 1, filePath: 'one-warning.js', messages: [createMessage()]})
		]
	});

	const expected = openReport(report);
	const actual = [{
		file: 'one-warning.js',
		line: 1,
		column: 10
	},
	{
		file: 'three-warnings.js',
		line: 3,
		column: 13
	}];

	t.deepEqual(actual, expected);
});
