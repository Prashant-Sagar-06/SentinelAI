const express = require("express");
const router = express.Router();
const demoController = require("../controllers/demo.controller");

router.get("/db-failure", demoController.triggerDbFailure);
router.get("/api-timeout", demoController.triggerApiTimeout);
router.get("/memory-warning", demoController.triggerMemoryWarning);

module.exports = router;
