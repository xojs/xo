import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import tempDir from 'temp-dir';
import {pathExists} from 'path-exists';

/**
Copies the test project in the temp directory to a new directory.

@returns {string} The path to the copied test project.
*/
export const copyTestProject = async () => {
	if (!(await pathExists(tempDir))) {
		throw new Error('temp-dir/test-project does not exist');
	}

	const testCwd = path.join(tempDir, 'test-project');
	const newCwd = path.join(tempDir, randomUUID());

	await fs.cp(testCwd, newCwd, {recursive: true});

	return newCwd;
};

