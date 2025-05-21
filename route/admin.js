
const express = require('express');
const router = express.Router();
const userController = require('../Controller/adminController');
const multer = require('multer');
const {authentication}=require("../middleware/auth")

router.put('/upload/:id',multer({ storage: userController.upload.storage }).single('image'), userController.uploadImage);


router.get('/images/:id',authentication, userController.getImage);


router.post('/adduser', authentication, userController.addUser);
router.get('/showalluser',authentication,userController.getAllUsers);
router.delete('/deleteuser/:id', authentication, userController.deleteUser);
router.get('/getuser/:id', authentication,userController.getUser);



router.put('/updateUser/:id', authentication,userController.updateUser);
router.get('/getattendance',authentication, userController.getAttendance);

router.put('/savecomment/:id',authentication, userController.saveComment);
router.delete('/deleteattendance/:id',authentication, userController.deleteAttendance);
router.put('/saverecord/:id',authentication, userController.saveRecord);

router.get('/viewuser/:id', authentication,userController.viewUser);
router.get('/viewuserattendence/:id',authentication, userController.viewUserAttendance);

router.get("/logs",authentication, userController.logs)



router.delete('/logdelete/:id',authentication, userController.deletelog)



//deparatment
router.post("/adddepartment",authentication, userController.adddepartment);
router.get("/getdeparmentdetail",authentication, userController.getdepartmentdetail)
router.put("/editdepartment/:id",authentication, userController.editdepartment)

router.delete('/deletedepartment/:id',authentication, userController.deletedepartment)

//designation

router.post("/adddesignation",authentication, userController.adddesignation);
router.get("/getdesignation",authentication, userController.getdesignation)
router.put("/editdesignation/:id",authentication, userController.editdesignation)
router.delete('/deletedesignation/:id',authentication, userController.deletedesignation)

router.get("/getadmindepartment",authentication, userController.getadmindepartment)
router.get("/getadmindesignation",authentication, userController.getadmindesignation)

router.get("/allattendancedownload",authentication, userController.allattendancedownload)

router.get("/approveleavecountnotification",authentication,userController.admincountLeaveNotifications)
router.get("/approveleavenotification",authentication,userController.adminshowleaveDatanotification)
router.get("/approveleavetable",authentication,userController.adminshowAllLeaveuser)
router.get("/employeelistdownlaod",authentication,userController.employeelistdownload)


//dashboard
router.get("/counttodaypresent",authentication,userController.countTodayAttendance)
router.get("/countapproveleave",authentication,userController.countApprovedLeaves)
router.post("/addattendanceadmin",authentication,userController.AddattandanceAdmin)

router.get("/getempid",userController.searchUser);
router.get("/getleavedata/:id",userController.geteditleave)
router.put("/editleave/:id",userController.editleave)



router.put("/editprofileofuser/:id",userController.editProfileofuser)
router.put("/testupdateuser/:id",userController.updateuser)

router.get("/loginasClient/:id",userController.LoginAsClient)

router.get("/country",userController.fetchCountry)
router.get("/city/:id",userController.fetchCity)
router.get("/state/:id",userController.fetchState)
router.get("/getempid",userController.getallEmpid)
router.get("/getphonecode",userController.FetchCountryCode)
router.get("/getphonecode/:id",userController.FetchCountryCodeById)
module.exports = router;
