import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import tempDir from 'temp-dir';
import {pathExists} from 'path-exists';

/**
Creates a test project with a package.json and tsconfig.json and installs the dependencies.

@returns {string} The path to the test project.
*/
const cwd = path.join(tempDir, 'test-project');
const rootNodeModules = path.join(process.cwd(), 'node_modules');
const dependencies = [
	['typescript'],
	['@types', 'node'],
	['@sindresorhus', 'tsconfig'],
];

if (await pathExists(cwd)) {
	await fs.rm(cwd, {recursive: true, force: true});
}

// Create the test project directory
await fs.mkdir(cwd, {recursive: true});

// Create a package.json file
await fs.writeFile(
	path.join(cwd, 'package.json'),
	JSON.stringify({
		type: 'module',
		name: 'test-project',
	}),
);

// Create a tsconfig.json file
await fs.writeFile(
	path.join(cwd, 'tsconfig.json'),
	JSON.stringify({
		compilerOptions: {
			module: 'node16',
			target: 'ES2022',
			strictNullChecks: true,
			lib: ['DOM', 'DOM.Iterable', 'ES2022'],
		},
		exclude: ['node_modules'],
	}),
);

const copyDependency = async parts => {
	const source = path.join(rootNodeModules, ...parts);

	if (!(await pathExists(source))) {
		throw new Error(`Missing dependency ${parts.join('/')} in root node_modules`);
	}

	const target = path.join(cwd, 'node_modules', ...parts);
	await fs.mkdir(path.dirname(target), {recursive: true});
	await fs.cp(source, target, {recursive: true});
};

await Promise.all(dependencies.map(dependency => copyDependency(dependency)));
