#!/usr/bin/env node
/* eslint-disable import/no-unassigned-import */
'use strict';
const resolveCwd = require('resolve-cwd');
const hasFlag = require('has-flag');

const localCLI = resolveCwd('xo/cli');

// Prefer the local installation of XO
if (!hasFlag('no-local') && localCLI && localCLI !== __filename) {
	const debug = require('debug')('xo');
	debug('Using local install of XO');
	require(localCLI);
} else {
	require('./main');
}
