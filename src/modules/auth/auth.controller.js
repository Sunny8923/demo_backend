const authService = require("./auth.service");

async function signup(req, res) {
  try {
    const { name, email, password } = req.body;

    // basic validation
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    const user = await authService.signup({
      name,
      email,
      password,
    });

    res.status(201).json({
      message: "User created successfully",
      user,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const result = await authService.login({
      email,
      password,
    });

    res.json({
      message: "Login successful",
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    res.status(401).json({
      message: error.message,
    });
  }
}

async function getCurrentUser(req, res) {
  try {
    const userId = req.user.userId;

    const user = await authService.getCurrentUser(userId);

    res.json({
      user,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
}

module.exports = {
  signup,
  login,
  getCurrentUser,
};
