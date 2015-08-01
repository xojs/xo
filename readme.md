<h1 align="center">
	<br>
	<img width="400" src="https://rawgit.com/sindresorhus/xo/master/media/logo.svg" alt="XO">
	<br>
	<br>
	<br>
</h1>

> JavaScript happiness style ❤️ [XOXO](https://en.wiktionary.org/wiki/xoxo)

[![Build Status](https://travis-ci.org/sindresorhus/xo.svg?branch=master)](https://travis-ci.org/sindresorhus/xo)

Enforce strict code style. Never discuss code style on a pull request again!

No decision-making. No `.eslintrc`, `.jshintrc`, `.jscsrc` to manage. It just works!

Uses [ESLint](http://eslint.org) underneath.


## Code style

- Tab indentation *([configurable](#config))*
- Semicolons
- Single-quotes
- No unused variables
- Space after keyword `if (condition) {}`
- Always `===` instead of `==`

Check out an [example](index.js) and the [ESLint rules](https://github.com/sindresorhus/eslint-config-xo/blob/master/index.js).


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
    --init     Add XO to your project
    --compact  Compact output
    --stdin    Validate code from stdin
    --esnext   Enable ES2015 support and rules
    --env      Environment preset  [Can be set multiple times]
    --global   Global variable  [Can be set multiple times]
    --ignore   Additional paths to ignore  [Can be set multiple times]
    --space    Use space indent instead of tabs  [Default: 2]

  Examples
    $ xo
    $ xo index.js
    $ xo *.js !foo.js
    $ xo --esnext --space --env=mocha

  Tips
    Put options in package.json instead of using flags so other tools can read it.
```


## Workflow

The recommended workflow is to add XO locally to your project and run it with the tests.

Simply run `$ xo --init` to add XO to your `package.json`:

### Before

```json
{
	"name": "my-awesome-project",
	"scripts": {
		"test": "mocha"
	},
	"devDependencies": {
		"mocha": "^2.0.0"
	}
}
```

### After

```json
{
	"name": "my-awesome-project",
	"scripts": {
		"test": "xo && mocha"
	},
	"devDependencies": {
		"mocha": "^2.0.0",
		"xo": "^0.4.0"
	}
}
```

## Config

You can configure some options in XO by putting it in `package.json`:

```js
{
	"name": "my-awesome-project",
	"xo": {
		"env": ["node", "mocha"]
	}
}
```

[Globals](http://eslint.org/docs/user-guide/configuring#specifying-globals) and [rules](http://eslint.org/docs/user-guide/configuring#configuring-rules) can be configured inline in files.

### esnext

Type: `boolean`  
Default: `false`

Enable ES2015 support and linting rules.

### env

Type: `array`  
Default: `['node']`

Which [environments](http://eslint.org/docs/user-guide/configuring#specifying-environments) your code is designed to run in. Each environment brings with it a certain set of predefined global variables.

### global

Type: `array`

Additional global variables your code accesses during execution.

### ignore

Type: `array`

Some [paths](https://github.com/sindresorhus/xo/blob/4a0db396766118d7918577d759cacb05cd99a354/index.js#L14-L20) are ignored by default. Additional ignores can be added here.

### space

Type: `boolean`, `number`  
Default: `false` *(tab indentation)*

Set it to `true` to get 2-space indentation or specify the number of spaces.

This option exists for pragmatic reasons, but I would strongly recommend you read ["Why tabs are superior"](http://lea.verou.me/2012/01/why-tabs-are-clearly-superior/).


## FAQ

#### Why not Standard?

[Standard style](http://standardjs.com) is a really cool idea. I too wish we could have one style to rule them all! Unfortunately, they made a huge mistake of pushing their own style instead of the most popular one. I also think "no semicolons" is dumb. In contrast, XO is more pragmatic. XO does use tabs by default, but that's configurable since I realize not every wants or even can use tabs.

#### Why not ESLint?

XO is based on ESLint. This project started out as just a shareable ESLint config, but it quickly grew out of that. I wanted something even simpler. Just typing `xo` and be done. No decision-making. No config. I also have some exciting future plans for it. However, you can still get most of the XO benefits while using ESLint directly with the [ESLint shareable config](https://github.com/sindresorhus/eslint-config-xo).


## Editors

- Sublime Text: [SublimeLinter-contrib-xo](https://github.com/sindresorhus/SublimeLinter-contrib-xo)
- Atom: [atom-linter-xo](https://github.com/sindresorhus/atom-linter-xo)


## Related

- [eslint-config-xo](https://github.com/sindresorhus/eslint-config-xo) - ESLint shareable config for XO
- [eslint-config-xo-space](https://github.com/sindresorhus/eslint-config-xo-space) - ESLint shareable config for XO with 2-space indent
- [eslint-config-react](https://github.com/sindresorhus/eslint-config-react) - ESLint shareable config for React to be used with the above


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
