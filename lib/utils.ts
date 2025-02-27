import arrify from 'arrify';
import {type SetRequired} from 'type-fest';
import {type Linter} from 'eslint';
import {allFilesGlob} from './constants.js';
import {type XoConfigItem} from './types.js';

/**
 * Convert a `xo` config item to an ESLint config item.
 * In a flat structure these config items represent the config object items.
 *
 * Files and rules will always be defined and all other eslint config properties are preserved.
 *
 * @param xoConfig
 * @returns eslintConfig
 */
export const xoToEslintConfigItem = (xoConfig: XoConfigItem): SetRequired<Linter.Config, 'rules' | 'files'> => {
	const {files, rules, space, prettier, ignores, semicolon, react, ..._xoConfig} = xoConfig;

	const eslintConfig: SetRequired<Linter.Config, 'rules' | 'files'> = {
		..._xoConfig,
		files: arrify(xoConfig.files ?? allFilesGlob),
		rules: xoConfig.rules ?? {},
	};

	eslintConfig.ignores &&= arrify(xoConfig.ignores);

	return eslintConfig;
};
