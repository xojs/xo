#!/usr/bin/env node
'use strict';
require('fallback-cli')({
	path: 'xo/cli',
	before: function (location) {
		if (location === 'local') {
			process.env.NO_UPDATE_NOTIFIER = 1;
		}
	}
});
