const express = require("express");
const router = express.Router();

const applicationController = require("./application.controller");
const authMiddleware = require("../../middlewares/auth.middleware");

// apply to job (user or partner)
router.post("/apply", authMiddleware, applicationController.applyToJob);
// get my applications
router.get("/my", authMiddleware, applicationController.getMyApplications);
// admin: get all applications
router.get("/", authMiddleware, applicationController.getAllApplications);

module.exports = router;
