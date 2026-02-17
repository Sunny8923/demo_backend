const express = require("express");
const router = express.Router();

const authController = require("./auth.controller");
const authMiddleware = require("../../middlewares/auth.middleware");

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.get("/me", authMiddleware, authController.getCurrentUser);

module.exports = router;
