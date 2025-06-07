import path from 'node:path';
import fs from 'node:fs/promises';
import {getTsconfig, createFilesMatcher} from 'get-tsconfig';
import {tsconfigDefaults as tsConfig, cacheDirName} from './constants.js';

/**
This function checks if the files are matched by the tsconfig include, exclude, and it returns the unmatched files.

If no tsconfig is found, it will create a fallback tsconfig file in the `node_modules/.cache/xo` directory.

@param options
@returns The unmatched files.
*/
export async function handleTsconfig({cwd, files}: {cwd: string; files: string[]}) {
	const unincludedFiles: string[] = [];

	for (const filePath of files) {
		const result = getTsconfig(filePath);

		if (!result) {
			unincludedFiles.push(filePath);
			continue;
		}

		const filesMatcher = createFilesMatcher(result);

		if (filesMatcher(filePath)) {
			continue;
		}

		unincludedFiles.push(filePath);
	}

	const fallbackTsConfigPath = path.join(cwd, 'node_modules', '.cache', cacheDirName, 'tsconfig.xo.json');

	delete tsConfig.include;
	delete tsConfig.exclude;
	delete tsConfig.files;

	tsConfig.files = unincludedFiles;

	if (unincludedFiles.length > 0) {
		try {
			await fs.mkdir(path.dirname(fallbackTsConfigPath), {recursive: true});
			await fs.writeFile(fallbackTsConfigPath, JSON.stringify(tsConfig, null, 2));
		} catch (error) {
			console.error(error);
		}
	}

	return {unincludedFiles, fallbackTsConfigPath};
}
