const express = require("express")
const route = express.Router()
const {authentication} =require("../middleware/auth")
const { hrdata, hrcountemployee, hractiveemployee, hrinactiveemployee, gethremployeeattendance, getemployee, getAttendanceByEmpId } = require("../Controller/HrController")

route.get("/gethrdata/:id", authentication,hrdata);

//dashboard
route.get("/hrcountemployee",authentication, hrcountemployee);

route.get("/hractiveemployee",authentication, hractiveemployee);
route.get("/hrinactiveemployee",authentication, hrinactiveemployee);


//hr employee attendance 
route.get("/showemployeeattendance",authentication, gethremployeeattendance);


//router for user show
route.get("/showemployeeuser",authentication, getemployee)

route.get('/getattendancebyid/:id',authentication,getAttendanceByEmpId)



module.exports = route