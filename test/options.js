import process from 'node:process';
import path from 'node:path';
import test from 'ava';
import xo from '../index.js';

test('prettier', async (t) => {
	const config = await xo.getConfig({prettier: true, filePath: 'example.js'});

	t.is(
		config.rules['arrow-body-style'][0],
		'off',
		'Should extends `eslint-plugin-prettier`, not `eslint-config-prettier`.'
	);

	t.is(
		config.rules['unicorn/empty-brace-spaces'][0],
		'off',
		'`unicorn/empty-brace-spaces` should be turned off by prettier.'
	);

	t.is(
		config.rules['@typescript-eslint/brace-style'][0],
		'off',
		'`@typescript-eslint/brace-style` should be turned off even we are not using TypeScript.'
	);
})
