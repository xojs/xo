import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import process from 'node:process';
import {ESLint, type Linter} from 'eslint';
import findCacheDirectory from 'find-cache-directory';
import {globby} from 'globby';
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
import {matchFilesForTsConfig, preProcessXoConfig, typescriptParser} from './utils.js';

type TypeScriptParserOptions = Linter.ParserOptions & {
	project?: string | string[] | boolean;
	projectService?: boolean;
	tsconfigRootDir?: string;
	programs?: unknown[];
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
	linterOptions: LinterOptions;

	/**
	Base XO config options that allow configuration from CLI or other sources. Not to be confused with the `xoConfig` property which is the resolved XO config from the flat config AND base config.
	*/
	baseXoConfig: XoConfigOptions;

	/**
	File path to the ESLint cache.
	*/
	cacheLocation: string;

	/**
	A re-usable ESLint instance configured with options calculated from the XO config.
	*/
	eslint?: ESLint;

	/**
	XO config derived from both the base config and the resolved flat config.
	*/
	xoConfig?: XoConfigItem[];

	/**
	The ESLint config calculated from the resolved XO config.
	*/
	eslintConfig?: Linter.Config[];

	/**
	The flat XO config path, if there is one.
	*/
	flatConfigPath?: string | undefined;

	/**
	If any user configs contain Prettier, we will need to fetch the Prettier config.
	*/
	prettier?: boolean;

	/**
	The Prettier config if it exists and is needed.
	*/
	prettierConfig?: prettier.Options;

	/**
	The glob pattern for TypeScript files, for which we will handle TS files and tsconfig.

	We expand this based on the XO config and the files glob patterns.
	*/
	tsFilesGlob: string[] = [tsFilesGlob];

	/**
	We use this to also add negative glob patterns in case a user overrides the parserOptions in their XO config.
	*/
	tsFilesIgnoresGlob: string[] = [];

	/**
	Track whether ignores have been added to prevent duplicate ignore configs.
	*/
	private ignoresHandled = false;

	/**
	Store per-file configs separately from base config to prevent unbounded array growth.
	Key: file path, Value: config for that file.
	This prevents memory bloat in long-running processes (e.g., language servers).
	*/
	private readonly fileConfigs = new Map<string, XoConfigItem>();

	/**
	Track virtual/stdin files that share a single tsconfig.stdin.json.
	These are handled differently from regular files.
	*/
	private readonly virtualFiles = new Set<string>();

	constructor(_linterOptions: LinterOptions, _baseXoConfig: XoConfigOptions = {}) {
		this.linterOptions = _linterOptions;
		this.baseXoConfig = _baseXoConfig;

		// Fix relative cwd paths
		if (!path.isAbsolute(this.linterOptions.cwd)) {
			this.linterOptions.cwd = path.resolve(process.cwd(), this.linterOptions.cwd);
		}

		const backupCacheLocation = path.join(os.tmpdir(), cacheDirName);

		this.cacheLocation = findCacheDirectory({name: cacheDirName, cwd: this.linterOptions.cwd}) ?? backupCacheLocation;
	}

	/**
	Sets the XO config on the XO instance.

	@private
	*/
	async setXoConfig() {
		if (this.xoConfig) {
			return;
		}

		const {flatOptions, flatConfigPath} = await resolveXoConfig({
			...this.linterOptions,
		});

		const {config, tsFilesGlob, tsFilesIgnoresGlob} = preProcessXoConfig([
			this.baseXoConfig,
			...flatOptions,
		]);

		this.xoConfig = config;
		this.tsFilesGlob.push(...tsFilesGlob);
		this.tsFilesIgnoresGlob.push(...tsFilesIgnoresGlob);
		this.prettier = this.xoConfig.some(config => config.prettier);
		this.prettierConfig = await prettier.resolveConfig(flatConfigPath, {editorconfig: true}) ?? {};
		this.flatConfigPath = flatConfigPath;
	}

	/**
	Sets the ESLint config on the XO instance.

	@private
	*/
	setEslintConfig() {
		if (!this.xoConfig) {
			throw new Error('"Xo.setEslintConfig" failed');
		}

		// Combine base config with per-file configs from Map
		// Deduplicate configs since multiple files can share the same config object
		const uniqueFileConfigs = [...new Set(this.fileConfigs.values())];
		const allConfigs = [...this.xoConfig, ...uniqueFileConfigs];

		// Always regenerate to support instance reuse with new files
		this.eslintConfig = xoToEslintConfig(allConfigs, {prettierOptions: this.prettierConfig});
	}

	/**
	Sets the ignores on the XO instance.

	@private
	*/
	setIgnores() {
		if (this.ignoresHandled || !this.baseXoConfig.ignores) {
			return;
		}

		let ignores: string[] = [];

		if (typeof this.baseXoConfig.ignores === 'string') {
			ignores = arrify(this.baseXoConfig.ignores);
		} else if (Array.isArray(this.baseXoConfig.ignores)) {
			ignores = this.baseXoConfig.ignores;
		}

		if (!this.xoConfig) {
			throw new Error('"Xo.setIgnores" failed');
		}

		if (ignores.length === 0) {
			return;
		}

		this.xoConfig.push({ignores});
		this.ignoresHandled = true;
	}

	/**
	Ensures the cache directory exists. This needs to run once before both tsconfig handling and running ESLint occur.

	@private
	*/
	async ensureCacheDirectory() {
		try {
			const cacheStats = await fs.stat(this.cacheLocation);
			// If file, re-create as directory
			if (cacheStats.isFile()) {
				await fs.rm(this.cacheLocation, {recursive: true, force: true});
				await fs.mkdir(this.cacheLocation, {recursive: true});
			}
		} catch {
			// If not exists, create the directory
			await fs.mkdir(this.cacheLocation, {recursive: true});
		}
	}

	/**
	Checks every TS file to ensure its included in the tsconfig and any that are not included are added to an in-memory TypeScript Program for type aware linting.

	@param files - The TypeScript files being linted.
	*/
	async handleUnincludedTsFiles(files?: string[]): Promise<void> {
		if (!this.linterOptions.ts || !files || files.length === 0) {
			return;
		}

		// Get ALL TypeScript files being linted (both new and previously handled)
		const allTsFiles = matchFilesForTsConfig(this.linterOptions.cwd, files, this.tsFilesGlob, this.tsFilesIgnoresGlob);

		// Clean up configs for files no longer being linted
		const activeFiles = new Set(allTsFiles);
		for (const handledFile of this.fileConfigs.keys()) {
			if (!activeFiles.has(handledFile)) {
				this.fileConfigs.delete(handledFile);
			}
		}

		// Clean up virtual files no longer being linted
		let prunedVirtualFiles = false;
		for (const virtualFile of this.virtualFiles) {
			if (!activeFiles.has(virtualFile)) {
				this.virtualFiles.delete(virtualFile);
				prunedVirtualFiles = true;
			}
		}

		// Filter to only new files that need config
		const tsFiles = allTsFiles.filter(file => !this.fileConfigs.has(file) && !this.virtualFiles.has(file));

		if (prunedVirtualFiles) {
			await this.addVirtualFilesToConfig([]);
		}

		if (tsFiles.length === 0) {
			return;
		}

		const {program, existingFiles, virtualFiles} = handleTsconfig({
			files: tsFiles,
			cwd: this.linterOptions.cwd,
			cacheLocation: this.cacheLocation,
		});

		// Handle virtual files with tsconfig approach (no redundant fs checks)
		if (virtualFiles.length > 0) {
			await this.addVirtualFilesToConfig(virtualFiles);
		}

		// Handle existing files with in-memory TypeScript Program (no redundant fs checks)
		if (existingFiles.length > 0) {
			this.addExistingFilesToConfig(existingFiles, program);
		}
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

		if (!this.xoConfig) {
			throw new Error('"Xo.initEslint" failed');
		}

		const eslintOptions: ESLint.Options = {
			cwd: this.linterOptions.cwd,
			overrideConfig: this.eslintConfig,
			overrideConfigFile: true,
			globInputPaths: false,
			warnIgnored: false,
			cache: true,
			cacheLocation: this.cacheLocation,
			fix: this.linterOptions.fix,
		};

		// Always create new instance to support reuse with updated config
		// ESLint's file-based cache (cacheLocation) persists across instances
		this.eslint = new ESLint(eslintOptions);
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

		const files: string | string[] = await globby(globs, {
			// Merge in command line ignores
			ignore: [...defaultIgnores, ...arrify(this.baseXoConfig.ignores)],
			onlyFiles: true,
			gitignore: true,
			absolute: true,
			cwd: this.linterOptions.cwd,
		});

		await this.initEslint(files);

		if (!this.eslint) {
			throw new Error('Failed to initialize ESLint');
		}

		if (files.length === 0) {
			return this.processReport([]);
		}

		const results = await this.eslint.lintFiles(files);

		const rulesMeta = this.eslint.getRulesMetaForResults(results);

		return this.processReport(results, {rulesMeta});
	}

	/**
	Lints the text on the XO instance.
	*/
	async lintText(
		code: string,
		lintTextOptions: LintTextOptions,
	): Promise<XoLintResult> {
		const {filePath, warnIgnored} = lintTextOptions;

		await this.initEslint([filePath]);

		if (!this.eslint) {
			throw new Error('Failed to initialize ESLint');
		}

		const results = await this.eslint?.lintText(code, {
			filePath,
			warnIgnored,
		});

		const rulesMeta = this.eslint.getRulesMetaForResults(results ?? []);

		return this.processReport(results ?? [], {rulesMeta});
	}

	async calculateConfigForFile(filePath: string): Promise<Linter.Config> {
		await this.initEslint([filePath]);

		if (!this.eslint) {
			throw new Error('Failed to initialize ESLint');
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
		return this.eslint.calculateConfigForFile(filePath) as Promise<Linter.Config>;
	}

	async getFormatter(name: string) {
		await this.initEslint();

		if (!this.eslint) {
			throw new Error('Failed to initialize ESLint');
		}

		return this.eslint.loadFormatter(name);
	}

	/**
	Add virtual files to the config with a tsconfig approach.
	*/
	private async addVirtualFilesToConfig(files: string[]): Promise<void> {
		if (!this.xoConfig) {
			return;
		}

		try {
			const nextVirtualFiles = new Set([...this.virtualFiles, ...files]);

			const tsconfigPath = path.join(this.cacheLocation, 'tsconfig.stdin.json');
			const configIndex = this.xoConfig.findIndex(configItem => {
				const {languageOptions} = configItem;
				const parserOptionsCandidate = (languageOptions as Linter.LanguageOptions | undefined)?.parserOptions;
				const parserOptions = parserOptionsCandidate as TypeScriptParserOptions | undefined;
				return parserOptions?.project === tsconfigPath;
			});

			if (nextVirtualFiles.size > 0) {
				const filesArray = [...nextVirtualFiles];
				const relativeFiles = filesArray.map(file => path.relative(this.linterOptions.cwd, file));

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
						tsconfigRootDir: this.linterOptions.cwd,
					};
					this.xoConfig.push({
						files: relativeFiles,
						languageOptions: {
							parser: typescriptParser,
							parserOptions,
						},
					});
				} else {
					const existingConfig = this.xoConfig[configIndex];
					this.xoConfig[configIndex] = {
						...existingConfig,
						files: relativeFiles,
					};
				}

				this.virtualFiles.clear();
				for (const file of nextVirtualFiles) {
					this.virtualFiles.add(file);
				}

				return;
			}

			if (configIndex >= 0) {
				this.xoConfig.splice(configIndex, 1);
			}

			this.virtualFiles.clear();

			await fs.rm(tsconfigPath, {force: true});
		} catch (error) {
			console.warn('XO: Failed to create tsconfig for virtual files. Type-aware linting will be disabled for these files.', error instanceof Error ? error.message : String(error));
		}
	}

	/**
	Add existing files to the config with an in-memory TypeScript Program.
	*/
	private addExistingFilesToConfig(files: string[], program?: ts.Program): void {
		if (!this.xoConfig || files.length === 0) {
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
			files: files.map(file => path.relative(this.linterOptions.cwd, file)),
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
			this.fileConfigs.set(file, config);
		}
	}

	private processReport(
		report: ESLint.LintResult[],
		{rulesMeta = {}} = {},
	): XoLintResult {
		if (this.linterOptions.quiet) {
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
