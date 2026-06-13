import {type ExecaError} from 'execa';

/**
Awaits a promise that is expected to reject and returns the rejection reason.

Throws if the promise unexpectedly resolves, so it doubles as a rejection assertion.

@returns The rejection reason, typed as `ExecaError` by default.
*/
export const rejectionOf = async <ErrorType = ExecaError>(promise: Promise<unknown>): Promise<ErrorType> => {
	try {
		await promise;
	} catch (error) {
		return error as ErrorType;
	}

	throw new Error('Expected the promise to reject, but it resolved.');
};
