import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {cosmiconfig} from 'cosmiconfig';
import micromatch from 'micromatch';
import arrify from 'arrify';
import {createJiti} from 'jiti';
import {type FlatXoConfig, type LinterOptions, type XoConfigItem} from './types.js';
import {moduleName} from './constants.js';

const jiti = createJiti(import.meta.url, {moduleCache: false});

const loadTypeScriptConfig = async (filepath: string) => jiti.import(filepath, {default: true});
const packageJsonFilename = 'package.json';

type PackageJson = {
	xo?: unknown;
	workspaces?: unknown;
};

type WorkspacesObject = {
	packages?: unknown;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isPackageJson = (value: unknown): value is PackageJson => isObjectRecord(value);
const isWorkspacesObject = (value: unknown): value is WorkspacesObject => isObjectRecord(value);

const toStringArray = (values: unknown[]): string[] => {
	const strings: string[] = [];

	for (const value of values) {
		if (typeof value === 'string') {
			strings.push(value);
		}
	}

	return strings;
};

const readPackageJson = async (filePath: string): Promise<PackageJson | undefined> => {
	try {
		const packageJson = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;

		if (!isPackageJson(packageJson)) {
			return {};
		}

		return {
			xo: packageJson.xo,
			workspaces: packageJson.workspaces,
		};
	} catch (error: unknown) {
		if (isObjectRecord(error) && error['code'] === 'ENOENT') {
			return undefined;
		}

		throw error;
	}
};

const getWorkspacePatterns = (workspaces: unknown): string[] => {
	if (Array.isArray(workspaces)) {
		return toStringArray(workspaces);
	}

	if (isWorkspacesObject(workspaces)) {
		const {packages} = workspaces;

		if (Array.isArray(packages)) {
			return toStringArray(packages);
		}
	}

	return [];
};

const normalizePath = (filePath: string): string => filePath.split(path.sep).join('/');

const isWorkspacePackage = (workspaceRoot: string, cwd: string, patterns: string[]): boolean => {
	const relativeCwd = normalizePath(path.relative(workspaceRoot, cwd));

	return relativeCwd.length > 0 && micromatch.isMatch(relativeCwd, patterns, {dot: true});
};

const findParentWorkspacePackageConfig = async (cwd: string): Promise<string | undefined> => {
	let directory = path.dirname(cwd);

	while (true) {
		const packageJsonPath = path.join(directory, packageJsonFilename);
		// eslint-disable-next-line no-await-in-loop
		const packageJson = await readPackageJson(packageJsonPath);
		const workspacePatterns = getWorkspacePatterns(packageJson?.workspaces);

		if (
			packageJson?.xo !== undefined
			&& workspacePatterns.length > 0
			&& isWorkspacePackage(directory, cwd, workspacePatterns)
		) {
			return packageJsonPath;
		}

		const parentDirectory = path.dirname(directory);

		if (parentDirectory === directory) {
			return undefined;
		}

		directory = parentDirectory;
	}
};

/**
Finds the XO config file.
*/
export async function resolveXoConfig(options: LinterOptions): Promise<{
	flatOptions: XoConfigItem[];
	flatConfigPath: string;
}> {
	try {
		options.cwd ||= process.cwd();

		if (!path.isAbsolute(options.cwd)) {
			options.cwd = path.resolve(process.cwd(), options.cwd);
		}

		const stopDirectory = path.dirname(options.cwd);

		const flatConfigExplorer = cosmiconfig(moduleName, {
			searchPlaces: [
				packageJsonFilename,
				`${moduleName}.config.js`,
				`${moduleName}.config.mjs`,
				`${moduleName}.config.ts`,
				`${moduleName}.config.mts`,
			],
			loaders: {
				'.ts': loadTypeScriptConfig,
				'.mts': loadTypeScriptConfig,
			},
			stopDir: stopDirectory,
			cache: true,
		});

		options.filePath &&= path.resolve(options.cwd, options.filePath);

		const searchPath = options.filePath ?? options.cwd;

		let searchResult = await (
			options.configPath !== undefined && options.configPath !== ''
				? flatConfigExplorer.load(path.resolve(options.cwd, options.configPath)) as Promise<{config: FlatXoConfig | undefined; filepath: string}>

				: flatConfigExplorer.search(searchPath) as Promise<{config: FlatXoConfig | undefined; filepath: string}>
		);

		if ((options.configPath === undefined || options.configPath === '') && searchResult?.config === undefined) {
			const parentWorkspacePackageConfigPath = await findParentWorkspacePackageConfig(options.cwd);

			if (parentWorkspacePackageConfigPath !== undefined) {
				searchResult = await (flatConfigExplorer.load(parentWorkspacePackageConfigPath) as Promise<{config: FlatXoConfig | undefined; filepath: string}>);
			}
		}

		let {
			config: flatOptions = [],
			filepath: flatConfigPath = '', // eslint-disable-line @typescript-eslint/no-useless-default-assignment
		} = searchResult ?? {};

		flatOptions = arrify(flatOptions);

		return {
			flatOptions,
			flatConfigPath,
		};
	} catch (error) {
		throw new Error('Error resolving XO config, there is likely an issue with your config file. Please check the file for mistakes.', {cause: error});
	}
}

export default resolveXoConfig;
