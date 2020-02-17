<h1 align="center">
	<br>
	<img width="400" src="media/logo.svg" alt="XO">
	<br>
	<br>
	<br>
</h1>

> JavaScript linter with great defaults

[![Build Status](https://travis-ci.org/xojs/xo.svg?branch=master)](https://travis-ci.org/xojs/xo) [![Coverage Status](https://coveralls.io/repos/github/xojs/xo/badge.svg?branch=master)](https://coveralls.io/github/xojs/xo?branch=master) [![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/xojs/xo) [![Gitter](https://badges.gitter.im/join_chat.svg)](https://gitter.im/xojs/Lobby)

Opinionated but configurable ESLint wrapper with lots of goodies included. Enforces strict and readable code. Never discuss code style on a pull request again! No decision-making. No `.eslintrc` or `.jshintrc` to manage. It just works!

Uses [ESLint](https://eslint.org) underneath, so issues regarding rules should be opened over [there](https://github.com/eslint/eslint/issues).

*JSX is supported by default, but you'll need [eslint-config-xo-react](https://github.com/xojs/eslint-config-xo-react#use-with-xo) for React specific linting.*

*Vue components are not supported by default. You'll need [eslint-config-xo-vue](https://github.com/ChocPanda/eslint-config-xo-vue#use-with-xo) for specific linting in a Vue app.*

![](https://raw.githubusercontent.com/sindresorhus/eslint-formatter-pretty/master/screenshot.png)

## Highlights

- Beautiful output.
- Zero-config, but [configurable when needed](#config).
- Enforces readable code, because you read more code than you write.
- No need to specify file paths to lint as it lints all JS files except for [commonly ignored paths](#ignores).
- [Config overrides per files/globs.](#config-overrides)
- Includes many useful ESLint plugins, like [`unicorn`](https://github.com/sindresorhus/eslint-plugin-unicorn), [`import`](https://github.com/benmosher/eslint-plugin-import), [`ava`](https://github.com/avajs/eslint-plugin-ava), [`node`](https://github.com/mysticatea/eslint-plugin-node) and more.
- Automatically enables rules based on the [`engines`](https://docs.npmjs.com/files/package.json#engines) field in your `package.json`.
- Caches results between runs for much better performance.
- Super simple to add XO to a project with [`$ npm init xo`](https://github.com/xojs/create-xo).
- Fix many issues automagically with `$ xo --fix`.
- Open all files with errors at the correct line in your editor with `$ xo --open`.
- Specify [indent](#space) and [semicolon](#semicolon) preferences easily without messing with the rule config.
- Optionally use the [Prettier](https://github.com/prettier/prettier) code style.
- Great [editor plugins](#editor-plugins).

## Install

```
$ npm install --global xo
```

## Usage

```
$ xo --help

  Usage
    $ xo [<file|glob> ...]

  Options
    --fix             Automagically fix issues
    --reporter        Reporter to use
    --env             Environment preset  [Can be set multiple times]
    --global          Global variable  [Can be set multiple times]
    --ignore          Additional paths to ignore  [Can be set multiple times]
    --space           Use space indent instead of tabs  [Default: 2]
    --no-semicolon    Prevent use of semicolons
    --prettier        Conform to Prettier code style
    --node-version    Range of Node.js version to support
    --plugin          Include third-party plugins  [Can be set multiple times]
    --extend          Extend defaults with a custom config  [Can be set multiple times]
    --open            Open files with issues in your editor
    --quiet           Show only errors and no warnings
    --extension       Additional extension to lint [Can be set multiple times]
    --no-esnext       Don't enforce ES2015+ rules
    --cwd=<dir>       Working directory for files
    --stdin           Validate/fix code from stdin
    --stdin-filename  Specify a filename for the --stdin option

  Examples
    $ xo
    $ xo index.js
    $ xo *.js !foo.js
    $ xo --space
    $ xo --env=node --env=mocha
    $ xo --plugin=react
    $ xo --plugin=html --extension=html
    $ echo 'const x=true' | xo --stdin --fix

  Tips
    - Add XO to your project with `npm init xo`.
    - Put options in package.json instead of using flags so other tools can read it.
```

*Note that the CLI will use your local install of XO when available, even when run globally.*

## Default code style

*Any of these can be [overridden](#rules) if necessary.*

- Tab indentation *[(or space)](#space)*
- Semicolons *[(or not)](#semicolon)*
- Single-quotes
- No unused variables
- Space after keyword `if (condition) {}`
- Always `===` instead of `==`

Check out an [example](index.js) and the [ESLint rules](https://github.com/xojs/eslint-config-xo/blob/master/index.js).

## Workflow

The recommended workflow is to add XO locally to your project and run it with the tests.

Simply run `$ npm init xo` (with any options) to add XO to your package.json or create one.

### Before/after

```diff
 {
 	"name": "awesome-package",
 	"scripts": {
-		"test": "ava",
+		"test": "xo && ava"
 	},
 	"devDependencies": {
-		"ava": "^2.0.0"
+		"ava": "^2.0.0",
+		"xo": "^0.25.0"
 	}
 }
```

Then just run `$ npm test` and XO will be run before your tests.

## Config

You can configure XO options with one of the following files:
1. as JSON in the `xo` property in `package.json`:
```json
{
	"name": "awesome-package",
	"xo": {
		"space": true
	}
}
```
2. as JSON in `.xorc` or `.xorc.json`
```json
{
	"space": true
}
3. as a JavaScript module in `.xorc.js` or `xo.config.js`
```js
module.exports = {
	space: true
};
```

[Globals](https://eslint.org/docs/user-guide/configuring#specifying-globals) and [rules](https://eslint.org/docs/user-guide/configuring#configuring-rules) can be configured inline in files.

### envs

Type: `string[]`\
Default: `['es2020', 'node']`

Which [environments](https://eslint.org/docs/user-guide/configuring#specifying-environments) your code is designed to run in. Each environment brings with it a certain set of predefined global variables.

### globals

Type: `string[]`

Additional global variables your code accesses during execution.

### ignores

Type: `string[]`

Some [paths](lib/options-manager.js) are ignored by default, including paths in `.gitignore` and [.eslintignore](https://eslint.org/docs/user-guide/configuring#eslintignore). Additional ignores can be added here.

### space

Type: `boolean | number`\
Default: `false` *(tab indentation)*

Set it to `true` to get 2-space indentation or specify the number of spaces.

This option exists for pragmatic reasons, but I would strongly recommend you read ["Why tabs are superior"](http://lea.verou.me/2012/01/why-tabs-are-clearly-superior/).

### rules

Type: `object`

Override any of the [default rules](https://github.com/xojs/eslint-config-xo/blob/master/index.js). See the [ESLint docs](https://eslint.org/docs/rules/) for more info on each rule.

Please take a moment to consider if you really need to use this option.

### semicolon

Type: `boolean`\
Default: `true` *(Semicolons required)*

Set it to `false` to enforce no-semicolon style.

### prettier

Type: `boolean`\
Default: `false`

Format code with [Prettier](https://github.com/prettier/prettier).

The [Prettier options](https://prettier.io/docs/en/options.html) will be read from the [Prettier config](https://prettier.io/docs/en/configuration.html) and if **not set** will be determined as follow:
- [semi](https://prettier.io/docs/en/options.html#semicolons): based on [semicolon](#semicolon) option
- [useTabs](https://prettier.io/docs/en/options.html#tabs): based on [space](#space) option
- [tabWidth](https://prettier.io/docs/en/options.html#tab-width): based on [space](#space) option
- [trailingComma](https://prettier.io/docs/en/options.html#trailing-commas): `none`
- [singleQuote](https://prettier.io/docs/en/options.html#quotes): `true`
- [bracketSpacing](https://prettier.io/docs/en/options.html#bracket-spacing): `false`
- [jsxBracketSameLine](https://prettier.io/docs/en/options.html#jsx-brackets): `false`

If contradicting options are set for both Prettier and XO an error will be thrown.

### nodeVersion

Type: `string | boolean`\
Default: Value of the `engines.node` key in the project `package.json`

Enable rules specific to the Node.js versions within the configured range.

If set to `false`, no rules specific to a Node.js version will be enabled.

### plugins

Type: `string[]`

Include third-party [plugins](https://eslint.org/docs/user-guide/configuring.html#configuring-plugins).

### extends

Type: `string | string[]`

Use one or more [shareable configs](https://eslint.org/docs/developer-guide/shareable-configs.html) or [plugin configs](https://eslint.org/docs/user-guide/configuring#using-the-configuration-from-a-plugin) to override any of the default rules (like `rules` above).

### extensions

Type: `string[]`

Allow more extensions to be linted besides `.js` and `.jsx`. Make sure they're supported by ESLint or an ESLint plugin.

### settings

Type: `object`

[Shared ESLint settings](https://eslint.org/docs/user-guide/configuring#adding-shared-settings) exposed to rules. For example, to configure the [`import`](https://github.com/benmosher/eslint-plugin-import#settings) plugin to use your webpack configuration for determining search paths, you can put `{"import/resolver": "webpack"}` here.

### parser

Type: `string`

ESLint parser. For example, [`babel-eslint`](https://github.com/babel/babel-eslint) if you're using language features that ESLint doesn't yet support.

### esnext

Type: `boolean`\
Default: `true`

Enforce ES2015+ rules. Disabling this will make it not *enforce* ES2015+ syntax and conventions.

*ES2015+ is parsed even without this option. You can already use ES2017 features like [`async`/`await`](https://github.com/lukehoban/ecmascript-asyncawait).

## TypeScript and Flow

### TypeScript

See [eslint-config-xo-typescript#use-with-xo](https://github.com/xojs/eslint-config-xo-typescript#use-with-xo)

### Flow

See [eslint-config-xo-flow#use-with-xo](https://github.com/xojs/eslint-config-xo-flow#use-with-xo)

## Config Overrides

XO makes it easy to override configs for specific files. The `overrides` property must be an array of override objects. Each override object must contain a `files` property which is a glob string, or an array of glob strings, relative to the config file. The remaining properties are identical to those described above, and will override the settings of the base config. If multiple override configs match the same file, each matching override is applied in the order it appears in the array. This means the last override in the array takes precedence over earlier ones. Consider the following example:

```json
{
	"xo": {
		"semicolon": false,
		"space": 2,
		"overrides": [
			{
				"files": "test/*.js",
				"esnext": false,
				"space": 3
			},
			{
				 "files": "test/foo.js",
				 "esnext": true
			}
		]
	}
}
```

- The base configuration is simply `space: 2`, `semicolon: false`. These settings are used for every file unless otherwise noted below.

- For every file in `test/*.js`, the base config is used, but `space` is overridden with `3`, and the `esnext` option is set to `false`. The resulting config is:

```json
{
	"esnext": false,
	"semicolon": false,
	"space": 3
}
```

- For `test/foo.js`, the base config is first applied, followed the first overrides config (its glob pattern also matches `test/foo.js`), finally the second override config is applied. The resulting config is:

```json
{
	"esnext": true,
	"semicolon": false,
	"space": 3
}
```

## Tips

### Using a parent's config

If you have a directory structure with nested `package.json` files and you want one of the child manifests to be skipped, you can do so by ommiting the `xo` property in the child's `package.json`. For example, when you have separate app and dev `package.json` files with `electron-builder`.

### Monorepo

Put a `package.json` with your config at the root and omit the `xo` property in the `package.json` of your bundled packages.

### Transpilation

If some files in your project are transpiled in order to support an older Node.js version, you can use the [config overrides](#config-overrides) option to set a specific [`nodeVersion`](#nodeversion) target for these files.

For example, if your project targets Node.js 4 (your `package.json` is configured with `engines.node` set to `>=4`) and you are using [AVA](https://github.com/avajs/ava), then your test files are automatically transpiled. You can override `nodeVersion` for the tests files:

```json
{
	"xo": {
		"overrides": [
			{
				"files": "{test,tests,spec,__tests__}/**/*.js",
				"nodeVersion": ">=9"
			}
		]
	}
}
```

### Including files ignored by default

You include files that XO ignores [files by default](https://github.com/xojs/xo/blob/master/lib/constants.js#L1) by adding aa negative glob in the `ignores` options:
```json
{
	"xo": {
		"ignores": [
			"!vendor/**"
		]
	}
}
```


## FAQ

#### What does XO mean?

It means [hugs and kisses](https://en.wiktionary.org/wiki/xoxo).

#### Why not Standard?

The [Standard style](https://standardjs.com) is a really cool idea. I too wish we could have one style to rule them all! But the reality is that the JS community is just too diverse and opinionated to create *one* code style. They also made the mistake of pushing their own style instead of the most popular one. In contrast, XO is more pragmatic and has no aspiration of being *the* style. My goal with XO is to make it simple to enforce consistent code style with close to no config. XO comes with my code style preference by default, as I mainly made it for myself, but everything is configurable.

#### Why not ESLint?

XO is based on ESLint. This project started out as just a shareable ESLint config, but it quickly grew out of that. I wanted something even simpler. Just typing `xo` and be done. No decision-making. No config. I also have some exciting future plans for it. However, you can still get most of the XO benefits while using ESLint directly with the [ESLint shareable config](https://github.com/xojs/eslint-config-xo).

## Editor plugins

- [Sublime Text](https://github.com/xojs/SublimeLinter-contrib-xo)
- [Atom](https://github.com/xojs/atom-linter-xo)
- [Vim](https://github.com/xojs/vim-xo)
- [TextMate 2](https://github.com/claylo/XO.tmbundle)
- [VSCode](https://github.com/SamVerschueren/vscode-linter-xo)
- [Emacs](https://github.com/j-em/xo-emacs)
- [WebStorm](https://github.com/jamestalmage/xo-with-webstorm)

## Build-system plugins

- [Gulp](https://github.com/xojs/gulp-xo)
- [Grunt](https://github.com/xojs/grunt-xo)
- [webpack loader](https://github.com/Semigradsky/xo-loader)
- [webpack plugin](https://github.com/nstanard/xo-webpack-plugin)
- [Metalsmith](https://github.com/blainsmith/metalsmith-xo)
- [Fly](https://github.com/lukeed/fly-xo)

## Configs

- [eslint-config-xo](https://github.com/xojs/eslint-config-xo) - ESLint shareable config for XO with tab indent
- [eslint-config-xo-space](https://github.com/xojs/eslint-config-xo-space) - ESLint shareable config for XO with 2-space indent
- [eslint-config-xo-react](https://github.com/xojs/eslint-config-xo-react) - ESLint shareable config for React to be used with the above
- [eslint-config-xo-vue](https://github.com/ChocPanda/eslint-config-xo-vue) - ESLint shareable config for Vue to be used with the above
- [stylelint-config-xo](https://github.com/xojs/stylelint-config-xo) - Stylelint shareable config for XO with tab indent
- [stylelint-config-xo-space](https://github.com/xojs/stylelint-config-xo-space) - Stylelint shareable config for XO with 2-space indent
- [tslint-xo](https://github.com/xojs/tslint-xo) - TSLint shareable config for XO
- [eslint-config-xo-typescript](https://github.com/xojs/eslint-config-xo-typescript) - ESLint shareable config for TypeScript
- [eslint-config-xo-flow](https://github.com/xojs/eslint-config-xo-flow) - ESLint shareable config for Flow

## Support

- [Twitter](https://twitter.com/sindresorhus)

## Related

- [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn) - Various awesome ESLint rules *(Bundled in XO)*
- [xo-summary](https://github.com/LitoMore/xo-summary) - Display output from `xo` as a list of style errors, ordered by count

## Badge

Show the world you're using XO → [![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/xojs/xo)

```md
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/xojs/xo)
```

You can also find some nice dynamic XO badges on [badgen.net](https://badgen.net/#xo).

## Team

[![Sindre Sorhus](https://github.com/sindresorhus.png?size=130)](https://sindresorhus.com) | [![Mario Nebl](https://github.com/marionebl.png?size=130)](https://github.com/marionebl) | [![Pierre Vanduynslager](https://github.com/pvdlg.png?size=130)](https://github.com/pvdlg)
---|---|---
[Sindre Sorhus](https://sindresorhus.com) | [Mario Nebl](https://github.com/marionebl) | [Pierre Vanduynslager](https://github.com/pvdlg)

###### Former

- [James Talmage](https://github.com/jamestalmage)
- [Michael Mayer](https://github.com/schnittstabil)
