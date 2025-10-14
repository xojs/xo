import path from 'node:path';
import fs from 'node:fs';
import ts from 'typescript';
import {getTsconfig, createFilesMatcher} from 'get-tsconfig';
import {tsconfigDefaults} from './constants.js';

const createInMemoryProgram = (files: string[], cwd: string): ts.Program | undefined => {
	if (files.length === 0) {
		return undefined;
	}

	try {
		const compilerOptions = getFallbackCompilerOptions(cwd);
		const program = ts.createProgram(files, {...compilerOptions});
		Object.defineProperty(program, 'toJSON', {
			value: () => ({
				__type: 'TypeScriptProgram',
				files: files.map(file => path.relative(cwd, file)),
			}),
			configurable: true,
		});

		return program;
	} catch (error) {
		console.warn(
			'XO: Failed to create TypeScript Program for type-aware linting. Continuing without type information for unincluded files.',
			error instanceof Error ? error.message : String(error),
		);
		return undefined;
	}
};

const fallbackCompilerOptionsCache = new Map<string, ts.CompilerOptions>();

const getFallbackCompilerOptions = (cwd: string): ts.CompilerOptions => {
	const cacheKey = path.resolve(cwd);
	const cached = fallbackCompilerOptionsCache.get(cacheKey);

	if (cached) {
		return cached;
	}

	const compilerOptionsResult = ts.convertCompilerOptionsFromJson(
		tsconfigDefaults.compilerOptions ?? {},
		cacheKey,
	);

	if (compilerOptionsResult.errors.length > 0) {
		throw new Error('XO: Invalid default TypeScript compiler options');
	}

	const compilerOptions: ts.CompilerOptions = {
		...compilerOptionsResult.options,
		esModuleInterop: true,
		resolveJsonModules: true,
		allowJs: true,
		skipLibCheck: true,
		skipDefaultLibCheck: true,
	};

	fallbackCompilerOptionsCache.set(cacheKey, compilerOptions);
	return compilerOptions;
};

/**
This function checks if the files are matched by the tsconfig include, exclude, and it returns the unmatched files.

If no tsconfig is found, it will create an in-memory TypeScript Program for type-aware linting.

@param options
@returns The unmatched files and an in-memory TypeScript Program.
*/
export function handleTsconfig({files, cwd, cacheLocation}: {files: string[]; cwd: string; cacheLocation?: string}) {
	const unincludedFiles: string[] = [];
	const filesMatcherCache = new Map<string, ReturnType<typeof createFilesMatcher>>();

	for (const filePath of files) {
		const result = getTsconfig(filePath);

		if (!result) {
			unincludedFiles.push(filePath);
			continue;
		}

		const cacheKey = result.path ? path.resolve(result.path) : filePath;
		let filesMatcher = filesMatcherCache.get(cacheKey);

		if (!filesMatcher) {
			filesMatcher = createFilesMatcher(result);
			filesMatcherCache.set(cacheKey, filesMatcher);
		}

		if (filesMatcher(filePath)) {
			continue;
		}

		unincludedFiles.push(filePath);
	}

	if (unincludedFiles.length === 0) {
		return {existingFiles: [], virtualFiles: [], program: undefined};
	}

	// Separate real files from virtual/cache files
	// Virtual files include: stdin files (in cache dir), non-existent files
	// TypeScript will surface opaque diagnostics for missing files; pre-filter so we only pay the program cost for real files.
	const existingFiles: string[] = [];
	const virtualFiles: string[] = [];

	for (const file of unincludedFiles) {
		const fileExists = fs.existsSync(file);

		// Files that don't exist are always virtual
		if (!fileExists) {
			virtualFiles.push(file);
			continue;
		}

		// Check if file is in cache directory (like stdin files)
		// These need tsconfig treatment even though they exist on disk
		if (cacheLocation) {
			const absolutePath = path.resolve(file);
			const cacheRoot = path.resolve(cacheLocation);
			const relativeToCache = path.relative(cacheRoot, absolutePath);

			// File is inside cache if relative path doesn't escape (no '..')
			const isInCache = !relativeToCache.startsWith('..') && !path.isAbsolute(relativeToCache);

			if (isInCache) {
				virtualFiles.push(file);
				continue;
			}
		}

		existingFiles.push(file);
	}

	return {
		existingFiles,
		virtualFiles,
		program: createInMemoryProgram(existingFiles, cwd),
	};
}
