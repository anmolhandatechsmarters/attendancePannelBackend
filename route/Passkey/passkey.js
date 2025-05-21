const express = require("express");
const { RegisterPasskey, verifyRegistration, StartLoginAuthentication, VerifyLoginAuthentication } = require("../../Controller/passkey/Passkey");
const router = express.Router();

router.post("/registerpasskey/:userid",RegisterPasskey);
router.post("/verifyregistration",verifyRegistration)
router.post("/startlogin",StartLoginAuthentication)
router.post("/verifylogin",VerifyLoginAuthentication)
module.exports =router
