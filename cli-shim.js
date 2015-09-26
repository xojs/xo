#!/usr/bin/env node
'use strict';
var resolve = require('resolve');

var cliPath;

try {
	cliPath = resolve.sync('xo/cli', {basedir: process.cwd()});
	process.env.NO_UPDATE_NOTIFIER = 1;
} catch (e) {
	cliPath = './cli';
}

require(cliPath);
