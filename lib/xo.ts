import path from 'node:path';
import os from 'node:os';
import syncFs from 'node:fs';
import fs from 'node:fs/promises';
import process from 'node:process';
import {ESLint, type Linter} from 'eslint';
import findCacheDirectory from 'find-cache-directory';
import {globby, isDynamicPattern} from 'globby';
import arrify from 'arrify';
import defineLazyProperty from 'define-lazy-prop';
import prettier from 'prettier';
import type ts from 'typescript';
import {
	type XoLintResult,
	type LinterOptions,
	type LintTextOptions,
	type XoConfigOptions,
	type XoConfigItem,
} from './types.js';
import {
	defaultIgnores,
	cacheDirName,
	allExtensions,
	tsFilesGlob,
	tsconfigDefaults,
} from './constants.js';
import {xoToEslintConfig} from './xo-to-eslint.js';
import resolveXoConfig from './resolve-config.js';
import {handleTsconfig} from './handle-ts-files.js';
import {
	matchFilesForTsConfig,
	preProcessXoConfig,
	typescriptParser,
} from './utils.js';

type TypeScriptParserOptions = Linter.ParserOptions & {
	project?: string | string[] | boolean;
	projectService?: boolean;
	tsconfigRootDir?: string;
	programs?: unknown[];
};

type XoError = Error & {
	exitCode: number;
};

export const ignoredFileWarningMessage = 'File ignored because of a matching ignore pattern.';
export const noFilesFoundErrorMessage = 'No files matching the pattern were found.';

const suppressionsFileMissingErrorMessage = 'The suppressions file does not exist. Please run the command with `--suppress-all` or `--suppress-rule` to create it.';

const createErrorWithExitCode = (message: string, exitCode: number): XoError => Object.assign(new Error(message), {exitCode});

const createIgnoredLintResult = (filePath: string): ESLint.LintResult => ({
	filePath,
	messages: [
		{
			ruleId: null,
			severity: 1,
			message: ignoredFileWarningMessage,
			line: 0,
			column: 0,
		},
	],
	suppressedMessages: [],
	errorCount: 0,
	fatalErrorCount: 0,
	warningCount: 1,
	fixableErrorCount: 0,
	fixableWarningCount: 0,
	usedDeprecatedRules: [],
});

const resolveExplicitFilePath = (cwd: string, glob: string): string | undefined => {
	if (isDynamicPattern(glob)) {
		// Negated and wildcard globs are treated as regular glob filtering, not as explicit file paths that should trigger an ignored-file warning.
		return undefined;
	}

	const absolutePath = path.resolve(cwd, glob);

	try {
		if (syncFs.statSync(absolutePath).isFile()) {
			return absolutePath;
		}
	} catch {
		// File does not exist or is inaccessible.
	}

	return undefined;
};

const getIgnoredExplicitFileResults = async (cwd: string, globs: string[], eslint: ESLint): Promise<ESLint.LintResult[]> => {
	const explicitFilePaths = [...new Set(globs
		.map(glob => resolveExplicitFilePath(cwd, glob))
		.filter(filePath => filePath !== undefined))];

	const results = await Promise.all(explicitFilePaths.map(async filePath =>
		await eslint.isPathIgnored(filePath) ? createIgnoredLintResult(filePath) : undefined));

	return results.filter(result => result !== undefined);
};

export class Xo {
	/**
	Static helper to convert an XO config to an ESLint config to be used in `eslint.config.js`.
	*/
	static xoToEslintConfig = xoToEslintConfig;

	/**
	Static helper for backwards compatibility and use in editor extensions and other tools.
	*/
	static async lintText(code: string, options: LintTextOptions & LinterOptions & XoConfigOptions) {
		const xo = new Xo(
			{
				cwd: options.cwd,
				fix: options.fix,
				filePath: options.filePath,
				quiet: options.quiet,
				ts: options.ts ?? true,
				configPath: options.configPath,
				suppressionsLocation: options.suppressionsLocation,
			},
			{
				react: options.react,
				space: options.space,
				semicolon: options.semicolon,
				prettier: options.prettier,
				ignores: options.ignores,
			},
		);

		return xo.lintText(code, {
			filePath: options.filePath,
			warnIgnored: options.warnIgnored,
		});
	}

