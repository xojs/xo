'use strict';
const fs = require('fs');
const path = require('path');
const gitIgnore = require('ignore');
const globby = require('globby');
const slash = require('slash');

const mapGitIgnorePatternTo = base => ignore => {
	if (ignore.startsWith('!')) {
		return '!' + path.posix.join(base, ignore.substr(1));
	}

	return path.posix.join(base, ignore);
};

const parseGitIgnore = (content, opts) => {
	const base = slash(path.relative(opts.cwd, path.dirname(opts.fileName)));

	return content
		.split(/\r?\n/)
		.filter(Boolean)
		.filter(l => l.charAt(0) !== '#')
		.map(mapGitIgnorePatternTo(base));
};

const getGitIgnoreFilter = opts => {
	const ignore = opts.ignores || [];
	const cwd = opts.cwd || process.cwd();

	const i = globby.sync('**/.gitignore', {ignore, cwd})
		.reduce((ignores, file) => {
			const fileName = path.join(cwd, file);
			const content = fs.readFileSync(fileName, 'utf8');
			ignores.add(parseGitIgnore(content, {cwd, fileName}));
			return ignores;
		}, gitIgnore());

	return p => !i.ignores(slash(path.relative(cwd, p)));
};

exports.getGitIgnoreFilter = getGitIgnoreFilter;
