try {
	await import('./src/index.js');
} catch (err) {
	console.error("❌ Worker failed to start:", err);
	process.exit(1);
}
