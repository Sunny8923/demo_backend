require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./modules/auth/auth.routes");
const jobRoutes = require("./modules/jobs/job.routes");
const partnerRoutes = require("./modules/partner/partner.routes");
const applicationRoutes = require("./modules/applications/application.routes");
const adminDashboardRoutes = require("./modules/admin/dashboard/adminDashboard.routes");
const partnerDashboardRoutes = require("./modules/partner/dashboard/partnerDashboard.routes");
const userDashboardRoutes = require("./modules/user/dashboard/userDashboard.routes");

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

app.use("/admin/dashboard", adminDashboardRoutes);
app.use("/partner/dashboard", partnerDashboardRoutes);
app.use("/user/dashboard", userDashboardRoutes);

module.exports = app;
