import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {getTsconfig, createFilesMatcher} from 'get-tsconfig';

let hasWarnedAboutTypeScriptVersion = false;

/**
Warns once if the project's own TypeScript is an older major than the version XO bundles. Mixing TypeScript versions in one process can crash type-aware linting (notably under pnpm), because the TypeFlags enum was renumbered in TypeScript 6.
*/
const warnOnOutdatedProjectTypeScript = (cwd: string): void => {
	if (hasWarnedAboutTypeScriptVersion) {
		return;
	}

	let projectVersion: string;
	try {
		const require = createRequire(path.join(cwd, 'noop.js'));
		({version: projectVersion} = require('typescript/package.json') as {version: string});
	} catch {
		// No project-level TypeScript resolvable; XO's bundled version is used, so there is no mismatch.
		return;
	}

	const projectMajor = Number(projectVersion.split('.', 1)[0]);
	const bundledMajor = Number(ts.version.split('.', 1)[0]);

	if (projectMajor >= bundledMajor) {
		return;
	}

	hasWarnedAboutTypeScriptVersion = true;
	console.warn(`XO bundles TypeScript ${ts.version}, but your project has TypeScript ${projectVersion}. Mixing TypeScript versions in one process can crash type-aware linting (notably with pnpm). Upgrade your project's \`typescript\` to ${bundledMajor} or later, or pin it (for example, a pnpm \`overrides\` entry).`);
};

/**
This function checks if the files are matched by the tsconfig include/exclude, and returns the unmatched files.

All unincluded files are routed through a generated tsconfig (`parserOptions.project`) so that autofix works correctly across multiple ESLint passes. The in-memory Program approach is intentionally not used here because `@typescript-eslint/typescript-estree` always returns the AST built from the original file text when using `parserOptions.programs`, ignoring the updated `code` ESLint passes on subsequent fix passes, which causes file corruption.

@param options - The options for handling the tsconfig.
@param options.files - The TypeScript files to check against the tsconfig.
@param options.cwd - The current working directory.
@returns The unincluded files.
*/
export function handleTsconfig({files, cwd}: {files: string[]; cwd: string}): string[] {
	warnOnOutdatedProjectTypeScript(cwd);

	const unincludedFiles: string[] = [];
	const filesMatcherCache = new Map<string, ReturnType<typeof createFilesMatcher>>();

	for (const filePath of files) {
		const result = getTsconfig(filePath);

		if (!result) {
			unincludedFiles.push(filePath);
			continue;
		}

		const cacheKey = result.path === '' ? filePath : path.resolve(result.path);
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

	return unincludedFiles;
}
