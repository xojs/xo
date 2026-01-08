import path from 'node:path';
import micromatch from 'micromatch';
import {type Linter} from 'eslint';
import arrify from 'arrify';
import configXoTypescript from 'eslint-config-xo-typescript';
import {type XoConfigItem} from './types.js';
import {
	allFilesGlob,
	jsExtensions,
	jsFilesGlob,
} from './constants.js';

type LanguageOptionsWithParser = Linter.LanguageOptions & {parser?: Linter.Parser};

type TypeScriptParserOptions = Linter.ParserOptions & {
	project?: string | string[];
	projectService?: boolean;
	tsconfigRootDir?: string;
	programs?: unknown[];
};

const typescriptParserConfig = configXoTypescript.find(config => {
	const languageOptions = config.languageOptions as LanguageOptionsWithParser | undefined;
	return languageOptions?.parser;
});

export const typescriptParser = (typescriptParserConfig?.languageOptions as LanguageOptionsWithParser | undefined)?.parser;

if (!typescriptParser) {
	throw new Error('XO: Failed to locate TypeScript parser in eslint-config-xo-typescript');
}

/**
Convert a `xo` config item to an ESLint config item.

In a flat structure these config items represent the config object items.

Files and rules will always be defined and all other ESLint config properties are preserved.

@param xoConfig
@returns eslintConfig
*/
export const xoToEslintConfigItem = (xoConfig: XoConfigItem): Linter.Config => {
	const {
		files,
		rules,
		space,
		prettier,
		ignores,
		semicolon,
		react,
		..._xoConfig
	} = xoConfig;

	const eslintConfig: Linter.Config = {
		..._xoConfig,
		...(xoConfig.files ? {files: arrify(xoConfig.files)} : {}),
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

/**
Once a config is resolved, it is pre-processed to ensure that all properties are set correctly.

This includes ensuring that user-defined properties can override XO defaults, and that files are parsed correctly and performantly based on the users XO config.

@param xoConfig - The flat XO config to pre-process.
@returns The pre-processed flat XO config.
*/
export const preProcessXoConfig = (xoConfig: XoConfigItem[]):
{config: XoConfigItem[]; tsFilesGlob: string[]; tsFilesIgnoresGlob: string[]} => {
	const tsFilesGlob: string[] = [];
	const tsFilesIgnoresGlob: string[] = [];

	const processedConfig: XoConfigItem[] = [];

	for (const [idx, {...config}] of xoConfig.entries()) {
		const languageOptions = config.languageOptions as Linter.LanguageOptions | undefined;
		const parserOptions = languageOptions?.parserOptions as TypeScriptParserOptions | undefined;

		// We can skip the first config  item, as it is the base config item.
		if (idx === 0) {
			processedConfig.push(config);
			continue;
		}

		// Use TS parser/plugin for JS files if the config contains TypeScript rules which are applied to JS files.
		// typescript-eslint rules set to "off" are ignored and not applied to JS files.
		if (
			config.rules
			// eslint-disable-next-line @typescript-eslint/dot-notation
			&& !languageOptions?.['parser']
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

				if (config.files) {
					const normalizedFiles = arrify(config.files).map(file => path.normalize(file));
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
					config.plugins ??= {};
					config.plugins = {
						...config.plugins,
						...configXoTypescript[1]?.plugins,
					};
					tsFilesGlob.push(...arrify(config.files ?? allFilesGlob));
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
			tsFilesIgnoresGlob.push(...arrify(config.files ?? allFilesGlob));
		}

		processedConfig.push(config);
	}

	return {
		config: processedConfig,
		tsFilesGlob,
		tsFilesIgnoresGlob,
	};
};
