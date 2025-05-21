const db = require("../../Connection");
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");

const base64url = require("base64url");
const jwt = require("jsonwebtoken");
const { generateToken } = require("../../middleware/token");

//=========================== passkey Funcion

//1. Register Passkey
const RegisterPasskey = async (req, res) => {
  try {
    const { userid } = req.params;
    const { rpID } = req.body;
    console.log("RegisterPasskey userid:", userid);

    const user = await db.users.findOne({ where: { id: userid } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const options = await generateRegistrationOptions({
      rpName: "attendance-pannel",
      rpID, // Using global rpID here
      userName: user.email,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
        authenticatorAttachment: "platform",
      },
    });

    const existingPasskey = await db.PasskeyModel.findOne({
      where: { userid },
    });
    if (existingPasskey) {
      await db.PasskeyModel.update(
        { current_challenge: options.challenge },
        { where: { userid } }
      );
    } else {
      await db.PasskeyModel.create({
        current_challenge: options.challenge,
        userid,
      });
    }

    const serializedOptions = {
      ...options,
      challenge: options.challenge,
    };

    return res.json(serializedOptions);
  } catch (error) {}
};

//2. Verify Register passkey

const verifyRegistration = async (req, res) => {
  try {
    const { userId, credential, rpID, origin } = req.body;

    if (!userId || !credential) {
      return res.status(400).json({ message: "Missing userId or credential" });
    }

    // Fetch user record
    const userRecord = await db.PasskeyModel.findOne({
      where: { userid: userId },
    });

    if (!userRecord) {
      return res.status(404).json({ message: "User not found" });
    }

    let expectedChallenge = userRecord.current_challenge;

    // Perform passkey verification
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return res.status(400).json({ error: "Passkey verification failed" });
    }

    // Extract credential details
    let credentialID = verification.registrationInfo.credential?.id;
    const counter = verification.registrationInfo.credential?.counter || 0;
    const transports =
      verification.registrationInfo.credential?.transports || [];
    const publicKey = verification.registrationInfo.credential?.publicKey;

    if (!credentialID || !publicKey) {
      return res.status(400).json({
        error: "Invalid credential data. Missing credential ID or public key.",
      });
    }

    // Remove the first character of the credential ID if it exists (i.e., if it starts with '-')
    if (credentialID.startsWith("-")) {
      credentialID = credentialID.slice(1);
    }

    const publicKeyBase64 = base64url.encode(publicKey);

    let passkeys = Array.isArray(userRecord.passkeys)
      ? userRecord.passkeys
      : [];
    const existingIndex = passkeys.findIndex((p) => p.id === credentialID);
    if (existingIndex !== -1) {
      passkeys[existingIndex] = {
        id: credentialID,
        publicKey: publicKeyBase64,
        transports,
        counter,
      };
    } else {
      passkeys.push({
        id: credentialID,
        publicKey: publicKeyBase64,
        transports,
        counter,
      });
    }

    await db.PasskeyModel.update(
      { passkeys: passkeys },
      { where: { userid: userId } }
    );

    return res.json({
      verified: true,
      message: "Passkey registered successfully!",
    });
  } catch (error) {
    console.error("Error in verifyRegistration:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

//3. Login Passkey
const StartLoginAuthentication = async (req, res) => {
  try {
    const { email, rpID } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find the user by email using Sequelize
    const user = await db.users.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const userId = user.id;

    // Retrieve the user's passkey record from PasskeyModel
    const passkeyRecord = await db.PasskeyModel.findOne({
      where: { userid: userId },
    });
    if (!passkeyRecord) {
      return res
        .status(400)
        .json({ message: "No registered passkeys found", success: false });
    }

    // Ensure passkeys is an array. If stored as a JSON string, parse it.
    let passkeys = passkeyRecord.passkeys;
    if (!Array.isArray(passkeys)) {
      try {
        passkeys = JSON.parse(passkeys);
      } catch (e) {
        passkeys = [];
      }
    }
    if (passkeys.length === 0) {
      return res.status(400).json({ message: "No registered passkeys found" , success: false});
    }

    const allowCredentials = passkeys.map(({ id, transports }) => ({
      id,
      type: "public-key",
      transports: transports || ["internal", "hybrid"],
    }));

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials,
      timeout: 6000,
    });

    await db.PasskeyModel.update(
      { current_challenge: options.challenge },
      { where: { userid: userId } }
    );
    const serializedOptions = {
      ...options,
      challenge: options.challenge,
    };

    return res.json(serializedOptions);
  } catch (error) {}
};

//4 Verify Login Passk
const VerifyLoginAuthentication = async (req, res) => {
  try {
    const { email, asseResp, origin, rpID, fcmtoken, ip, userAgent } = req.body;

    // Check if the email is provided
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find the user by email using Sequelize
    const user = await db.users.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = user.id;

    // Retrieve the user's passkey record from PasskeyModel
    const passkeyRecord = await db.PasskeyModel.findOne({
      where: { userid: userId },
    });

    if (!passkeyRecord) {
      return res.status(400).json({ message: "No registered passkeys found" });
    }

    // Ensure the passkeys column is stored as JSON
    let passkeys;
    try {
      // Check if passkeys is a string and parse it
      if (typeof passkeyRecord.passkeys === "string") {
        passkeys = JSON.parse(passkeyRecord.passkeys);
      } else {
        passkeys = passkeyRecord.passkeys; // If already in object/array format, use it directly
      }
    } catch (e) {
      return res.status(400).json({ message: "Passkey data is corrupted" });
    }

    // Check if passkeys are in a valid array format
    if (!Array.isArray(passkeys) || passkeys.length === 0) {
      return res.status(400).json({ message: "No registered passkeys found" });
    }

    // Find the correct passkey based on the id from asseResp
    const credentialIdFromClient = asseResp.id; // Ensure this matches what the client sends!
    const passkey = passkeys.find((pk) => pk.id === credentialIdFromClient);

    if (!passkey) {
      return res.status(404).json({ message: "Matching passkey not found" });
    }

    console.log("Passkey ID:", passkey.id);
    console.log("Passkey PublicKey:", passkey.publicKey);

    // Perform verification
    const verification = await verifyAuthenticationResponse({
      response: asseResp,
      expectedChallenge: passkeyRecord.current_challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.id,
        publicKey: base64url.toBuffer(passkey.publicKey),
        counter: passkey.counter || 0,
        transports: passkey.transports || [],
      },
    });

    if (!verification.verified) {
      return res.status(400).json({ message: "Authentication failed" });
    }

    // Find the user with status "1" (active) and include the role details
    const loginUser = await db.users.findOne({
      where: { email, status: "1" },
      include: [
        { model: db.roles, as: "roleDetails", attributes: ["id", "role"] },
      ],
    });

    if (!loginUser) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate the token and update the user's login information
    const currentDate = new Date();
    const dateString = currentDate.toISOString().split("T")[0];
    const timeString = currentDate.toTimeString().split(" ")[0];
    const token = generateToken(loginUser.id, loginUser.roleDetails.role);

    await db.users.update(
      { last_login: new Date(), ip, user_agent: userAgent, token },
      { where: { id: loginUser.id } }
    );

    // Log the successful login attempt
    await db.logs.create({
      user_id: loginUser.id,
      api: `Login User`,
      message: "Success",
      data: JSON.stringify(loginUser),
      ip: ip,
      date: dateString,
      time: timeString,
    });

    // Handle Firebase Cloud Messaging (FCM) token
    if (fcmtoken) {
      let fcmtokenRecord = await db.Notification.findOne({
        where: { userId: loginUser.id },
      });
      if (fcmtokenRecord) {
        fcmtokenRecord.fcm_token = fcmtoken;
        await fcmtokenRecord.save();
      } else {
        fcmtokenRecord = await db.Notification.create({
          userId: loginUser.id,
          fcm_token: fcmtoken,
        });
      }
    }

    // Return the successful response with the token and user data
    return res.json({
      success: true,
      token,
      expiryTime: jwt.decode(token).exp * 1000,
      user: {
        email: loginUser.email,
        id: loginUser.id,
        role: loginUser.roleDetails.role,
      },
      message: "Authentication successful",
      verification,
    });
  } catch (error) {
    console.error("Error in VerifyLoginAuthentication:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

//============================== module export function

module.exports = {
  RegisterPasskey,
  verifyRegistration,
  StartLoginAuthentication,
  VerifyLoginAuthentication,
};
