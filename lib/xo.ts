import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import {ESLint, type Linter} from 'eslint';
import findCacheDir from 'find-cache-dir';
import {globby} from 'globby';
import arrify from 'arrify';
import defineLazyProperty from 'define-lazy-prop';
import micromatch from 'micromatch';
import prettier from 'prettier';
import {
	type XoLintResult,
	type LinterOptions,
	type LintTextOptions,
	type FlatXoConfig,
	type XoConfigOptions,
	type XoConfigItem,
} from './types.js';
import {
	defaultIgnores, cacheDirName, allExtensions, tsFilesGlob,
} from './constants.js';
import {xoToEslintConfig} from './xo-to-eslint.js';
import resolveXoConfig from './resolve-config.js';
import {tsconfig} from './tsconfig.js';

export class Xo {
	/**
	 * Static helper to convert an xo config to an eslint config
	 * to be used in eslint.config.js
	 */
	static xoToEslintConfig = xoToEslintConfig;
	/**
   * Static lintText helper for backwards compat and use in editor extensions and other tools
  */
	static async lintText(code: string, options: LintTextOptions & LinterOptions & XoConfigOptions) {
		const xo = new Xo(
			{
				cwd: options.cwd,
				fix: options.fix,
				filePath: options.filePath,
				quiet: options.quiet,
				ts: options.ts ?? true,
			},
			{
				react: options.react,
				space: options.space,
				semicolon: options.semicolon,
				prettier: options.prettier,
				ignores: options.ignores,
			},
		);
		return xo.lintText(code, {filePath: options.filePath, warnIgnored: options.warnIgnored});
	}

	/**
   * Static lintFiles helper for backwards compat and use in editor extensions and other tools
  */
	static async lintFiles(globs: string | undefined, options: LinterOptions & XoConfigOptions) {
		const xo = new Xo(
			{
				cwd: options.cwd,
				fix: options.fix,
				filePath: options.filePath,
				quiet: options.quiet,
				ts: options.ts,
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
   * Write the fixes to disk
   */
	static async outputFixes(results: XoLintResult) {
		await ESLint.outputFixes(results?.results ?? []);
	}

	/**
   * Required linter options,cwd, fix, and filePath (in case of lintText)
   */
	linterOptions: LinterOptions;
	/**
   * Base Xo config options that allow configuration from cli or other sources
   * not to be confused with the xoConfig property which is the resolved Xo config from the flat config AND base config
   */
	baseXoConfig: XoConfigOptions;
	/**
   * File path to the eslint cache
   */
	cacheLocation: string;
	/**
   * A re-usable ESLint instance configured with options calculated from the Xo config
   */
	eslint?: ESLint;
	/**
   * Xo config derived from both the base config and the resolved flat config
   */
	xoConfig?: FlatXoConfig;
	/**
   * The ESLint config calculated from the resolved Xo config
  */
	eslintConfig?: Linter.Config[];
	/**
  * The flat xo config path, if there is one
  */
	flatConfigPath?: string | undefined;

	/**
	 * If any user configs container prettier, we will need to fetch the prettier config
	 */
	prettier?: boolean;
	/**
	 * The prettier config if it exists and is needed
	 */
	prettierConfig?: prettier.Options;

	constructor(_linterOptions: LinterOptions, _baseXoConfig: XoConfigOptions = {}) {
		this.linterOptions = _linterOptions;
		this.baseXoConfig = _baseXoConfig;

		// Fix relative cwd paths
		if (!path.isAbsolute(this.linterOptions.cwd)) {
			this.linterOptions.cwd = path.resolve(process.cwd(), this.linterOptions.cwd);
		}

		const backupCacheLocation = path.join(os.tmpdir(), cacheDirName);

		this.cacheLocation = findCacheDir({name: cacheDirName, cwd: this.linterOptions.cwd}) ?? backupCacheLocation;
	}

	/**
   * SetXoConfig sets the xo config on the Xo instance
   * @private
   */
	async setXoConfig() {
		if (!this.xoConfig) {
			const {flatOptions, flatConfigPath} = await resolveXoConfig({
				...this.linterOptions,
			});
			this.xoConfig = [this.baseXoConfig, ...flatOptions];
			this.prettier = this.xoConfig.some(config => config.prettier);
			this.prettierConfig = await prettier.resolveConfig(flatConfigPath, {editorconfig: true}) ?? {};
			this.flatConfigPath = flatConfigPath;
		}
	}

	/**
   * SetEslintConfig sets the eslint config on the Xo instance
   * @private
   */
	async setEslintConfig() {
		if (!this.xoConfig) {
			throw new Error('"Xo.setEslintConfig" failed');
		}

		this.eslintConfig ??= await xoToEslintConfig([...this.xoConfig], {prettierOptions: this.prettierConfig});
	}

	/**
   * SetIgnores sets the ignores on the Xo instance
   * @private
   */
	setIgnores() {
		if (this.baseXoConfig.ignores) {
			let ignores: string[] = [];

			if (typeof this.baseXoConfig.ignores === 'string') {
				ignores = arrify(this.baseXoConfig.ignores);
			} else if (Array.isArray(this.baseXoConfig.ignores)) {
				ignores = this.baseXoConfig.ignores;
			}

			if (!this.xoConfig) {
				throw new Error('"Xo.setIgnores" failed');
			}

			if (ignores.length > 0) {
				this.xoConfig.push({ignores});
			}
		}
	}

	/**
	 * Checks every ts file to ensure its included in the tsconfig
	 * and any that are not included are added to a generated tsconfig for type aware linting
	 *
	 * @param files the ts files being linted
	 */
	async handleUnincludedTsFiles(files?: string[]) {
		if (this.linterOptions.ts && files && files.length > 0) {
			const tsFiles = files.filter(file => micromatch.isMatch(file, tsFilesGlob, {dot: true}));

			if (tsFiles.length > 0) {
				const {fallbackTsConfigPath, unmatchedFiles} = await tsconfig({
					cwd: this.linterOptions.cwd,
					files: tsFiles,
				});

				if (this.xoConfig && unmatchedFiles.length > 0) {
					const config: XoConfigItem = {};
					config.files = unmatchedFiles;
					config.languageOptions ??= {};
					config.languageOptions.parserOptions ??= {};
					config.languageOptions.parserOptions['projectService'] = false;
					config.languageOptions.parserOptions['project'] = fallbackTsConfigPath;
					this.xoConfig.push(config);
				}
			}
		}
	}

	/**
   * InitEslint initializes the ESLint instance on the Xo instance
   */
	public async initEslint(files?: string[]) {
		await this.setXoConfig();

		this.setIgnores();

		await this.handleUnincludedTsFiles(files);

		await this.setEslintConfig();

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
   * LintFiles lints the files on the Xo instance
   * @param globs glob pattern to pass to globby
   * @returns XoLintResult
   * @throws Error
   */
	async lintFiles(globs?: string | string[]): Promise<XoLintResult> {
		if (!globs || (Array.isArray(globs) && globs.length === 0)) {
			globs = `**/*.{${allExtensions.join(',')}}`;
		}

		globs = arrify(globs);

		let files: string | string[] = await globby(globs, {
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
			files = '!**/*';
		}

		const results = await this.eslint.lintFiles(files);

		const rulesMeta = this.eslint.getRulesMetaForResults(results);

		return this.processReport(results, {rulesMeta});
	}

	/**
   * LintText lints the text on the Xo instance
   * @param code
   * @param lintTextOptions
   * @returns XoLintResult
   * @throws Error
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
