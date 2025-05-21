const express = require("express");
const route = express.Router();
const { authentication } = require("../middleware/auth");
const {
  applyleave,
  approveleave,
  rejectleave,
  showleaveDatanotification,
  showAllLeaveuser,
  countLeaveNotifications,
  deleteleave,
  showAllLeave,
  showLatestNotificationForId,
  allleavedownlaod,
  AddLeaves,
  hrshowleaveDatanotification,
} = require("../Controller/hremp");
route.post("/applyleave", authentication, applyleave);

route.put("/approveleave/:id", approveleave);

route.put("/rejectleave/:id", rejectleave);

route.get(
  "/showleavedatanotification",
  authentication,
  showleaveDatanotification
);

route.get("/showleaveuser", authentication, showAllLeaveuser);

route.get("/countleavenotification", authentication, countLeaveNotifications);

route.delete("/deleteleave/:id", authentication, deleteleave);

route.get("/showallleave/:id", authentication, showAllLeave);

route.get(
  "/latestnotification/:id",
  authentication,
  showLatestNotificationForId
);

route.get("/downloadleave", authentication, allleavedownlaod);

route.post("/addleave", authentication, AddLeaves);
route.get(
  "/showleavenotificationdata",
  authentication,
  hrshowleaveDatanotification
);

module.exports = route;
