const promise = new Promise(resolve => {
	resolve('test');
});

function example() {
	return promise.then(console.log);
}
