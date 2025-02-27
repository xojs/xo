import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import tempDir from 'temp-dir';
// Import {$} from 'execa';
import {pathExists} from 'path-exists';
import {type XoConfigItem} from '../../lib/types.js';

/**
 * Copies the test project in the temp dir to a new directory.
 * @returns {string} The path to the copied test project.
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

/**
 * Adds a flag to the xo.config.js file in the test project in the temp dir.
 * Cleans up any previous xo.config.js file.
 *
 * @param cwd - the test project directory
 * @param config - contents of a xo.config.js file as a string
 */
export const addFlatConfigToProject = async (
	cwd: string,
	config: XoConfigItem[],
) => {
	const filePath = path.join(cwd, 'xo.config.js');

	if (await pathExists(filePath)) {
		await fs.rm(filePath, {force: true});
	}

	await fs.writeFile(filePath, `export default ${JSON.stringify(config)};`);
};
