const express = require("express");
const router = express.Router();
const { authentication } = require("../middleware/auth");
const {
  findemployeedetail,
  userattendance,
  MarkAttendance,
  UnmarkAttendance,
  Getattendance,
  GetUserAttendanceCount,
  viewGetattendance,
} = require("../Controller/employeeController");

router.get("/employeedetail/:id", authentication, findemployeedetail);

router.get("/userattendance/:id", authentication, userattendance);

router.post("/markattendance/:id", authentication, MarkAttendance);

router.put("/unmarkattendance/:id", authentication, UnmarkAttendance);

router.get("/getattendance/:id", authentication, Getattendance);

router.get("/viewuserattendance/:id", authentication, viewGetattendance);

module.exports = router;
