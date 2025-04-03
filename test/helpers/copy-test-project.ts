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

	// Create a tsconfig.json file
	await fs.writeFile(
		path.join(newCwd, 'tsconfig.json'),
		JSON.stringify({
			compilerOptions: {
				module: 'node16',
				target: 'ES2022',
				strictNullChecks: true,
				lib: ['DOM', 'DOM.Iterable', 'ES2022'],
			},
			files: [path.join(newCwd, 'test.ts')],
			exclude: ['node_modules'],
		}),
	);

	return newCwd;
};

