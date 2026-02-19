const app = require("./app");

const PORT = process.env.PORT || 4000;
const HOST = "0.0.0.0"; // allow access from all IPs

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Accessible on: http://localhost:${PORT}`);
});
