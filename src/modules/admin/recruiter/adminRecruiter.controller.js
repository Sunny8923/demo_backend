const recruiterService = require("./adminRecruiter.service");

////////////////////////////////////////////////////////////
/// CREATE RECRUITER (ADMIN ONLY)
////////////////////////////////////////////////////////////

async function createRecruiter(req, res) {
  try {
    const { name, email, password } = req.body;

    ////////////////////////////////////////////////////////////
    // VALIDATION
    ////////////////////////////////////////////////////////////

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

    ////////////////////////////////////////////////////////////
    // CREATE RECRUITER
    ////////////////////////////////////////////////////////////

    const recruiter = await recruiterService.createRecruiter({
      name,
      email,
      password,
    });

    ////////////////////////////////////////////////////////////
    // RESPONSE
    ////////////////////////////////////////////////////////////

    return res.status(201).json({
      success: true,
      message: "Recruiter created successfully",
      data: recruiter,
    });
  } catch (error) {
    console.error("Create recruiter error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

////////////////////////////////////////////////////////////

module.exports = {
  createRecruiter,
};
