import test from 'ava';
import fn from '../';

function hasRule(results, ruleId) {
	return results[0].messages.some(x => x.ruleId === ruleId);
}

test('.lintText()', t => {
	const results = fn.lintText('\'use strict\';\nconsole.log("unicorn");\n').results;
	t.true(hasRule(results, 'quotes'));
	t.end();
});

test('.lintText() - `esnext` option', t => {
	const results = fn.lintText('function dec() {}\nconst x = {\n\t@dec()\n\ta: 1\n};\n', {esnext: true}).results;
	t.true(hasRule(results, 'no-unused-vars'));
	t.end();
});

test('.lintText() - JSX support', t => {
	const results = fn.lintText('var app = <div className="appClass">Hello, React!</div>;\n', {esnext: false}).results;
	t.true(hasRule(results, 'no-unused-vars'));
	t.end();
});

test('.lintText() - plugin support', t => {
	const results = fn.lintText('var React;\nReact.render(<App/>);\n', {
		plugins: ['react'],
		rules: {'react/jsx-no-undef': 2}
	}).results;
	t.true(hasRule(results, 'react/jsx-no-undef'));
	t.end();
});

// test('.lintText() - prevent use of extended native objects', t => {
// 	const results = fn.lintText('[].unicorn();\n').results;
// 	t.true(hasRule(results, 'no-use-extend-native/no-use-extend-native'));
// 	t.end();
// });

test('.lintText() - extends support', t => {
	const results = fn.lintText('var React;\nReact.render(<App/>);\n', {
		extends: 'xo-react'
	}).results;
	t.true(hasRule(results, 'react/jsx-no-undef'));
	t.end();
});

test('.lintText() - extends support with `esnext` option', t => {
	const results = fn.lintText('import path from \'path\';\nvar React;\nReact.render(<App/>);\n', {
		esnext: true,
		extends: 'xo-react'
	}).results;
	t.true(hasRule(results, 'react/jsx-no-undef'));
	t.end();
});
