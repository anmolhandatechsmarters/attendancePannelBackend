const express = require("express");
const route = express.Router();
const {authentication} =require("../middleware/auth")
const {
  viewoption,
  viewoption2,
  submitmessage,
  viewmessage,
  markMessage,
  Viewtable,
  viewimage,
  DeleteMessage,
  ViewUserList,
  EditMessage,
  fetchMessage,
} = require("../Controller/messageController");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDir = path.join(__dirname, "../messageImage/");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

route.post(
  "/submitmessage",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "bgimage", maxCount: 1 },
  ]),
  submitmessage
);

route.get("/viewoption", viewoption);
route.get("/viewoption2", viewoption2);
route.get("/showmessage/:id", viewmessage);
route.put("/markmessage/:id",markMessage);
route.get("/messagetable", Viewtable);
route.get("/viewmessageimage/:id", viewimage);
route.delete("/deletemessage/:id", DeleteMessage);

route.put(
  "/geteditmessage/:id",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "bgimage", maxCount: 1 },
  ]),
  EditMessage
);

route.get("/fetchmessage/:id", fetchMessage);

module.exports = route;
