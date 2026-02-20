const authService = require("./auth.service");

////////////////////////////////////////////////////////
// SIGNUP
////////////////////////////////////////////////////////

async function signup(req, res) {
  try {
    const { name, email, password } = req.body;

    //////////////////////////////////////////////////////
    // VALIDATION
    //////////////////////////////////////////////////////

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,

        message: "Name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,

        message: "Password must be at least 6 characters",
      });
    }

    //////////////////////////////////////////////////////
    // CREATE USER
    //////////////////////////////////////////////////////

    const user = await authService.signup({
      name,

      email,

      password,
    });

    //////////////////////////////////////////////////////
    // RESPONSE
    //////////////////////////////////////////////////////

    return res.status(201).json({
      success: true,

      message: "User created successfully",

      data: user,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,

      message: error.message,
    });
  }
}

////////////////////////////////////////////////////////
// LOGIN
////////////////////////////////////////////////////////

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,

        message: "Email and password are required",
      });
    }

    const result = await authService.login({
      email,

      password,
    });

    return res.json({
      success: true,

      message: "Login successful",

      data: result.user,

      token: result.token,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,

      message: error.message,
    });
  }
}

////////////////////////////////////////////////////////
// GET CURRENT USER
////////////////////////////////////////////////////////

async function getCurrentUser(req, res) {
  try {
    const userId = req.user.userId;

    const user = await authService.getCurrentUser(userId);

    return res.json({
      success: true,

      data: user,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,

      message: error.message,
    });
  }
}

////////////////////////////////////////////////////////

module.exports = {
  signup,
  login,
  getCurrentUser,
};
