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

function resolveAdapterCwd(): string {
	const inlineConfigPath = process.argv.find(argument => argument.startsWith('--config=') || argument.startsWith('-c='))?.split('=').slice(1).join('=');

	if (inlineConfigPath) {
		return path.dirname(path.resolve(process.cwd(), inlineConfigPath));
	}

	const configFlagIndex = process.argv.findIndex(argument => argument === '--config' || argument === '-c');
	const configPath = configFlagIndex === -1 ? undefined : process.argv[configFlagIndex + 1];

	if (configPath) {
		return path.dirname(path.resolve(process.cwd(), configPath));
	}

	return findEslintConfigDirectory(process.cwd()) ?? process.cwd();
}

/*
Keep the adapter small: resolve XO relative to the ESLint config location, then reuse XO's existing project config pipeline.

This is a snapshot of the current project files, not a long-lived parser shim for files created after the adapter is imported.
*/
const eslintConfig: Linter.Config[] = await new Xo({cwd: resolveAdapterCwd(), ts: true}).getProjectEslintConfig();

export default eslintConfig;
