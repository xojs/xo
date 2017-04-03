'use strict';
const path = require('path');
const slash = require('slash');
const parseGitignore = require('parse-gitignore');

class GitignoreParser
{
	constructor(opts) {
		this.opts = Object.assign({
			cwd: ''
		}, opts);

		this.parseFile = this.parseFile.bind(this);
		this.parsePattern = this.parsePattern.bind(this);
	}

	parseFile(filepath) {
		filepath = path.resolve(this.opts.cwd, filepath);
		const baseDirectory = path.relative(this.opts.cwd, path.dirname(filepath));

		return parseGitignore(filepath)
			.map(pattern => this.parsePattern(pattern, baseDirectory));
	}

	parsePattern(pattern, baseDirectory) {
		baseDirectory = slash(baseDirectory);

		if (!pattern.startsWith('!')) {
			return '!' + path.posix.join(baseDirectory, pattern);
		}

		pattern = pattern.substr(1);

		if (pattern.startsWith('!')) {
			pattern = `@(${pattern})`;
		}

		return path.posix.join(baseDirectory, pattern);
	}
}

module.exports = GitignoreParser;
