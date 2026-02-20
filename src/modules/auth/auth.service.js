const prisma = require("../../config/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

////////////////////////////////////////////////////////
// VERIFY JWT SECRET
////////////////////////////////////////////////////////

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

////////////////////////////////////////////////////////
// SIGNUP
////////////////////////////////////////////////////////

async function signup({ name, email, password }) {
  //////////////////////////////////////////////////////
  // NORMALIZE EMAIL
  //////////////////////////////////////////////////////

  email = email.toLowerCase().trim();

  //////////////////////////////////////////////////////
  // CHECK EXISTING USER
  //////////////////////////////////////////////////////

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) throw new Error("Email already registered");

  //////////////////////////////////////////////////////
  // HASH PASSWORD
  //////////////////////////////////////////////////////

  const hashedPassword = await bcrypt.hash(password, 10);

  //////////////////////////////////////////////////////
  // CREATE USER
  //////////////////////////////////////////////////////

  const user = await prisma.user.create({
    data: {
      name: name.trim(),

      email,

      password: hashedPassword,

      role: "USER",
    },

    select: {
      id: true,

      name: true,

      email: true,

      role: true,

      createdAt: true,
    },
  });

  return user;
}

////////////////////////////////////////////////////////
// LOGIN
////////////////////////////////////////////////////////

async function login({ email, password }) {
  email = email.toLowerCase().trim();

  //////////////////////////////////////////////////////
  // FIND USER
  //////////////////////////////////////////////////////

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) throw new Error("Invalid email or password");

  //////////////////////////////////////////////////////
  // VERIFY PASSWORD
  //////////////////////////////////////////////////////

  const valid = await bcrypt.compare(password, user.password);

  if (!valid) throw new Error("Invalid email or password");

  //////////////////////////////////////////////////////
  // GENERATE TOKEN
  //////////////////////////////////////////////////////

  const token = jwt.sign(
    {
      userId: user.id,

      email: user.email,

      role: user.role,
    },

    process.env.JWT_SECRET,

    {
      expiresIn: "7d",
    },
  );

  //////////////////////////////////////////////////////
  // RETURN SAFE USER
  //////////////////////////////////////////////////////

  return {
    token,

    user: {
      id: user.id,

      name: user.name,

      email: user.email,

      role: user.role,

      createdAt: user.createdAt,
    },
  };
}

////////////////////////////////////////////////////////
// GET CURRENT USER
////////////////////////////////////////////////////////

async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },

    select: {
      id: true,

      name: true,

      email: true,

      role: true,

      createdAt: true,
    },
  });

  if (!user) throw new Error("User not found");

  return user;
}

////////////////////////////////////////////////////////

module.exports = {
  signup,
  login,
  getCurrentUser,
};
