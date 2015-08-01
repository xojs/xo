'use strict';
var test = require('ava');
var fn = require('./');

test('.lintText()', function (t) {
	var results = fn.lintText('\'use strict\';\nconsole.log("unicorn");\n').results;
	t.assert(results[0].messages[0].ruleId === 'quotes');
	t.end();
});

// TODO: more tests
