#!/usr/bin/env node
'use strict';
var resolve = require('resolve');

var cliPath;

try {
	cliPath = resolve.sync('xo/cli', {basedir: process.cwd()});
} catch (e) {
	cliPath = './cli';
}

require(cliPath);
