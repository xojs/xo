'use strict';
const path = require('path');
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
			.map(pattern => this.parsePattern(pattern, baseDirectory))
			.sort(patternInfo => patternInfo.isIgnorePattern ? 1 : -1)
			.map(patternInfo => patternInfo.pattern);
	}

	parsePattern(pattern, baseDirectory) {
		const isIgnorePattern = !pattern.startsWith('!');

		if (isIgnorePattern) {
			pattern = '!' + path.join(baseDirectory, pattern);
		} else {
			pattern = path.join(baseDirectory, pattern.substr(1));
		}

		return {isIgnorePattern, pattern};
	}
}

module.exports = GitignoreParser;
