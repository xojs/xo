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
import configXoTypescript from 'eslint-config-xo-typescript';
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
} from './constants.js';
import {xoToEslintConfig} from './xo-to-eslint.js';
import resolveXoConfig from './resolve-config.js';
import {handleTsconfig} from './handle-ts-files.js';
import {matchFilesForTsConfig, preProcessXoConfig} from './utils.js';

if (!configXoTypescript[4]) {
	throw new Error('Invalid eslint-config-xo-typescript');
}

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

		this.eslintConfig ??= xoToEslintConfig([...this.xoConfig], {prettierOptions: this.prettierConfig});
	}

	/**
	Sets the ignores on the XO instance.

	@private
	*/
	setIgnores() {
		if (!this.baseXoConfig.ignores) {
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
	Checks every TS file to ensure its included in the tsconfig and any that are not included are added to a generated tsconfig for type aware linting.

	@param files - The TypeScript files being linted.
	*/
	async handleUnincludedTsFiles(files?: string[]) {
		if (!this.linterOptions.ts) {
			return;
		}

		const tsFiles = matchFilesForTsConfig(this.linterOptions.cwd, files, this.tsFilesGlob, this.tsFilesIgnoresGlob);

		if (tsFiles.length === 0) {
			return;
		}

		const {fallbackTsConfigPath, unincludedFiles} = await handleTsconfig({
			cwd: this.linterOptions.cwd,
			files: tsFiles,
		});

		if (!this.xoConfig || unincludedFiles.length === 0) {
			return;
		}

		const config: XoConfigItem = {};
		config.files = unincludedFiles.map(file => path.relative(this.linterOptions.cwd, file));
		config.languageOptions ??= {...configXoTypescript[4]?.languageOptions};
		config.languageOptions.parserOptions ??= {};
		config.languageOptions.parserOptions['projectService'] = false;
		config.languageOptions.parserOptions['project'] = fallbackTsConfigPath;
		config.languageOptions.parserOptions['tsconfigRootDir'] = this.linterOptions.cwd;
		this.xoConfig.push(config);
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

		this.eslint ??= new ESLint(eslintOptions);
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
