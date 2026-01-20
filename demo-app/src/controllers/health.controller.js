exports.healthCheck = (req, res) => {
    res.status(200).json({
        status: "UP",
        service: "SentinelAI Demo App",
        timestamp: new Date().toISOString(),
    });
};
