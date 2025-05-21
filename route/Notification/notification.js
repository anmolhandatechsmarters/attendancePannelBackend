const express = require('express');
const router = express.Router();
const {SubmitNotification, AllowNotification, GetNotification} =require("../../Controller/Notification/Notification")

router.post("/submitNotification",SubmitNotification);

router.put("/allowNotification/:id",AllowNotification);

router.get("/getnotification/:id",GetNotification);
module.exports =router;