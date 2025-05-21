const { Parser } = require("json2csv");
const db = require("../../Connection");
const { Op } = require("sequelize");
const XLSX = require("xlsx");

// Get Grocery Inventory Data For Grocery Table
const GetGroceryInventoryData = async (req, res) => {
  try {
    const {
      search = "",
      category = "",
      start_date,
      end_date,
      page = 1,
      limit = 10,
      sortOrder = "desc",
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
    }

    if (start_date && end_date) {
      whereClause.purchase_date = { [Op.between]: [start_date, end_date] };
    }

    if (category) {
      const categoryExists = await db.StockCategory.findOne({
        where: { id: category },
        attributes: ["id"],
      });

      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      whereClause["$Category.id$"] = category;
    }

    const { rows: inventory, count: totalCount } =
      await db.GroceryInventory.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: db.StockCategory,
            as: "Category",
            attributes: ["category_name"],
            required: true,
          },
        ],
        attributes: [
          "id",
          "name",
          "quantity",
          "unit_price",
          "total_price",
          "purchase_date",
          "expiry_date",
          "used_item",
        ],
        limit: parseInt(limit),
        offset,
        order: [["id", sortOrder]],
      });

    const formattedInventory = inventory.map((item) => ({
      id: item.id,
      name: item.name,
      unit_price: item.unit_price,
      quantity: item.quantity,
      total_price: item.total_price,
      purchase_date: item.purchase_date,
      expiry_date: item.expiry_date,
      category: item.Category.category_name,
      used_item: item.used_item,
    }));

    return res.status(200).json({
      success: true,
      response: formattedInventory,
      total_items: totalCount, // ✅ Added total_items
      total_pages: Math.ceil(totalCount / limit),
      current_page: parseInt(page),
    });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching inventory data",
    });
  }
};


// Post Data in the grocery_inventory table
const InsertData = async (req, res) => {
  const {
    name,
    quantity,
    unitprice,
    totalprice,
    purchasedate,
    expirydate,
    category,
    logid,  // Optional
    logip,  // Optional
  } = req.body;

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    // Validate required fields
    if (!name || !quantity || !unitprice || !category) {
      return res.status(403).json({
        message: "Please enter the required fields.",
      });
    }

    // Normalize purchase_date and expiry_date
    const normalizedPurchaseDate =
      purchasedate && purchasedate.trim() !== "" ? purchasedate : null;
    const normalizedExpiryDate =
      expirydate && expirydate.trim() !== "" ? expirydate : null;

    // Insert data into GroceryInventory
    const response = await db.GroceryInventory.create({
      name,
      quantity,
      unit_price: unitprice,
      total_price: totalprice,
      purchase_date: normalizedPurchaseDate,
      expiry_date: normalizedExpiryDate,
      category,
    });

    // Optional log entry: Only create log if logid and logip are provided
    if (logid && logip) {
      await db.logs.create({
        user_id: logid,  // logid is optional; only added if available
        api: "Add Stock Inventory",
        message: "Success",
        data: JSON.stringify(response),
        ip: logip,  // logip is optional; only added if available
        date: dateString,
        time: timeString,
      });
    }

    res.status(200).json({
      success: true,
      message: "Successfully inserted the data.",
      response: response,
    });
  } catch (error) {
    console.error("Error inserting inventory data:", error);

    // Log failure if the insert operation fails (if logid and logip are provided)
    if (logid && logip) {
      await db.logs.create({
        user_id: logid,  // logid is optional; only added if available
        api: "Add Stock Inventory",
        message: "Failed",
        data: JSON.stringify(error),
        ip: logip,  // logip is optional; only added if available
        date: dateString,
        time: timeString,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error.",
      response: error,
    });
  }
};


