#!/usr/bin/env node
'use strict';
 resolveCwd = require('resolve-cwd');
 hasFlag = require('has-flag');

 localCLI = resolveCwd.silent('xo/cli');

// Prefer the local installation of XO
 (!hasFlag('no-local')  localCLI  localCLI !== __filename) {
	 debug = require('debug')('xo');
	debug('Using local install of XO');
	require(localCLI);
}  {
	require('./cli-main');
}