	/**
	Static helper for backwards compatibility and use in editor extensions and other tools.
	*/
	static async lintFiles(globs: string | undefined, options: LinterOptions & XoConfigOptions) {
		const xo = new Xo(
			{
				cwd: options.cwd,
				fix: options.fix,
				filePath: options.filePath,
				quiet: options.quiet,
				ts: options.ts,
				configPath: options.configPath,
				suppressionsLocation: options.suppressionsLocation,
			},
			{
				react: options.react,
				space: options.space,
				semicolon: options.semicolon,
				prettier: options.prettier,
				ignores: options.ignores,
			},
		);

		return xo.lintFiles(globs);
	}

	/**
	Write the fixes to disk.
	*/
	static async outputFixes(results: XoLintResult) {
		await ESLint.outputFixes(results?.results ?? []);
	}

	/**
	Required linter options: `cwd`, `fix`, and `filePath` (in case of `lintText`).
	*/
	_linterOptions: LinterOptions;

	/**
	File path to the ESLint cache.
	*/
	_cacheLocation: string;

	/**
	XO config derived from both the base config and the resolved flat config.
	*/
	_xoConfig?: XoConfigItem[];

	/**
	Base XO config options that allow configuration from CLI or other sources. Not to be confused with the `xoConfig` property which is the resolved XO config from the flat config AND base config.
	*/
	readonly #baseXoConfig: XoConfigOptions;

	/**
	A re-usable ESLint instance configured with options calculated from the XO config.
	*/
	#eslint?: ESLint;

	/**
	The ESLint config calculated from the resolved XO config.
	*/
	#eslintConfig?: Linter.Config[];

	/**
	The Prettier config if it exists and is needed.
	*/
	#prettierConfig?: prettier.Options;

	/**
	The glob pattern for TypeScript files, for which we will handle TS files and tsconfig.

	We expand this based on the XO config and the files glob patterns.
	*/
	readonly #tsFilesGlob: string[] = [tsFilesGlob];

	/**
	We use this to also add negative glob patterns in case a user overrides the parserOptions in their XO config.
	*/
	readonly #tsFilesIgnoresGlob: string[] = [];

	/**
	Track whether ignores have been added to prevent duplicate ignore configs.
	*/
	#ignoresHandled = false;

	/**
	Store per-file configs separately from base config to prevent unbounded array growth.
	Key: file path, Value: config for that file.
	This prevents memory bloat in long-running processes (e.g., language servers).
	*/
	readonly #fileConfigs = new Map<string, XoConfigItem>();

	/**
	Track virtual/stdin files that share a single tsconfig.stdin.json.
	These are handled differently from regular files.
	*/
	readonly #virtualFiles = new Set<string>();

	constructor(_linterOptions: LinterOptions, _baseXoConfig: XoConfigOptions = {}) {
		this._linterOptions = _linterOptions;
		this.#baseXoConfig = _baseXoConfig;

		// Fix relative cwd paths
		if (!path.isAbsolute(this._linterOptions.cwd)) {
			this._linterOptions.cwd = path.resolve(process.cwd(), this._linterOptions.cwd);
		}

		try {
			this._linterOptions.cwd = syncFs.realpathSync.native(this._linterOptions.cwd);
		} catch {
			// Ignore invalid paths here; the caller will handle errors later.
		}

		const backupCacheLocation = path.join(os.tmpdir(), cacheDirName);

		this._cacheLocation = findCacheDirectory({name: cacheDirName, cwd: this._linterOptions.cwd}) ?? backupCacheLocation;
	}

	/**
	Sets the XO config on the XO instance.
	*/
	async setXoConfig() {
		if (this._xoConfig) {
			return;
		}

		const {flatOptions, flatConfigPath} = await resolveXoConfig({
			...this._linterOptions,
		});

		const {config: xoConfig, tsFilesGlob: tsGlob, tsFilesIgnoresGlob} = preProcessXoConfig([
			this.#baseXoConfig,
			...flatOptions,
		]);

		this._xoConfig = xoConfig;
		this.#tsFilesGlob.push(...tsGlob);
		this.#tsFilesIgnoresGlob.push(...tsFilesIgnoresGlob);
		this.#prettierConfig = await prettier.resolveConfig(flatConfigPath, {editorconfig: true}) ?? {};
	}