// Delete Grocery Invenotory data Api
const DeleteData = async (req, res) => {
  const { id } = req.params;
  const { logid, logip } = req.query;
  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];
  try {
    const response = await db.GroceryInventory.destroy({
      where: { id: id },
    });

    await db.logs.create({
      user_id: logid,
      api: "Succesfylly Delete Stock Inventory",
      message: "Success",
      data: JSON.stringify(response),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    return res.status(200).json({
      status: true,
      response: response,
      message: `Successfully deleted the item with id ${id}`,
    });
  } catch (error) {
    await db.logs.create({
      user_id: logid,
      api: " Delete Stock Inventory",
      message: "Failed",
      data: JSON.stringify(error),
      ip: logip,
      date: dateString,
      time: timeString,
    });
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};
//Download Grocery Inventory data
const DownloadGrocerydata = async (req, res) => {
  const { logid, logip } = req.query;
  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    // Fetch data from the database with category name included
    const result = await db.GroceryInventory.findAll({
      include: {
        model: db.StockCategory,
        as: "Category",
        attributes: ["category_name"], // Fetch only category_name from StockCategory
      },
    });

    if (!result || result.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No grocery data found to download.",
      });
    }

    // Map data and replace category ID with category_name
    const data = result.map((item) => {
      const plainItem = item.get({ plain: true });
      // Replace `category` field with `category_name`
      plainItem.category =
        plainItem.Category?.category_name || "Unknown Category";
      delete plainItem.Category; // Remove Category object if not needed
      return plainItem;
    });

    // Create a new workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Append the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "GroceryData");

    // Generate an Excel file as a buffer
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    });

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="grocery.xlsx"');

    // Log success
    await db.logs.create({
      user_id: logid,
      api: "Download Stock Inventory",
      message: "Success",
      data: JSON.stringify("Success"),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    // Send the Excel file buffer
    return res.send(excelBuffer);
  } catch (error) {
    console.error("Error generating Excel file:", error);

    // Log failure
    await db.logs.create({
      user_id: logid,
      api: "Download Stock Inventory",
      message: "Failed",
      data: JSON.stringify(error.message),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    // Respond with an error message
    return res.status(500).json({
      status: false,
      message: "Failed to generate the Excel file. Please try again.",
    });
  }
};

//Get the Data by the id
const GetDataById = async (req, res) => {
  const { id } = req.params;

  try {
    // Check if `id` is provided
    if (!id) {
      return res.status(400).json({
        status: false,
        message: "Please provide a valid ID.",
      });
    }

    // Fetch data by ID with related stock category
    const response = await db.GroceryInventory.findOne({
      where: { id },
      include: [
        {
          model: db.StockCategory, // Reference the correct related model
          as: "Category", // Use the alias defined in your association
          attributes: ["id", "category_name"], // Select specific fields
        },
      ],
    });

    // Check if the response is empty
    if (!response) {
      return res.status(404).json({
        status: false,
        message: "Data not found.",
      });
    }

    // Return success response
    return res.status(200).json({
      status: true,
      response,
      message: "Successfully found the data.",
    });
  } catch (error) {
    console.error("Error fetching data by ID:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

//Edit Grocery Inventory Data
const EditDataByid = async (req, res) => {
  const { id } = req.params;
  const { logid, logip } = req.query;
  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];
  const {
    name,
    quantity,
    unitprice,
    useditem,
    totalprice,
    purchasedate,
    expirydate,
    category,
  } = req.body;


  console.log("purchase_Date",purchasedate)
  console.log("expiruydate",expirydate)
  try {
    // Fetch the existing record
    const existingRecord = await db.GroceryInventory.findOne({ where: { id } });

    if (!existingRecord) {
      return res.status(404).json({
        status: false,
        message: "No data found with the given ID.",
      });
    }

    // Use previous values if purchase_date or expiry_date is not provided
    const normalizedPurchaseDate =
    purchasedate && purchasedate.trim() !== "" ? purchasedate : null;
  const normalizedExpiryDate =
    expirydate && expirydate.trim() !== "" ? expirydate : null;

    // Update the grocery inventory by ID
    const response = await db.GroceryInventory.update(
      {
        name: name || existingRecord.name,
        quantity: quantity || existingRecord.quantity,
        unit_price: unitprice || existingRecord.unit_price,
        used_item: useditem || existingRecord.used_item,
        total_price: totalprice || existingRecord.total_price,
        purchase_date: normalizedPurchaseDate,
        expiry_date: normalizedExpiryDate,
        category: category || existingRecord.category,
      },
      {
        where: { id },
      }
    );

    // Check if any rows were updated
    if (response[0] === 0) {
      return res.status(404).json({
        status: false,
        message: "No changes were made to the data.",
      });
    }

    // Log success
    await db.logs.create({
      user_id: logid,
      api: "Edit Stock Inventory",
      message: "Success",
      data: JSON.stringify(response),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    return res.status(200).json({
      status: true,
      message: "Successfully updated data.",
    });
  } catch (error) {
    console.error("Error updating data:", error);

    // Log failure
    await db.logs.create({
      user_id: logid,
      api: "Edit Stock Inventory",
      message: "Failed",
      data: JSON.stringify(error),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    return res.status(500).json({
      status: false,
      message: "An error occurred while updating the data.",
    });
  }
};


// Get Stock Category Data
const GetCategoryData = async (req, res) => {
  try {
    const { search, page = 1, limit = 10, setOrder = "desc" } = req.query;

    let whereClause = {};
    const offset = (page - 1) * limit;

    if (search) {
      whereClause[Op.or] = [
        { id: { [Op.like]: `%${search}%` } },
        { category_name: { [Op.like]: `%${search}%` } },
      ];
    }

    const { rows, count } = await db.StockCategory.findAndCountAll({
      where: whereClause,
      attributes: ["id", "category_name"],
      limit: parseInt(limit),
      offset,
      order: [["id", setOrder]],
    });

    const categoryArray = rows.map((item) => ({
      id: item.id,
      category_name: item.category_name,
    }));

    const totalPages = Math.ceil(count / limit);

    return res.status(200).json({
      data: categoryArray,
      pagination: {
        totalItems: count,
        totalPages: totalPages,
        currentPage: parseInt(page),
        pageSize: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching inventory categories:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching inventory category data",
    });
  }
};

const InsertCategoryData = async (req, res) => {
  const { category_name } = req.body;
  const { logip, logid } = req.body; // Default values
  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    // Check if the category name already exists
    const isExist = await db.StockCategory.findOne({
      where: { category_name },
    });

    if (isExist) {
      return res.status(400).json({
        status: false,
        message: "This category name already exists",
      });
    }

    // Insert the new category into the database
    const response = await db.StockCategory.create({
      category_name,
    });

    // Log success
    await db.logs.create({
      user_id: logid,
      api: "Insert Stock Category",
      message: "Success",
      data: JSON.stringify(category_name),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    return res.status(201).json({
      status: true,
      response,
      message: "Successfully created",
    });
  } catch (error) {
    console.error("Error inserting category:", error);

    // Log failure (use fallback data if `response` is undefined)
    try {
      await db.logs.create({
        user_id: logid,
        api: "Insert Stock Category",
        message: "Failed",
        data: JSON.stringify(error.message || "Error occurred"),
        ip: logip,
        date: dateString,
        time: timeString,
      });
    } catch (logError) {
      console.error("Error logging failure:", logError);
    }

    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

const DeleteCategorydata = async (req, res) => {
  const { id } = req.params;
  const { logip, logid } = req.query;
  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    if (!id) {
      return res.status(400).json({
        status: false,
        message: "Please provide a valid ID",
      });
    }

    const category = await db.StockCategory.findOne({ where: { id } });
    if (!category) {
      return res.status(404).json({
        status: false,
        message: "Category not found",
      });
    }

    // Check for foreign key dependencies in Stock Inventory
    const stockItems = await db.GroceryInventory.findAll({
      where: { category: id },
    });
    if (stockItems.length > 0) {
      return res.status(400).json({
        status: false,
        message:
          "Cannot delete the category as it is being used in Stock Inventory.",
      });
    }

    // If no foreign key constraint is found, delete the category
    await db.StockCategory.destroy({ where: { id } });

    // Log the successful deletion
    await db.logs.create({
      user_id: logid,
      api: "Delete Stock Category",
      message: "Success",
      data: JSON.stringify({ deletedId: id }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    return res.status(200).json({
      status: true,
      message: "Successfully deleted category",
    });
  } catch (error) {
    console.error("Error deleting category:", error);

    // Log the error
    try {
      await db.logs.create({
        user_id: logid,
        api: "Delete Stock Category",
        message: "Failed",
        data: JSON.stringify({ error: error.message || "Error occurred" }),
        ip: logip,
        date: dateString,
        time: timeString,
      });
    } catch (logError) {
      console.error("Error logging failure:", logError);
    }

    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

const EditCategoryData = async (req, res) => {
  const { category_name } = req.body;
  const { id } = req.params;
  const { logip, logid } = req.body; // Default log values
  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    // Validate request parameters
    if (!id || !category_name) {
      return res.status(400).json({
        status: false,
        message: "ID and category name are required",
      });
    }

    // Check if a category with the same name exists (excluding the current category)
    const isExist = await db.StockCategory.findOne({
      where: {
        category_name,
        id: { [db.Sequelize.Op.ne]: id }, // Exclude the current category ID
      },
    });

    if (isExist) {
      return res.status(403).json({
        status: false,
        message: "This name already exists",
      });
    }

    // Check if the category to update exists
    const category = await db.StockCategory.findByPk(id);
    if (!category) {
      return res.status(404).json({
        status: false,
        message: "Category not found",
      });
    }

    // Update the category
    const response = await db.StockCategory.update(
      { category_name },
      { where: { id }, returning: true }
    );

    // Log the successful update
    await db.logs.create({
      user_id: logid,
      api: "Edit Stock Category",
      message: "Success",
      data: JSON.stringify({ updatedId: id, updatedName: category_name }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    return res.status(200).json({
      status: true,
      message: "Successfully updated category",
    });
  } catch (error) {
    console.error("Error updating category:", error);

    // Log the error
    try {
      await db.logs.create({
        user_id: logid,
        api: "Edit Stock Category",
        message: "Failed",
        data: JSON.stringify({ error: error.message || "Unknown error" }),
        ip: logip,
        date: dateString,
        time: timeString,
      });
    } catch (logError) {
      console.error("Error logging failure:", logError);
    }

    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

//get Category for select category
const Categorydata = async (req, res) => {
  try {
    const response = await db.StockCategory.findAll();
    return res.status(200).json({
      message: "Succesfully Get the Data",
      response,
      status: true,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

module.exports = {
  GetGroceryInventoryData,
  InsertData,
  DeleteData,
  DownloadGrocerydata,
  GetDataById,
  EditDataByid,
  GetCategoryData,
  InsertCategoryData,
  DeleteCategorydata,
  EditCategoryData,
  Categorydata,
};
