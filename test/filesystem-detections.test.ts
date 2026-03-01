import test from 'ava';
import {isFileSystemCaseInsensitive} from '../lib/utils.js';

test('filesystem case sensitivity detection returns a boolean', t => {
	t.is(typeof isFileSystemCaseInsensitive(), 'boolean');
});

test('filesystem case sensitivity detection is stable', t => {
	t.is(isFileSystemCaseInsensitive(), isFileSystemCaseInsensitive());
});
