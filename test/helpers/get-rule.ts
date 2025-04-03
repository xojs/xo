/* eslint-disable @stylistic/indent-binary-ops */
import {type Linter} from 'eslint';
import {
	allFilesGlob,
	jsFilesGlob,
	tsFilesGlob,
} from '../../lib/constants.js';

/**
Find the rule applied to JavaScript files.

@param flatConfig
@param ruleId
*/
export const getJsRule = (flatConfig: Linter.Config[], ruleId: string) => {
	const config = [...flatConfig].reverse().find(config =>
		(typeof config !== 'string'
			&& config?.rules?.[ruleId]
			&& config.files?.includes(allFilesGlob))
			?? config.files?.includes(jsFilesGlob));

	if (typeof config === 'string') {
		return undefined;
	}

	return config?.rules?.[ruleId];
};

/**
Find the rule applied to TypeScript files.

@param flatConfig
@param ruleId
*/
export const getTsRule = (flatConfig: Linter.Config[], ruleId: string) => {
	const config = [...flatConfig]
		.reverse()
		.find(config =>
			typeof config !== 'string'
				&& config?.rules?.[ruleId]
				&& config.files?.includes(tsFilesGlob));

	if (typeof config === 'string') {
		return undefined;
	}

	return config?.rules?.[ruleId];
};
