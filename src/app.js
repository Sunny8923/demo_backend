require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./modules/auth/auth.routes");
const jobRoutes = require("./modules/jobs/job.routes");
const partnerRoutes = require("./modules/partners/partner.routes");
const applicationRoutes = require("./modules/applications/application.routes");
const dashboardRoutes = require("./modules/dashboard/dashboard.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/jobs", jobRoutes);
app.use("/partner", partnerRoutes);
app.use("/applications", applicationRoutes);
app.use("/dashboard", dashboardRoutes);

module.exports = app;
