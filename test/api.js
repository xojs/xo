import path from 'path';
import test from 'ava';
import fn from '../';

const hasRule = (results, ruleId) => results[0].messages.some(x => x.ruleId === ruleId);

test('.lintText()', t => {
	const results = fn.lintText(`'use strict'\nconsole.log('unicorn');\n`).results;
	t.true(hasRule(results, 'semi'));
});

test('.lintText() - `esnext` option', t => {
	const results = fn.lintText('var foo = true;', {esnext: true}).results;
	t.true(hasRule(results, 'no-var'));
});

test('.lintText() - JSX support', t => {
	const results = fn.lintText('var app = <div className="appClass">Hello, React!</div>;\n', {esnext: false}).results;
	t.true(hasRule(results, 'no-unused-vars'));
});

test('.lintText() - plugin support', t => {
	const results = fn.lintText('var React;\nReact.render(<App/>);\n', {
		plugins: ['react'],
		rules: {'react/jsx-no-undef': 2}
	}).results;
	t.true(hasRule(results, 'react/jsx-no-undef'));
});

test('.lintText() - prevent use of extended native objects', t => {
	const results = fn.lintText('[].unicorn();\n').results;
	t.true(hasRule(results, 'no-use-extend-native/no-use-extend-native'));
});

test('.lintText() - extends support', t => {
	const results = fn.lintText('var React;\nReact.render(<App/>);\n', {
		extends: 'xo-react'
	}).results;
	t.true(hasRule(results, 'react/jsx-no-undef'));
});

test('.lintText() - extends support with `esnext` option', t => {
	const results = fn.lintText('import path from \'path\';\nvar React;\nReact.render(<App/>);\n', {
		esnext: true,
		extends: 'xo-react'
	}).results;
	t.true(hasRule(results, 'react/jsx-no-undef'));
});

test('always use the latest ECMAScript parser so esnext syntax won\'t throw in normal mode', t => {
	const results = fn.lintText('async function foo() {}\n\nfoo();\n').results;
	t.is(results[0].errorCount, 0);
});

test('.lintText() - regression test for #71', t => {
	const results = fn.lintText(`var foo = { key: 'value' };\nconsole.log(foo);\n`, {
		extends: path.join(__dirname, 'fixtures/extends.js')
	}).results;
	t.is(results[0].errorCount, 0, results[0]);
});
