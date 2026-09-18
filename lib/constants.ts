import {type TsConfigJsonResolved} from 'get-tsconfig';
import {
	jsExtensions,
	tsExtensions,
	frameworkExtensions,
	allExtensions,
	jsonExtensions,
	cssExtensions,
} from 'eslint-config-xo';

export {
	tsExtensions,
	jsExtensions,
	frameworkExtensions,
	allExtensions,
	jsFilesGlob,
	tsFilesGlob,
	allFilesGlob,
	defaultIgnores,
} from 'eslint-config-xo';

/**
Glob for every file XO lints when no files are given.
*/
export const defaultFilesGlob = `**/*.{${[...allExtensions, ...jsonExtensions, ...cssExtensions].join(',')}}`;

/**
Glob for the JavaScript, TypeScript, and framework files that config items without `files` apply to.

Other file types have their own ESLint language, so JavaScript-specific settings, such as the TypeScript parser and type-aware rules, must not reach them.
*/
export const codeFilesGlob = `**/*.{${[...jsExtensions, ...tsExtensions, ...frameworkExtensions].join(',')}}`;

/**
List of options that values will be concatenated during option merge.

Only applies to options defined as an Array.
*/

export const moduleName = 'xo';

export const tsconfigDefaults: TsConfigJsonResolved = {
	compilerOptions: {
		target: 'es2022',
		strict: true,
		noImplicitReturns: true,
		noImplicitOverride: true,
		noUnusedLocals: true,
		noUnusedParameters: true,
		noFallthroughCasesInSwitch: true,
		noUncheckedIndexedAccess: true,
		noPropertyAccessFromIndexSignature: true,
		noUncheckedSideEffectImports: true,
	},
};

export const cacheDirName = 'xo-linter';
