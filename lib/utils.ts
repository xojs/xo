import path from 'node:path';
import micromatch from 'micromatch';
import {type Linter} from 'eslint';
import {type SetRequired} from 'type-fest';
import arrify from 'arrify';
import configXoTypescript from 'eslint-config-xo-typescript';
import {type XoConfigItem} from './types.js';
import {
	allFilesGlob,
	jsExtensions,
	jsFilesGlob,
} from './constants.js';

/**
Convert a `xo` config item to an ESLint config item.

In a flat structure these config items represent the config object items.

Files and rules will always be defined and all other ESLint config properties are preserved.

@param xoConfig
@returns eslintConfig
*/
export const xoToEslintConfigItem = (xoConfig: XoConfigItem): SetRequired<Linter.Config, 'rules' | 'files'> => {
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

	const eslintConfig: SetRequired<Linter.Config, 'rules' | 'files'> = {
		..._xoConfig,
		files: arrify(xoConfig.files ?? allFilesGlob),
		rules: xoConfig.rules ?? {},
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
export const matchFilesForTsConfig = (cwd: string, files: string[], globs: string[], ignores: string[]) => micromatch(
	files.map(file => path.normalize(path.relative(cwd, file))),
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
This includes ensuring that user-defined properties can override xo defaults, and that files are parsed correctly
and performantly based on the users xo config.
@param xoConfig - The flat xo config to pre-process.
@returns The pre-processed flat xo config.
*/
export const preProcessXoConfig = (xoConfig: XoConfigItem[]): // eslint-disable-line complexity
{config: XoConfigItem[]; tsFilesGlob: string[]; tsFilesIgnoresGlob: string[]} => {
	const tsFilesGlob: string[] = [];
	const tsFilesIgnoresGlob: string[] = [];
	for (const [idx, config] of xoConfig.entries()) {
		// We can skip the first config  item, as it is the base config item.
		if (idx === 0) {
			continue;
		}

		// Use ts parser/plugin for js files if the config contains TypeScript rules which are applied to JS files.
		// typescript-eslint rules set to "off" are ignored and not applied to JS files.
		if (
			config.rules
			&& !config.languageOptions?.parser
			&& !config.languageOptions?.parserOptions?.['project']
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
					config.languageOptions ??= {};
					config.plugins ??= {};
					config.plugins = {
						...config.plugins,
						...configXoTypescript[1]?.plugins,
					};
					config.languageOptions.parser = configXoTypescript[1]?.languageOptions?.parser;
					tsFilesGlob.push(...arrify(config.files ?? allFilesGlob));
					tsFilesIgnoresGlob.push(...arrify(config.ignores));
				}
			}
		}

		// If a user sets the parserOptions.project or projectService or tsconfigRootDir, we need to ensure that the tsFilesGlob is set to exclude those files,
		// as this indicates the user has opted out of the default TypeScript handling for those files.
		if (
			config.languageOptions?.parserOptions?.['project'] !== undefined
			|| config.languageOptions?.parserOptions?.['projectService'] !== undefined
			|| config.languageOptions?.parserOptions?.['tsconfigRootDir'] !== undefined
		) {
			// The glob itself should NOT be negated
			tsFilesIgnoresGlob.push(...arrify(config.files ?? allFilesGlob));
		}
	}

	return {
		config: xoConfig,
		tsFilesGlob,
		tsFilesIgnoresGlob,
	};
};
