import type {Simplify} from 'type-fest';
import {type ESLint, type Rule, type Linter} from 'eslint';

export type Space = boolean | number | string | undefined;

export type XoConfigOptions = {
	/**
	Use spaces for indentation.

	Tabs are used if the value is `false`, otherwise the value is the number of spaces to use or true, the default number of spaces is 2.
	*/
	space?: Space;

	/**
	Use semicolons at the end of statements or error for semi-colon usage.
	*/
	semicolon?: boolean;

	/**
	Use Prettier to format code.

	If `compat` is used, XO will not format with Prettier but will produce Prettier compatible code so Prettier can be used as a separate formatting tool.
	*/
	prettier?: boolean | 'compat';

	/**
	Add React support.
	*/
	react?: boolean;

	/**
	Files to ignore, can be a glob or array of globs.
	*/
	ignores?: string | string[];
};

export type LinterOptions = {
	/**
	The current working directory to use for relative paths.
	*/
	cwd: string;

	/**
	Write fixes to the files.
	*/
	fix?: boolean;

	/**
	The path to the file being linted.
	*/
	filePath?: string;

	/**
	If true, show only errors and NOT warnings. false by default.
	*/
	quiet?: boolean;

	/**
	Auto-configure type aware linting on unincluded TS files.

	Ensures that TypeScript files are linted with the type-aware parser even if they are not explicitly included in the tsconfig.

	@private
	*/
	ts?: boolean;
	/**
	 Custom path to config to use for the linter.
	*/
	configPath?: string;
};

export type LintTextOptions = {
	/**
	The path to the file being linted.
	*/
	filePath: string;

	/**
	Warn if the file is ignored.
	*/
	warnIgnored?: boolean;
};

export type XoConfigItem = Simplify<XoConfigOptions & Omit<Linter.Config, 'files' | 'ignores'> & {
	/**
	An array of glob patterns indicating the files that the configuration object should apply to. If not specified, the configuration object applies to all files.

	@see [Ignore Patterns](https://eslint.org/docs/latest/user-guide/configuring/configuration-files-new#excluding-files-with-ignores)
	*/
	files?: string | string[] | undefined;

	/**
	An array of glob patterns indicating the files that the configuration object should not apply to. If not specified, the configuration object applies to all files matched by files.

	@see [Ignore Patterns](https://eslint.org/docs/latest/user-guide/configuring/configuration-files-new#excluding-files-with-ignores)
	*/
	ignores?: string | string[] | undefined;
}>;

export type FlatXoConfig = XoConfigItem | XoConfigItem[];

export type XoLintResult = {
	errorCount: number;
	warningCount: number;
	fixableErrorCount: number;
	fixableWarningCount: number;
	results: ESLint.LintResult[];
	rulesMeta: Record<string, Rule.RuleMetaData>;
};
