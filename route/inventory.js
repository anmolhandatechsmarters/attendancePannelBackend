const express =require("express")
const { GetInventoryData, GetInventoryCategoryData, InsertDataInventory,GetCategoryDatabyId, GetCategoryDataSelect, InsertCategory, GetUserDataForInventory, GetUserDataById, InsertAssignInventory, GetAssignInventoryDataUser, DeleteAssignInvtory, EditCategory, DeleteCategory, DeleteInventory, GetEditInventorydata, EditInventoryData } = require("../Controller/Inventory")
const router=express.Router()
const path=require("path")
const multer=require("multer");
const fs = require('fs');
const {authentication} =require("../middleware/auth")
const uploadDir = path.join(__dirname, '../Images/Inventory_Images/');

// Ensure the upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); 
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName); 

    // Store only the relative path in the database
    req.filePath = `Images/Inventory_Images/${uniqueName}`;
  },
});



const upload = multer({ storage });
router.get("/getinventorydata",authentication,GetInventoryData)
router.get("/getcategorydata",authentication,GetInventoryCategoryData)
router.post("/postinventorydata", authentication,upload.array("product_images", 10),InsertDataInventory)
router.get("/getcategorydataselect",authentication,GetCategoryDataSelect)
router.post("/insertcategory",authentication,InsertCategory);
router.get("/getuserdata",authentication,GetUserDataForInventory);
router.get("/getuserdatabyid/:id",authentication,GetUserDataById);
router.get("/getInvetorydatabycategory/:categoryid",authentication,GetCategoryDatabyId);
router.post("/postassigninventory",authentication,InsertAssignInventory);
router.get("/getassigninventory/:userid",authentication,GetAssignInventoryDataUser);
router.delete('/deleteassigninventory/:empid/:id',authentication,DeleteAssignInvtory);
router.put('/editcategory/:id',authentication,EditCategory)
router.delete('/deletecategory/:id',authentication,DeleteCategory);
router.delete('/deleteinventory/:id',authentication,DeleteInventory)
router.get('/geteditInventoryData/:id',authentication,GetEditInventorydata)
router.put('/editInventoryData/:id',upload.array("product_images", 10),authentication,EditInventoryData)
module.exports =router