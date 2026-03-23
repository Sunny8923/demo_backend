require("dotenv").config();

const app = require("./app");
const recoverJobs = require("./scripts/recoverJobs");

setInterval(
  () => {
    recoverJobs();
  },
  5 * 60 * 1000,
);

const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
