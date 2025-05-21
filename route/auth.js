const express = require('express');
const router = express.Router();
const { authentication, authorize } = require('../middleware/auth');
const {
  createUser,
  loginUser,
  logoutUser,
  totalUserCount,
  activeUserCount,
  inactiveUserCount,
  forgotPassword,
  verifyOTP,
  verifyForgetPasswordToken,
  updatePassword, downloadattendanceuser,
  userprofileget,
  useridcheck,checkuserid,
  GraphData,
  graphuser,
  tokendata
} = require('../Controller/userController');


router.post('/submitdata',authentication, createUser);


router.post('/login', loginUser);


router.put('/logout/:id', logoutUser);


router.get('/totaluser',authentication, totalUserCount);
router.get('/allactiveuser',authentication, activeUserCount);
router.get('/allinactiveuser', authentication,inactiveUserCount);


router.post('/forgetpassword', forgotPassword);
router.post('/verifyotp', verifyOTP);
router.get('/verifyforgetpasswordtoken', verifyForgetPasswordToken);
router.post('/updatepassword', updatePassword);




//user download attendance
router.get("/attendancedownlaoduser/:id", authentication,downloadattendanceuser)

router.get("/getuserprofile/:id", authentication,userprofileget)

router.get("/graphdata",GraphData)

router.get("/graphuser",graphuser)

router.get("/gettokendata/:id",tokendata)
module.exports = router;
