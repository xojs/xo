const path = require('path');

module.exports = {
	resolve: {
		alias: {
			file2alias: path.resolve(__dirname, 'file2.js')
		}
	}
};
