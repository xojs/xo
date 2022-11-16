<h1 align="center">
	<br>
	<img width="400" src="media/logo.svg" alt="XO">
	<br>
	<br>
	<br>
</h1>

> JavaScript/TypeScript linter (ESLint wrapper) with great defaults

[![Coverage Status](https://codecov.io/gh/xojs/xo/branch/main/graph/badge.svg)](https://codecov.io/gh/xojs/xo/branch/main)
[![XO code style](https://shields.io/badge/code_style-5ed9c7?logo=xo&labelColor=gray)](https://github.com/xojs/xo)

Opinionated but configurable ESLint wrapper with lots of goodies included. Enforces strict and readable code. Never discuss code style on a pull request again! No decision-making. No `.eslintrc` to manage. It just works!

It uses [ESLint](https://eslint.org) underneath, so issues regarding built-in rules should be opened over [there](https://github.com/eslint/eslint/issues).

**XO requires your project to be [ESM](https://medium.com/sindre-sorhus/hello-modules-d1010b4e777b).**

![](https://raw.githubusercontent.com/sindresorhus/eslint-formatter-pretty/main/screenshot.png)

## Highlights

- Beautiful output.
- Zero-config, but [configurable when needed](#config).
- Enforces readable code, because you read more code than you write.
- No need to specify file paths to lint as it lints all JS/TS files except for [commonly ignored paths](#ignores).
- [Config overrides per files/globs.](#config-overrides)
- [TypeScript supported by default](#typescript)
- Includes many useful ESLint plugins, like [`unicorn`](https://github.com/sindresorhus/eslint-plugin-unicorn), [`import`](https://github.com/benmosher/eslint-plugin-import), [`ava`](https://github.com/avajs/eslint-plugin-ava), [`n`](https://github.com/eslint-community/eslint-plugin-n) and more.
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
$ npm install xo --save-dev
```

*You must install XO locally. You can run it directly with `$ npx xo`.*

*JSX is supported by default, but you'll need [eslint-config-xo-react](https://github.com/xojs/eslint-config-xo-react#use-with-xo) for React specific linting. Vue components are not supported by default. You'll need [eslint-config-xo-vue](https://github.com/ChocPanda/eslint-config-xo-vue#use-with-xo) for specific linting in a Vue app.*

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
    --cwd=<dir>       Working directory for files
    --stdin           Validate/fix code from stdin
    --stdin-filename  Specify a filename for the --stdin option
    --print-config    Print the ESLint configuration for the given file

  Examples
    $ xo
    $ xo index.js
    $ xo *.js !foo.js
    $ xo --space
    $ xo --env=node --env=mocha
    $ xo --plugin=react
    $ xo --plugin=html --extension=html
    $ echo 'const x=true' | xo --stdin --fix
    $ xo --print-config=index.js

  Tips
    - Add XO to your project with `npm init xo`.
    - Put options in package.json instead of using flags so other tools can read it.
```

## Default code style

*Any of these can be [overridden](#rules) if necessary.*

- Tab indentation *[(or space)](#space)*
- Semicolons *[(or not)](#semicolon)*
- Single-quotes
- [Trailing comma](https://medium.com/@nikgraf/why-you-should-enforce-dangling-commas-for-multiline-statements-d034c98e36f8) for multiline statements
- No unused variables
- Space after keyword `if (condition) {}`
- Always `===` instead of `==`

Check out an [example](index.js) and the [ESLint rules](https://github.com/xojs/eslint-config-xo/blob/main/index.js).

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
-		"ava": "^3.0.0"
+		"ava": "^3.0.0",
+		"xo": "^0.41.0"
 	}
 }
```

Then just run `$ npm test` and XO will be run before your tests.

## Config

You can configure XO options with one of the following files:

1. As JSON in the `xo` property in `package.json`:

```json
{
	"name": "awesome-package",
	"xo": {
		"space": true
	}
}
```

2. As JSON in `.xo-config` or `.xo-config.json`:

```json
{
	"space": true
}
```

3. As a JavaScript module in `.xo-config.js` or `xo.config.js`:

```js
module.exports = {
	space: true
};
```

4. For [ECMAScript module (ESM)](https://nodejs.org/api/esm.html) packages with [`"type": "module"`](https://nodejs.org/api/packages.html#packages_type), as a JavaScript module in `.xo-config.cjs` or `xo.config.cjs`:

```js
module.exports = {
	space: true
};
```

[Globals](https://eslint.org/docs/user-guide/configuring/language-options#specifying-globals) and [rules](https://eslint.org/docs/user-guide/configuring/rules#configuring-rules) can be configured inline in files.

### envs

Type: `string[]`\
Default: `['es2021', 'node']`

Which [environments](https://eslint.org/docs/user-guide/configuring/language-options#specifying-environments) your code is designed to run in. Each environment brings with it a certain set of predefined global variables.

### globals

Type: `string[]`

Additional global variables your code accesses during execution.

### ignores

Type: `string[]`

Some [paths](lib/options-manager.js) are ignored by default, including paths in `.gitignore` and [.eslintignore](https://eslint.org/docs/user-guide/configuring/ignoring-code#the-eslintignore-file). Additional ignores can be added here.

### space

Type: `boolean | number`\
Default: `false` *(tab indentation)*

Set it to `true` to get 2-space indentation or specify the number of spaces.

This option exists for pragmatic reasons, but I would strongly recommend you read ["Why tabs are superior"](http://lea.verou.me/2012/01/why-tabs-are-clearly-superior/).

### rules

Type: `object`

Override any of the [default rules](https://github.com/xojs/eslint-config-xo/blob/main/index.js). See the [ESLint docs](https://eslint.org/docs/rules/) for more info on each rule.

Disable a rule in your XO config to turn it off globally in your project.

Example using `package.json`:

```json
{
	"xo": {
		"rules": {
			"unicorn/no-array-for-each": "off"
		}
	}
}
```

You could also use `.xo-config.json` or one of the other config file formats supported by XO.

Please take a moment to consider if you really need to use this option.

### semicolon

Type: `boolean`\
Default: `true` *(Semicolons required)*

Set it to `false` to enforce no-semicolon style.

### prettier

Type: `boolean`\
Default: `false`

Format code with [Prettier](https://github.com/prettier/prettier).

[Prettier options](https://prettier.io/docs/en/options.html) will be based on your [Prettier config](https://prettier.io/docs/en/configuration.html). XO will then **merge** your options with its own defaults:
- [semi](https://prettier.io/docs/en/options.html#semicolons): based on [semicolon](#semicolon) option
- [useTabs](https://prettier.io/docs/en/options.html#tabs): based on [space](#space) option
- [tabWidth](https://prettier.io/docs/en/options.html#tab-width): based on [space](#space) option
- [trailingComma](https://prettier.io/docs/en/options.html#trailing-commas): `all`
- [singleQuote](https://prettier.io/docs/en/options.html#quotes): `true`
- [bracketSpacing](https://prettier.io/docs/en/options.html#bracket-spacing): `false`

To stick with Prettier's defaults, add this to your Prettier config:

```js
module.exports = {
	trailingComma: 'es5',
	singleQuote: false,
	bracketSpacing: true,
};
```

If contradicting options are set for both Prettier and XO an error will be thrown.

### nodeVersion

Type: `string | boolean`\
Default: Value of the `engines.node` key in the project `package.json`

Enable rules specific to the Node.js versions within the configured range.

If set to `false`, no rules specific to a Node.js version will be enabled.

### plugins

Type: `string[]`

Include third-party [plugins](https://eslint.org/docs/user-guide/configuring/plugins#configuring-plugins).

### extends

Type: `string | string[]`

Use one or more [shareable configs](https://eslint.org/docs/developer-guide/shareable-configs) or [plugin configs](https://eslint.org/docs/user-guide/configuring/configuration-files#using-a-configuration-from-a-plugin) to override any of the default rules (like `rules` above).

### extensions

Type: `string[]`

Allow more extensions to be linted besides `.js`, `.jsx`, `.mjs`, and `.cjs`. Make sure they're supported by ESLint or an ESLint plugin.

### settings

Type: `object`

[Shared ESLint settings](https://eslint.org/docs/user-guide/configuring/configuration-files#adding-shared-settings) exposed to rules.

### parser

Type: `string`

ESLint parser. For example, [`@babel/eslint-parser`](https://github.com/babel/babel/tree/main/eslint/babel-eslint-parser) if you're using language features that ESLint doesn't yet support.

### processor

Type: `string`

[ESLint processor.](https://eslint.org/docs/user-guide/configuring/plugins#specifying-processor)

### webpack

Type: `boolean | object`
Default: `false`

Use [eslint-import-resolver-webpack](https://github.com/benmosher/eslint-plugin-import/tree/master/resolvers/webpack) to resolve import search paths. This is enabled automatically if a `webpack.config.js` file is found.

Set this to a boolean to explicitly enable or disable the resolver.

Setting this to an object enables the resolver and passes the object as configuration. See the [resolver readme](https://github.com/benmosher/eslint-plugin-import/blob/master/resolvers/webpack/README.md) along with the [webpack documentation](https://webpack.js.org/configuration/resolve/) for more information.

## TypeScript

XO will automatically lint TypeScript files (`.ts`, `.d.ts` and `.tsx`) with the rules defined in [eslint-config-xo-typescript#use-with-xo](https://github.com/xojs/eslint-config-xo-typescript#use-with-xo).

XO will handle the [@typescript-eslint/parser `project` option](https://github.com/typescript-eslint/typescript-eslint/tree/master/packages/parser#parseroptionsproject) automatically even if you don't have a `tsconfig.json` in your project.

## GitHub Actions

XO uses a different formatter when running in a GitHub Actions workflow to be able to get [inline annotations](https://developer.github.com/changes/2019-09-06-more-check-annotations-shown-in-files-changed-tab/). XO also disables warnings here.

**Note**: For this to work, the [setup-node](https://github.com/actions/setup-node) action must be run before XO.

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
				"space": 3
			},
			{
				 "files": "test/foo.js",
				 "semicolon": true
			}
		]
	}
}
```

- The base configuration is simply `space: 2`, `semicolon: false`. These settings are used for every file unless otherwise noted below.

- For every file in `test/*.js`, the base config is used, but `space` is overridden with `3`. The resulting config is:

```json
{
	"semicolon": false,
	"space": 3
}
```

- For `test/foo.js`, the base config is first applied, followed the first overrides config (its glob pattern also matches `test/foo.js`), finally the second override config is applied. The resulting config is:

```json
{
	"semicolon": true,
	"space": 3
}
```

## Tips

### Using a parent's config

If you have a directory structure with nested `package.json` files and you want one of the child manifests to be skipped, you can do so by ommiting the `xo` property in the child's `package.json`. For example, when you have separate app and dev `package.json` files with `electron-builder`.

### Monorepo

Put a `package.json` with your config at the root and omit the `xo` property in the `package.json` of your bundled packages.

### Transpilation

If some files in your project are transpiled in order to support an older Node.js version, you can use the [config overrides](#config-overrides) option to set a specific [`nodeVersion`](#nodeversion) to target your sources files.

For example, if your project targets Node.js 8 but you want to use the latest JavaScript syntax as supported in Node.js 12:
1. Set the `engines.node` property of your `package.json` to `>=8`
2. Configure [Babel](https://babeljs.io) to transpile your source files (in `src` directory in this example)
3. Make sure to include the transpiled files in your published package with the [`files`](https://docs.npmjs.com/files/package.json#files) and [`main`](https://docs.npmjs.com/files/package.json#main) properties of your `package.json`
4. Configure the XO `overrides` option to set `nodeVersion` to `>=12` for your source files directory

```json
{
	"engines": {
		"node": ">=12"
	},
	"scripts": {
		"build": "babel src --out-dir dist"
	},
	"main": "dist/index.js",
	"files": ["dist/**/*.js"],
	"xo": {
		"overrides": [
			{
				"files": "{src}/**/*.js",
				"nodeVersion": ">=16"
			}
		]
	}
}
```

This way your `package.json` will contain the actual minimum Node.js version supported by your published code, but XO will lint your source code as if it targets Node.js 16.

### Including files ignored by default

To include files that XO [ignores by default](lib/constants.js#L1), add them as negative globs in the `ignores` option:

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

## Support

- [Twitter](https://twitter.com/sindresorhus)

## Related

- [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn) - Various awesome ESLint rules *(Bundled in XO)*
- [xo-summary](https://github.com/LitoMore/xo-summary) - Display output from `xo` as a list of style errors, ordered by count

## Badge

Show the world you're using XO → [![XO code style](https://shields.io/badge/code_style-5ed9c7?logo=xo&labelColor=gray)](https://github.com/xojs/xo)

```md
[![XO code style](https://shields.io/badge/code_style-5ed9c7?logo=xo&labelColor=gray)](https://github.com/xojs/xo)
```

Or [customize the badge](https://github.com/xojs/xo/issues/689#issuecomment-1253127616).

You can also find some nice dynamic XO badges on [badgen.net](https://badgen.net/#xo).

## Team

- [Sindre Sorhus](https://github.com/sindresorhus)

###### Former

- [James Talmage](https://github.com/jamestalmage)
- [Michael Mayer](https://github.com/schnittstabil)
- [Mario Nebl](https://github.com/marionebl)
- [Pierre Vanduynslager](https://github.com/pvdlg)
