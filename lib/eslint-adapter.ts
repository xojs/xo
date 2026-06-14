import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {type Linter} from 'eslint';
import {Xo} from './xo.js';

const eslintConfigNames = [
	'eslint.config.js',
	'eslint.config.mjs',
	'eslint.config.cjs',
	'eslint.config.ts',
	'eslint.config.mts',
	'eslint.config.cts',
];

function findEslintConfigDirectory(cwd: string): string | undefined {
	let currentDirectory = cwd;

	for (;;) {
		for (const configName of eslintConfigNames) {
			if (fs.existsSync(path.join(currentDirectory, configName))) {
				return currentDirectory;
			}
		}

		const parentDirectory = path.dirname(currentDirectory);

		if (parentDirectory === currentDirectory) {
			return undefined;
		}

		currentDirectory = parentDirectory;
	}
}

function resolveConfigPathFromArgv(): string | undefined {
	const {argv} = process;

	for (const [index, argument] of argv.entries()) {
		if (argument === '--config' || argument === '-c') {
			return argv[index + 1];
		}

		if (argument.startsWith('--config=')) {
			return argument.slice('--config='.length);
		}

		if (argument.startsWith('-c=')) {
			return argument.slice('-c='.length);
		}
	}

	return undefined;
}

function resolveAdapterCwd(): string {
	const configPath = resolveConfigPathFromArgv();

	if (configPath !== undefined && configPath !== '') {
		return path.dirname(path.resolve(process.cwd(), configPath));
	}

	return findEslintConfigDirectory(process.cwd()) ?? process.cwd();
}

/*
Keep the adapter small: resolve XO relative to the ESLint config location, then reuse XO's existing project config pipeline.

The project files are resolved once when this module is imported; files added afterwards are not picked up until ESLint reloads the config.
*/
// `ts: true` keeps XO's TypeScript fallback so TS files are linted even without a `tsconfig.json`, matching the CLI.
const eslintConfig: Linter.Config[] = await new Xo({cwd: resolveAdapterCwd(), ts: true}).getProjectEslintConfig();

export default eslintConfig;