	/**
	Sets the ESLint config on the XO instance.
	*/
	setEslintConfig() {
		if (!this._xoConfig) {
			throw new Error('"Xo.setEslintConfig" failed');
		}

		// Combine base config with per-file configs from Map
		// Deduplicate configs since multiple files can share the same config object
		const uniqueFileConfigs = [...new Set(this.#fileConfigs.values())];
		const allConfigs = [...this._xoConfig, ...uniqueFileConfigs];

		// Always regenerate to support instance reuse with new files
		this.#eslintConfig = xoToEslintConfig(allConfigs, {prettierOptions: this.#prettierConfig});
	}

	/**
	Sets the ignores on the XO instance.
	*/
	setIgnores() {
		if (this.#ignoresHandled || !this.#baseXoConfig.ignores) {
			return;
		}

		let ignores: string[] = [];

		if (typeof this.#baseXoConfig.ignores === 'string') {
			ignores = arrify(this.#baseXoConfig.ignores);
		} else if (Array.isArray(this.#baseXoConfig.ignores)) {
			ignores = this.#baseXoConfig.ignores;
		}

		if (!this._xoConfig) {
			throw new Error('"Xo.setIgnores" failed');
		}

		if (ignores.length === 0) {
			return;
		}

		this._xoConfig.push({ignores});
		this.#ignoresHandled = true;
	}

	/**
	Ensures the cache directory exists. This needs to run once before both tsconfig handling and running ESLint occur.
	*/
	async ensureCacheDirectory() {
		try {
			const cacheStats = await fs.stat(this._cacheLocation);
			// If file, re-create as directory
			if (cacheStats.isFile()) {
				await fs.rm(this._cacheLocation, {recursive: true, force: true});
				await fs.mkdir(this._cacheLocation, {recursive: true});
			}
		} catch {
			// If not exists, create the directory
			await fs.mkdir(this._cacheLocation, {recursive: true});
		}
	}

	/**
	Checks every TS file to ensure its included in the tsconfig and any that are not included are added to an in-memory TypeScript Program for type aware linting.

	@param files - The TypeScript files being linted.
	*/
	async handleUnincludedTsFiles(files?: string[]): Promise<void> {
		if (!this._linterOptions.ts || !files || files.length === 0) {
			return;
		}

		// Get ALL TypeScript files being linted (both new and previously handled)
		const allTsFiles = matchFilesForTsConfig(this._linterOptions.cwd, files, this.#tsFilesGlob, this.#tsFilesIgnoresGlob);

		if (allTsFiles.length === 0) {
			this.#fileConfigs.clear();

			if (this.#virtualFiles.size > 0) {
				await this.addVirtualFilesToConfig([]);
			}

			return;
		}

		const {program, existingFiles, virtualFiles} = handleTsconfig({
			files: allTsFiles,
			cwd: this._linterOptions.cwd,
			cacheLocation: this._cacheLocation,
		});

		this.#fileConfigs.clear();

		if (existingFiles.length > 0) {
			this.addExistingFilesToConfig(existingFiles, program);
		}

		await this.addVirtualFilesToConfig(virtualFiles);
	}

	/**
	Initializes the ESLint instance on the XO instance.
	*/
	public async initEslint(files?: string[]) {
		await this.setXoConfig();

		this.setIgnores();

		await this.ensureCacheDirectory();

		await this.handleUnincludedTsFiles(files);

		this.setEslintConfig();

		if (!this._xoConfig) {
			throw new Error('"Xo.initEslint" failed');
		}

		const eslintOptions: ESLint.Options = {
			cwd: this._linterOptions.cwd,
			overrideConfig: this.#eslintConfig,
			overrideConfigFile: true,
			globInputPaths: false,
			warnIgnored: false,
			cache: true,
			cacheLocation: this._cacheLocation,
			cacheStrategy: 'content',
			fix: this._linterOptions.fix,
			applySuppressions: true,
			suppressionsLocation: this._linterOptions.suppressionsLocation,
		};

		// Always create new instance to support reuse with updated config
		// ESLint's file-based cache (cacheLocation) persists across instances
		this.#eslint = new ESLint(eslintOptions);
	}

	/**
	Lints the files on the XO instance.

	@param globs - Glob pattern to pass to `globby`.
	@throws Error
	*/
	async lintFiles(globs?: string | string[]): Promise<XoLintResult> {
		if (!globs || (Array.isArray(globs) && globs.length === 0)) {
			globs = `**/*.{${allExtensions.join(',')}}`;
		}

		globs = arrify(globs);

		// If any explicitly provided pattern is non-dynamic (a literal file path), throw when no files are found.
		// Dynamic glob patterns matching nothing is acceptable — the project may simply have no matching files yet.
		// The default glob substitution above is always dynamic, so this is false when no globs were provided.
		const hasExplicitFilePaths = globs.some(glob => !isDynamicPattern(glob));

		const files: string | string[] = await globby(globs, {
			ignore: [...defaultIgnores, ...arrify(this.#baseXoConfig.ignores)],
			onlyFiles: true,
			gitignore: true,
			globalGitignore: true,
			absolute: true,
			dot: true,
			cwd: this._linterOptions.cwd,
		});

		if (this._linterOptions.suppressionsLocation) {
			const suppressionsFilePath = path.resolve(this._linterOptions.cwd, this._linterOptions.suppressionsLocation);

			if (!syncFs.existsSync(suppressionsFilePath)) {
				throw createErrorWithExitCode(suppressionsFileMissingErrorMessage, 2);
			}
		}

		await this.initEslint(files);

		if (!this.#eslint) {
			throw new Error('Failed to initialize ESLint');
		}

		const eslint = this.#eslint;
		const ignoredResults = await getIgnoredExplicitFileResults(this._linterOptions.cwd, globs, eslint);

		if (files.length === 0) {
			if (hasExplicitFilePaths && ignoredResults.length === 0) {
				throw new Error(noFilesFoundErrorMessage);
			}

			return this.processReport(ignoredResults);
		}

		const results = await eslint.lintFiles(files);

		const rulesMeta = eslint.getRulesMetaForResults(results);

		// No overlap: `warnIgnored: false` makes ESLint silently drop ignored files from `results`.
		return this.processReport([...results, ...ignoredResults], {rulesMeta});
	}

	/**
	Lints the text on the XO instance.
	*/
	async lintText(
		code: string,
		lintTextOptions: LintTextOptions,
	): Promise<XoLintResult> {
		const {filePath, warnIgnored} = lintTextOptions;

		if (this._linterOptions.suppressionsLocation) {
			const suppressionsFilePath = path.resolve(this._linterOptions.cwd, this._linterOptions.suppressionsLocation);

			if (!syncFs.existsSync(suppressionsFilePath)) {
				throw createErrorWithExitCode(suppressionsFileMissingErrorMessage, 2);
			}
		}

		await this.initEslint([filePath]);

		if (!this.#eslint) {
			throw new Error('Failed to initialize ESLint');
		}

		const results = await this.#eslint?.lintText(code, {
			filePath,
			warnIgnored,
		});

		const rulesMeta = this.#eslint.getRulesMetaForResults(results ?? []);

		return this.processReport(results ?? [], {rulesMeta});
	}

	async calculateConfigForFile(filePath: string): Promise<Linter.Config> {
		await this.initEslint([filePath]);

		if (!this.#eslint) {
			throw new Error('Failed to initialize ESLint');
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
		return this.#eslint.calculateConfigForFile(filePath) as Promise<Linter.Config>;
	}

	async getFormatter(name: string) {
		await this.initEslint();

		if (!this.#eslint) {
			throw new Error('Failed to initialize ESLint');
		}

		return this.#eslint.loadFormatter(name);
	}

	/**
	Add virtual files to the config with a tsconfig approach.
	*/
	private async addVirtualFilesToConfig(files: string[]): Promise<void> {
		if (!this._xoConfig) {
			return;
		}

		try {
			const nextVirtualFiles = new Set(files);

			const tsconfigPath = path.join(this._cacheLocation, 'tsconfig.stdin.json');
			const configIndex = this._xoConfig.findIndex(configItem => {
				const {languageOptions} = configItem;
				const parserOptionsCandidate = (languageOptions as Linter.LanguageOptions | undefined)?.parserOptions;
				const parserOptions = parserOptionsCandidate as TypeScriptParserOptions | undefined;
				return parserOptions?.project === tsconfigPath;
			});

			if (nextVirtualFiles.size > 0) {
				const filesArray = [...nextVirtualFiles];
				const relativeFiles = filesArray.map(file => path.relative(this._linterOptions.cwd, file));

				const tsconfigContent = {
					compilerOptions: {
						...tsconfigDefaults.compilerOptions,
						module: 'ESNext',
						moduleResolution: 'NodeNext',
						esModuleInterop: true,
						skipLibCheck: true,
					},
					files: filesArray,
				};

				await fs.writeFile(tsconfigPath, JSON.stringify(tsconfigContent, null, 2));

				if (configIndex === -1) {
					const parserOptions: TypeScriptParserOptions = {
						projectService: false,
						project: tsconfigPath,
						tsconfigRootDir: this._linterOptions.cwd,
					};
					this._xoConfig.push({
						files: relativeFiles,
						languageOptions: {
							parser: typescriptParser,
							parserOptions,
						},
					});
				} else {
					const existingConfig = this._xoConfig[configIndex];
					this._xoConfig[configIndex] = {
						...existingConfig,
						files: relativeFiles,
					};
				}

				this.#virtualFiles.clear();
				for (const file of nextVirtualFiles) {
					this.#virtualFiles.add(file);
				}

				return;
			}

			if (configIndex >= 0) {
				this._xoConfig.splice(configIndex, 1);
			}

			this.#virtualFiles.clear();

			await fs.rm(tsconfigPath, {force: true});
		} catch (error) {
			console.warn('XO: Failed to create tsconfig for virtual files. Type-aware linting will be disabled for these files.', error instanceof Error ? error.message : String(error));
		}
	}

	/**
	Add existing files to the config with an in-memory TypeScript Program.
	*/
	private addExistingFilesToConfig(files: string[], program?: ts.Program): void {
		if (!this._xoConfig || files.length === 0) {
			return;
		}

		const parserOptions: TypeScriptParserOptions = {
			project: false,
			projectService: false,
		};

		if (program) {
			parserOptions.programs = [program];
		}

		const config: XoConfigItem = {
			files: files.map(file => path.relative(this._linterOptions.cwd, file)),
			languageOptions: {
				parser: typescriptParser,
				parserOptions,
			},
		};

		// IMPORTANT: All files intentionally share the same config object reference for memory efficiency.
		// This prevents unbounded memory growth in long-running processes (e.g., language servers).
		// The config is immutable after creation, so sharing is safe.
		// Deduplication happens in setEslintConfig() via Set to avoid duplicate configs in the final array.
		for (const file of files) {
			this.#fileConfigs.set(file, config);
		}
	}

	private processReport(
		report: ESLint.LintResult[],
		{rulesMeta = {}} = {},
	): XoLintResult {
		if (this._linterOptions.quiet) {
			report = ESLint.getErrorResults(report);
		}

		const result = {
			results: report,
			rulesMeta,
			...this.getReportStatistics(report),
		};

		defineLazyProperty(result, 'usedDeprecatedRules', () => {
			const seenRules = new Set();
			const rules = [];

			for (const {usedDeprecatedRules} of report) {
				for (const rule of usedDeprecatedRules) {
					if (seenRules.has(rule.ruleId)) {
						continue;
					}

					seenRules.add(rule.ruleId);
					rules.push(rule);
				}
			}

			return rules;
		});

		return result;
	}

	private getReportStatistics(results: ESLint.LintResult[]) {
		const statistics = {
			errorCount: 0,
			warningCount: 0,
			fixableErrorCount: 0,
			fixableWarningCount: 0,
		};

		for (const result of results) {
			statistics.errorCount += result.errorCount;
			statistics.warningCount += result.warningCount;
			statistics.fixableErrorCount += result.fixableErrorCount;
			statistics.fixableWarningCount += result.fixableWarningCount;
		}

		return statistics;
	}
}

export default Xo;
