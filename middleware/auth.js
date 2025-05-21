const { verifyusertoken } = require("./token");
const db = require("../Connection.js");

const authentication = async (req, res, next) => {
  // Extract token from the Authorization header
  const token = req.headers.authorization?.split(" ")[1];
  const localStorageUserId = req.headers['x-user-id']; 

  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    // Verify the token
    const verifiedToken = verifyusertoken(token);
    const userIdFromToken = verifiedToken.id;  

    if (userIdFromToken != localStorageUserId) {
      return res.status(401).json({ message: "User ID mismatch: Unauthorized" });
    }

    // Fetch the user from the database
    const user = await db.users.findByPk(userIdFromToken);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if the token in the database matches the token sent by the client
    const storedToken = user.token;
    if (token !== storedToken) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // Attach user info to the request object
    req.user = {
      id: user.id,
      role: user.role,
    };

    next();  // Proceed to the next middleware or route handler

  } catch (error) {
    console.error(error);  // Log the error for debugging
    return res.status(401).json({ message: "Token verification failed" });
  }
};


const authorize = (allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

module.exports = { authentication, authorize };
