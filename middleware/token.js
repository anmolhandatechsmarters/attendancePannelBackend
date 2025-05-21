const jwt = require("jsonwebtoken");
require("dotenv").config();
const db = require("../Connection");
const secret_key = process.env.JWT_SECRET;

const generateToken = (user_id, role) => {
  const token = jwt.sign({ id: user_id, role: role }, secret_key, {
    expiresIn: "2h",
  });
  return token;
};

const generateRefreshToken = async (user_id, role) => {
  const token = jwt.sign({ id: user_id, role: role }, secret_key, {
    expiresIn: "7d",
  });
  return token;
};

const checkTokenExpiration = (token) => {
  try {
    const decodedToken = jwt.decode(token);
    if (!decodedToken || !decodedToken.exp) {
      return null;
    }
    const currentTime = Date.now() / 1000;
    const expTime = decodedToken.exp;

    if (expTime - currentTime < 300) {
      return true;
    }
    return false;
  } catch (error) {
    return null;
  }
};

const verifyusertoken = (token) => {
  if (!token) {
    console.error("JWT Verification Error: No token provided");
    return false;
  }

  try {
    return jwt.verify(token, secret_key); 
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      console.error("JWT Verification Error: Token expired");
      return false; 
    }
    console.error("JWT Verification Error:", error.message);
    return false;
  }
};



module.exports = {
  generateToken,
  verifyusertoken,
  generateRefreshToken,
  checkTokenExpiration,
};
