<h1 align="center">
	<br>
	<img width="400" src="https://cdn.rawgit.com/sindresorhus/xo/5d23bf1e280f574579825dc1a29ed22c69790acf/media/logo.svg" alt="XO">
	<br>
	<br>
	<br>
</h1>

> JavaScript happiness style linter

[![Build Status: Linux](https://travis-ci.org/sindresorhus/xo.svg?branch=master)](https://travis-ci.org/sindresorhus/xo) [![Build status: Windows](https://ci.appveyor.com/api/projects/status/mydb56kve054n2h5/branch/master?svg=true)](https://ci.appveyor.com/project/sindresorhus/xo/branch/master) [![Coverage Status](https://coveralls.io/repos/github/sindresorhus/xo/badge.svg?branch=master)](https://coveralls.io/github/sindresorhus/xo?branch=master) [![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo) [![Gitter](https://badges.gitter.im/join_chat.svg)](https://gitter.im/xojs/Lobby)

Opinionated but configurable ESLint wrapper with lots of goodies included. Enforces strict and readable code. Never discuss code style on a pull request again! No decision-making. No `.eslintrc` or `.jshintrc` to manage. It just works!

Uses [ESLint](http://eslint.org) underneath, so issues regarding rules should be opened over [there](https://github.com/eslint/eslint/issues).

*JSX is supported by default, but you'll need [eslint-config-xo-react](https://github.com/sindresorhus/eslint-config-xo-react#use-with-xo) for React specific linting.*

![](https://raw.githubusercontent.com/sindresorhus/eslint-formatter-pretty/master/screenshot.png)


## Highlights

- Beautiful output.
- Zero-config, but [configurable when needed](#config).
- Enforces readable code, because you read more code than you write.
- No need to specify file paths to lint as it lints all JS files except for [commonly ignored paths](#ignores).
- [Config overrides per files/globs.](#config-overrides) *(ESLint doesn't support this)*
- Includes many useful ESLint plugins, like [`unicorn`](https://github.com/sindresorhus/eslint-plugin-unicorn), [`import`](https://github.com/benmosher/eslint-plugin-import), [`ava`](https://github.com/avajs/eslint-plugin-ava), and more.
- Caches results between runs for much better performance.
- Super simple to add XO to a project with `$ xo --init`.
- Fix many issues automagically with `$ xo --fix`.
- Open all files with errors at the correct line in your editor with `$ xo --open`.
- Specify [indent](#indent) and [semicolon](#semicolon) preferences easily without messing with the rule config.
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
    --init            Add XO to your project
    --fix             Automagically fix issues
    --reporter        Reporter to use
    --env             Environment preset  [Can be set multiple times]
    --global          Global variable  [Can be set multiple times]
    --ignore          Additional paths to ignore  [Can be set multiple times]
    --space           Use space indent instead of tabs  [Default: 2]
    --no-semicolon    Prevent use of semicolons
    --plugin          Include third-party plugins  [Can be set multiple times]
    --extend          Extend defaults with a custom config  [Can be set multiple times]
    --open            Open files with issues in your editor
    --quiet           Show only errors and no warnings
    --extension       Additional extension to lint [Can be set multiple times]
    --no-esnext       Don't enforce ES2015+ rules
    --cwd=<dir>       Working directory for files
    --stdin           Validate/fix code from stdin
    --stdin-filename  Specify a filename for the --stdin option
    --version         Show the version number

  Examples
    $ xo
    $ xo index.js
    $ xo *.js !foo.js
    $ xo --space
    $ xo --env=node --env=mocha
    $ xo --init --space
    $ xo --plugin=react
    $ xo --plugin=html --extension=html
    $ echo 'const x=true' | xo --stdin --fix

  Tips
    Put options in package.json instead of using flags so other tools can read it.
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

Check out an [example](index.js) and the [ESLint rules](https://github.com/sindresorhus/eslint-config-xo/blob/master/index.js).


## Workflow

The recommended workflow is to add XO locally to your project and run it with the tests.

Simply run `$ xo --init` (with any options) to add XO to your package.json or create one.

### Before

```json
{
  "name": "awesome-package",
  "scripts": {
    "test": "ava"
  },
  "devDependencies": {
    "ava": "^0.16.0"
  }
}
```

### After

```json
{
  "name": "awesome-package",
  "scripts": {
    "test": "xo && ava"
  },
  "devDependencies": {
    "ava": "^0.16.0",
    "xo": "^0.18.0"
  }
}
```

Then just run `$ npm test` and XO will be run before your tests.


## Config

You can configure some options in XO by putting it in package.json:

```json
{
  "name": "awesome-package",
  "xo": {
    "space": true
  }
}
```

[Globals](http://eslint.org/docs/user-guide/configuring#specifying-globals) and [rules](http://eslint.org/docs/user-guide/configuring#configuring-rules) can be configured inline in files.

### envs

Type: `Array`<br>
Default: `['node']`

Which [environments](http://eslint.org/docs/user-guide/configuring#specifying-environments) your code is designed to run in. Each environment brings with it a certain set of predefined global variables.

### globals

Type: `Array`

Additional global variables your code accesses during execution.

### ignores

Type: `Array`

Some [paths](https://github.com/sindresorhus/xo/blob/master/options-manager.js) are ignored by default, including paths in `.gitignore`. Additional ignores can be added here.

### space

Type: `boolean`, `number`<br>
Default: `false` *(tab indentation)*

Set it to `true` to get 2-space indentation or specify the number of spaces.

This option exists for pragmatic reasons, but I would strongly recommend you read ["Why tabs are superior"](http://lea.verou.me/2012/01/why-tabs-are-clearly-superior/).

### rules

Type: `Object`

Override any of the [default rules](https://github.com/sindresorhus/eslint-config-xo/blob/master/index.js). See the [ESLint docs](http://eslint.org/docs/rules/) for more info on each rule.

Please take a moment to consider if you really need to use this option.

### semicolon

Type: `boolean`<br>
Default: `true` *(semicolons required)*

Set it to `false` to enforce no-semicolon style.

### plugins

Type: `Array`

Include third-party [plugins](http://eslint.org/docs/user-guide/configuring.html#configuring-plugins).

### extends

Type: `Array`, `string`

Use one or more [shareable configs](http://eslint.org/docs/developer-guide/shareable-configs.html) or [plugin configs](http://eslint.org/docs/user-guide/configuring#using-the-configuration-from-a-plugin) to override any of the default rules (like `rules` above).

### extensions

Type: `Array`

Allow more extensions to be linted besides `.js` and `.jsx`. Make sure they're supported by ESLint or an ESLint plugin.

### settings

Type: `Object`

[Shared ESLint settings](http://eslint.org/docs/user-guide/configuring#adding-shared-settings) exposed to rules. For example, to configure the [`import`](https://github.com/benmosher/eslint-plugin-import#settings) plugin to use your webpack configuration for determining search paths, you can put `{"import/resolver": "webpack"}` here.

### parser

Type: `string`

ESLint parser. For example, [`babel-eslint`](https://github.com/babel/babel-eslint) if you're using language features that ESLint doesn't yet support.

### esnext

Type: `boolean`<br>
Default: `true`

Enforce ES2015+ rules. Disabling this will make it not *enforce* ES2015+ syntax and conventions.

*ES2015+ is parsed even without this option. You can already use ES2017 features like [`async`/`await`](https://github.com/lukehoban/ecmascript-asyncawait).


## Config Overrides

XO makes it easy to override configs for specific files. The `overrides` property must be an array of override objects. Each override object must contain a `files` property which is a glob string, or an array of glob strings. The remaining properties are identical to those described above, and will override the settings of the base config. If multiple override configs match the same file, each matching override is applied in the order it appears in the array. This means the last override in the array takes precedence over earlier ones. Consider the following example:

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

If you have a directory structure with nested `package.json` files and you want one of the child manifests to be skipped, you can do so by setting `"xo": false`. For example, when you have separate app and dev `package.json` files with `electron-builder`.

### Monorepo

Put a `package.json` with your config at the root and add `"xo": false` to the `package.json` in your bundled packages.


## FAQ

#### What does XO mean?

It means [hugs and kisses](https://en.wiktionary.org/wiki/xoxo).

#### Why not Standard?

The [Standard style](http://standardjs.com) is a really cool idea. I too wish we could have one style to rule them all! But the reality is that the JS community is just too diverse and opinionated to create *one* code style. They also made the mistake of pushing their own style instead of the most popular one. In contrast, XO is more pragmatic and has no aspiration of being *the* style. My goal with XO is to make it simple to enforce consistent code style with close to no config. XO comes with my code style preference by default, as I mainly made it for myself, but everything is configurable.

#### Why not ESLint?

XO is based on ESLint. This project started out as just a shareable ESLint config, but it quickly grew out of that. I wanted something even simpler. Just typing `xo` and be done. No decision-making. No config. I also have some exciting future plans for it. However, you can still get most of the XO benefits while using ESLint directly with the [ESLint shareable config](https://github.com/sindresorhus/eslint-config-xo).


## Editor plugins

- [Sublime Text](https://github.com/sindresorhus/SublimeLinter-contrib-xo)
- [Atom](https://github.com/sindresorhus/atom-linter-xo)
- [Vim](https://github.com/sindresorhus/vim-xo)
- [TextMate 2](https://github.com/claylo/XO.tmbundle)
- [VSCode](https://github.com/SamVerschueren/vscode-linter-xo)
- [Emacs](https://github.com/j-em/xo-emacs)


## Build-system plugins

- [Gulp](https://github.com/sindresorhus/gulp-xo)
- [Grunt](https://github.com/sindresorhus/grunt-xo)
- [webpack](https://github.com/Semigradsky/xo-loader)
- [Metalsmith](https://github.com/blainsmith/metalsmith-xo)
- [Fly](https://github.com/lukeed/fly-xo)


## Configs

- [eslint-config-xo](https://github.com/sindresorhus/eslint-config-xo) - ESLint shareable config for XO
- [eslint-config-xo-space](https://github.com/sindresorhus/eslint-config-xo-space) - ESLint shareable config for XO with 2-space indent
- [eslint-config-xo-react](https://github.com/sindresorhus/eslint-config-xo-react) - ESLint shareable config for React to be used with the above


## Support

- [Gitter chat](https://gitter.im/xojs/Lobby)
- [Twitter](https://twitter.com/sindresorhus)


## Related

- [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn) - Various awesome ESLint rules *(Bundled in XO)*


## Badge

Show the world you're using XO → [![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)

```md
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
```


## Team

[![Sindre Sorhus](https://avatars.githubusercontent.com/u/170270?s=130)](https://sindresorhus.com) | [![James Talmage](https://avatars.githubusercontent.com/u/4082216?s=130)](https://github.com/jamestalmage) | [![Mario Nebl](https://avatars.githubusercontent.com/u/4248851?s=130)](https://github.com/marionebl)
---|---|---
[Sindre Sorhus](https://sindresorhus.com) | [James Talmage](https://github.com/jamestalmage) | [Mario Nebl](https://github.com/marionebl)


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
