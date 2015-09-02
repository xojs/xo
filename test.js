'use strict';
var test = require('ava');
var fn = require('./');

test('.lintText()', function (t) {
	var results = fn.lintText('\'use strict\';\nconsole.log("unicorn");\n').results;
	t.is(results[0].messages[0].ruleId, 'quotes');
	t.end();
});

test('.lintText() esnext', function (t) {
	var results = fn.lintText('function dec() {}\nconst x = {\n\t@dec()\n\ta: 1\n};\n', {esnext: true}).results;
	t.is(results[0].messages[0].ruleId, 'no-unused-vars');
	t.end();
});

// TODO: more tests
