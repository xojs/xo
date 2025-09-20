import _test from 'ava'; // eslint-disable-line ava/use-test
import {isFileSystemCaseInsensitive} from '../lib/utils.js';

const test = _test;

test('filesystem case sensitivity detection returns boolean', t => {
	const result = isFileSystemCaseInsensitive();
	t.is(typeof result, 'boolean');
});

test('filesystem detection is consistent', t => {
	const result1 = isFileSystemCaseInsensitive();
	const result2 = isFileSystemCaseInsensitive();
	t.is(result1, result2);
});
