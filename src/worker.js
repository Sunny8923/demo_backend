require("dotenv").config();

console.log("🚀 Worker starting...");

try {
  require("./workers/resume.worker");
  console.log("✅ Resume worker running");
} catch (err) {
  console.error("❌ Worker failed:", err);
}
