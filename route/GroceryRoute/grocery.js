const express=require("express")
const { GetGroceryInventoryData, InsertData, DeleteData, DownloadGrocerydata, GetDataById, EditDataByid, GetCategoryData, InsertCategoryData, DeleteCategorydata, EditCategoryData, Categorydata } = require("../../Controller/GroceryController/groceryController")
const router =express.Router()
const {authentication}=require("../../middleware/auth")
router.get("/getgroceryinventory",authentication,GetGroceryInventoryData)
router.post('/insertgrocerydata',authentication,InsertData)
router.delete("/deletedata/:id",authentication,DeleteData)
router.get("/downloadgrocery",authentication,DownloadGrocerydata)
router.get("/getdatabyid/:id",authentication,GetDataById)
router.put('/editgrocerydata/:id',authentication,EditDataByid)


router.get('/getstockcategorydata',authentication,GetCategoryData)
router.post('/insertstockcategorydata',authentication,InsertCategoryData)
router.delete('/deletecategorydata/:id',authentication,DeleteCategorydata)
router.put('/editcategorydata/:id',authentication,EditCategoryData)
router.get('/getcategorydataforselect',authentication,Categorydata)


module.exports =router