require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const logger = require("./config/logger");
const requestLogger = require("./middleware/requestLogger.middleware");

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB(logger);

// Routes
const healthRoutes = require("./routes/health.routes");
const demoRoutes = require("./routes/demo.routes");

// Middleware
app.use(express.json());
app.use(requestLogger);

// Route registration
app.use("/health", healthRoutes);
app.use("/demo", demoRoutes);

app.listen(PORT, () => {
    logger.info(`Demo app running on port: http://localhost:${PORT}`);
});
