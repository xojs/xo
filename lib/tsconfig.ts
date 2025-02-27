
import path from 'node:path';
import fs from 'node:fs/promises';
import {getTsconfig} from 'get-tsconfig';
import micromatch from 'micromatch';
import {tsconfigDefaults, cacheDirName} from './constants.js';
/**
 * This function checks if the files are matched by the tsconfig include, exclude, and it returns the unmatched files.
 * If no tsconfig is found, it will create a fallback tsconfig file in the node_modules/.cache/xo directory.
 *
 * @param options
 * @returns The unmatched files.
 */
export async function tsconfig({cwd, files}: {cwd: string; files: string[]}) {
	const {config: tsConfig = tsconfigDefaults, path: tsConfigPath} = getTsconfig(cwd) ?? {};

	tsConfig.compilerOptions ??= {};
	tsConfig.compilerOptions.rootDir = cwd;

	const unmatchedFiles: string[] = [];

	for (const filePath of files) {
		let hasMatch = false;

		if (!tsConfigPath) {
			unmatchedFiles.push(filePath);
			continue;
		}

		// If there is no files or include property - ts uses **/* as default so all TS files are matched
		// in tsconfig, excludes override includes - so we need to prioritize that matching logic
		if (
			tsConfig
			&& !tsConfig.include
			&& !tsConfig.files
		) {
			// If we have an excludes property, we need to check it
			// If we match on excluded, then we definitively know that there is no tsconfig match
			if (Array.isArray(tsConfig.exclude)) {
				const exclude = Array.isArray(tsConfig.exclude) ? tsConfig.exclude : [];
				hasMatch = !micromatch.contains(filePath, exclude);
			} else {
				// Not explicitly excluded and included by tsconfig defaults
				hasMatch = true;
			}
		} else {
			// We have either and include or a files property in tsconfig
			const include = Array.isArray(tsConfig.include) ? tsConfig.include : [];
			const files = Array.isArray(tsConfig.files) ? tsConfig.files : [];
			const exclude = Array.isArray(tsConfig.exclude) ? tsConfig.exclude : [];
			// If we also have an exlcude we need to check all the arrays, (files, include, exclude)
			// this check not excluded and included in one of the file/include array
			hasMatch = !micromatch.contains(filePath, exclude) && micromatch.contains(filePath, [...include, ...files]);
		}

		if (!hasMatch) {
			unmatchedFiles.push(filePath);
		}
	}

	const fallbackTsConfigPath = path.join(cwd, 'node_modules', '.cache', cacheDirName, 'tsconfig.xo.json');

	delete tsConfig.include;
	delete tsConfig.exclude;
	delete tsConfig.files;
	tsConfig.files = files;

	try {
		await fs.mkdir(path.dirname(fallbackTsConfigPath), {recursive: true});
		await fs.writeFile(fallbackTsConfigPath, JSON.stringify(tsConfig, null, 2));
	} catch (error) {
		console.error(error);
	}

	return {unmatchedFiles: unmatchedFiles.map(fp => path.relative(cwd, fp)), fallbackTsConfigPath};
}
