import path from 'node:path';
import micromatch from 'micromatch';
import {type Linter} from 'eslint';
import arrify from 'arrify';
import {typescriptParser} from 'eslint-config-xo';
import {type XoConfigItem, type TypeScriptParserOptions} from './types.js';
import {
	allFilesGlob,
	jsExtensions,
	jsFilesGlob,
} from './constants.js';

export {typescriptParser}; // eslint-disable-line unicorn/prefer-export-from -- Also used locally

/**
Convert a `xo` config item to an ESLint config item.

In a flat structure these config items represent the config object items.

Files and rules will always be defined and all other ESLint config properties are preserved.

@param xoConfig - The XO config item to convert.
@returns The equivalent ESLint config item.
*/
export const xoToEslintConfigItem = (xoConfig: XoConfigItem): Linter.Config => {
	const {
		files,
		rules,
		space,
		prettier,
		ignores,
		semicolon: hasSemicolon,
		..._xoConfig
	} = xoConfig;

	const eslintConfig: Linter.Config = {
		..._xoConfig,
		...(xoConfig.files === undefined ? {} : {files: arrify(xoConfig.files)}),
		...(xoConfig.rules ? {rules: xoConfig.rules} : {}),
	};

	eslintConfig.ignores &&= arrify(xoConfig.ignores);

	return eslintConfig;
};

/**
Function used to match files which should be included in the `tsconfig.json` files.

@param cwd - The current working directory to resolve relative filepaths.
@param files - The _absolute_ file paths to match against the globs.
@param globs - The globs to match the files against.
@param ignores - The globs to ignore when matching the files.
@returns An array of file paths that match the globs and do not match the ignores.
*/
export const matchFilesForTsConfig = (cwd: string, files: string[] | undefined, globs: string[], ignores: string[]) => micromatch(
	files?.map(file => path.normalize(path.relative(cwd, file))) ?? [],
	// https://github.com/micromatch/micromatch/issues/217
	globs.map(glob => path.normalize(glob)),
	{
		dot: true,
		ignore: ignores.map(file => path.normalize(file)),
		cwd,
	},
).map(file => path.resolve(cwd, file));

const legacyPropertyHints: Record<string, string> = {
	overrides: 'Use an array of config objects with `files` patterns instead.',
	extends: 'Spread the config directly into your XO config array.',
	env: 'Use `languageOptions.globals` instead.',
	globals: 'Move to `languageOptions.globals`.',
	parser: 'Move to `languageOptions.parser`.',
	parserOptions: 'Move to `languageOptions.parserOptions`.',
	root: 'Not needed in flat config.',
	ecmaVersion: 'Move to `languageOptions.ecmaVersion`.',
	sourceType: 'Move to `languageOptions.sourceType`.',
	noInlineConfig: 'Move to `linterOptions.noInlineConfig`.',
	reportUnusedDisableDirectives: 'Move to `linterOptions.reportUnusedDisableDirectives`.',
	ignorePatterns: 'Use `ignores` instead.',
	react: 'Install `eslint-config-xo-react` and spread it into your XO config instead.',
};

/**
Validate an XO config array for legacy ESLint config properties that are not supported in flat config.

@param xoConfig - The flat XO config to validate.
*/
export const validateXoConfig = (xoConfig: XoConfigItem[]): void => {
	// Skip the first item (internal base config prepended by XO)
	for (const config of xoConfig.values().drop(1)) {
		for (const key of Object.keys(config)) {
			const hint = legacyPropertyHints[key];
			if (hint !== undefined) {
				throw new Error(`Invalid XO config property \`${key}\`. ${hint}`);
			}
		}
	}
};

/**
Once a config is resolved, it is pre-processed to ensure that all properties are set correctly.

This includes ensuring that user-defined properties can override XO defaults, and that files are parsed correctly and performantly based on the users XO config.

@param xoConfig - The flat XO config to pre-process.
@returns The pre-processed flat XO config.
*/
// eslint-disable-next-line complexity
export const preProcessXoConfig = (xoConfig: XoConfigItem[]): {config: XoConfigItem[]; tsFilesGlob: string[]; tsFilesIgnoresGlob: string[]} => {
	validateXoConfig(xoConfig);

	const tsFilesGlob: string[] = [];
	const tsFilesIgnoresGlob: string[] = [];

	// The first config item is the internal base config; push it through unmodified.
	const processedConfig: XoConfigItem[] = xoConfig[0] ? [{...xoConfig[0]}] : [];

	for (const {...config} of xoConfig.values().drop(1)) {
		const {languageOptions} = config;
		const parserOptions = languageOptions?.['parserOptions'] as TypeScriptParserOptions | undefined;

		// Use TS parser/plugin for JS files if the config contains TypeScript rules which are applied to JS files.
		// typescript-eslint rules set to "off" are ignored and not applied to JS files.
		if (
			config.rules

			&& languageOptions?.['parser'] === undefined
			&& parserOptions?.project === undefined
			&& parserOptions?.programs === undefined
			&& !config.plugins?.['@typescript-eslint']
		) {
			const hasTsRules = Object.entries(config.rules).some(rulePair => {
				// If its not a @typescript-eslint rule, we don't care
				if (!rulePair[0].startsWith('@typescript-eslint/')) {
					return false;
				}

				if (Array.isArray(rulePair[1])) {
					return rulePair[1]?.[0] !== 'off' && rulePair[1]?.[0] !== 0;
				}

				return rulePair[1] !== 'off'
					&& rulePair[1] !== 0;
			});

			if (hasTsRules) {
				let isAppliedToJsFiles = false;

				if (config.files !== undefined) {
					const normalizedFiles = arrify(config.files).flat().map(file => path.normalize(file));
					// Strip the basename off any globs
					const globs = normalizedFiles.map(file => micromatch.scan(file, {dot: true}).glob).filter(Boolean);
					// Check if the files globs match a test file with a js extension
					// If not, check that the file paths match a js extension
					isAppliedToJsFiles = micromatch.some(jsExtensions.map(ext => `test.${ext}`), globs, {dot: true})
						|| micromatch.some(normalizedFiles, jsFilesGlob, {dot: true});
				} else if (config.files === undefined) {
					isAppliedToJsFiles = true;
				}

				if (isAppliedToJsFiles) {
					const updatedLanguageOptions: Linter.LanguageOptions = languageOptions
						? {...languageOptions, parser: typescriptParser}
						: {parser: typescriptParser};
					config.languageOptions = updatedLanguageOptions;
					tsFilesGlob.push(...arrify(config.files ?? allFilesGlob).flat());
					tsFilesIgnoresGlob.push(...arrify(config.ignores));
				}
			}
		}

		// If the config sets `parserOptions.project`, `projectService`, `tsconfigRootDir`, or `programs`, treat those files as opt-out for XO's automatic program wiring.
		if (parserOptions?.project !== undefined
			|| parserOptions?.projectService !== undefined
			|| parserOptions?.tsconfigRootDir !== undefined
			|| parserOptions?.programs !== undefined) {
			// The glob itself should NOT be negated
			tsFilesIgnoresGlob.push(...arrify(config.files ?? allFilesGlob).flat());
		}

		processedConfig.push(config);
	}

	return {
		config: processedConfig,
		tsFilesGlob,
		tsFilesIgnoresGlob,
	};
};
