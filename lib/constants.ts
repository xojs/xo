import {type TsConfigJsonResolved} from 'get-tsconfig';

export const defaultIgnores = [
	'**/node_modules/**',
	'**/bower_components/**',
	'flow-typed/**',
	'coverage/**',
	'{tmp,temp}/**',
	'**/*.min.js',
	'vendor/**',
	'dist/**',
	'tap-snapshots/*.{cjs,js}',
];

/**
List of options that values will be concatenanted during option merge.

Only applies to options defined as an Array.
*/

export const tsExtensions = ['ts', 'tsx', 'cts', 'mts'];

export const jsExtensions = ['js', 'jsx', 'mjs', 'cjs'];

export const frameworkExtensions = ['vue', 'svelte', 'astro'];

export const jsFilesGlob = `**/*.{${jsExtensions.join(',')}}`;

export const tsFilesGlob = `**/*.{${tsExtensions.join(',')}}`;

export const allExtensions = [...jsExtensions, ...tsExtensions, ...frameworkExtensions];

export const allFilesGlob = `**/*.{${allExtensions.join(',')}}`;

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
