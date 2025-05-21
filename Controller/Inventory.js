const Sequelize = require("sequelize");
const db = require("../Connection.js");
const { Op } = require("sequelize");
const path = require("path");
//Get All Data from Inventory Table and Forign key from Category Table
const GetInventoryData = async (req, res) => {
  try {
    const {
      search = "",
      category = "",
      start_date,
      end_date,
      order = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || isNaN(limitNum)) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
    }

    const offset = (pageNum - 1) * limitNum;
    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { brand_name: { [Op.like]: `%${search}%` } },
      ];
    }

    if (start_date && end_date) {
      whereClause.purchase_date = {
        [Op.between]: [start_date, end_date],
      };
    }

    if (category) {
      const categoryExists = await db.Inventory_category.findOne({
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
      await db.Inventory.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: db.Inventory_category,
            as: "Category",
            attributes: ["category_name"],
            required: true,
          },
        ],
        attributes: [
          "id",
          "name",
          "description",
          "quantity",
          "product_image",
          "purchase_date",
          "expiry_date",
          "brand_name",
          "asign_item",
        ],
        limit: limitNum,
        offset,
        order: [["id", order]],
      });

    const formattedInventory = inventory.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      product_image: item.product_image,
      brand_name: item.brand_name,
      purchase_date: item.purchase_date,
      expiry_date: item.expiry_date,
      category: item.Category.category_name,
      asign_item: item.asign_item,
    }));

    return res.status(200).json({
      success: true,
      data: formattedInventory,
      current_page: pageNum,
      total_items: totalCount,
      total_pages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching inventory data",
    });
  }
};

//Get all data from inventory_category table
const GetInventoryCategoryData = async (req, res) => {
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

    const { rows, count } = await db.Inventory_category.findAndCountAll({
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

const InsertDataInventory = async (req, res) => {
  const {
    category,
    name,
    description,
    quantity,
    purchase_date,
    expiry_date,
    brand_name,
  } = req.body;

  const logid = req.body.logid;
  const logip = req.body.logip;

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    // Process images
    const product_images = req.files.map((file) => {
      const relativePath = path
        .relative(path.join(__dirname, "../"), file.path)
        .replace(/\\/g, "/");
      return { image: relativePath };
    });

    const imageRecords = await db.Inventory_image.bulkCreate(product_images);
    const imageIds = imageRecords.map((record) => record.id);

    // Ensure purchase_date and expiry_date are handled correctly
    const normalizedPurchaseDate =
      purchase_date && purchase_date.trim() !== "" ? purchase_date : null;
    const normalizedExpiryDate =
      expiry_date && expiry_date.trim() !== "" ? expiry_date : null;

    // Prepare inventory data
    const inventoryData = {
      category,
      name,
      description,
      quantity,
      purchase_date: normalizedPurchaseDate,
      expiry_date: normalizedExpiryDate,
      product_image: JSON.stringify(imageIds),
      brand_name,
    };

    // Create the inventory item
    const inventoryItem = await db.Inventory.create(inventoryData);

    // Log success (if logid and logip are provided)
    if (logid && logip) {
      await db.logs.create({
        user_id: logid,
        api: "Add Inventory",
        message: "Success",
        data: JSON.stringify(inventoryItem),
        ip: logip,
        date: dateString,
        time: timeString,
      });
    }

    res.status(201).json({
      message: "Inventory created successfully",
      data: inventoryItem,
    });
  } catch (error) {
    console.error("Error creating inventory:", error.message);

    // Log failure if logid and logip are provided
    if (logid && logip) {
      await db.logs.create({
        user_id: logid,
        api: "Add Inventory",
        message: "Failed",
        data: JSON.stringify({ error: error.message }),
        ip: logip,
        date: dateString,
        time: timeString,
      });
    }

    res.status(500).json({
      error: "Failed to create inventory",
      details: error.message,
    });
  }
};

//Get Category Data
const GetCategoryDataSelect = async (req, res) => {
  try {
    const categories = await db.Inventory_category.findAll({
      attributes: ["id", "category_name"],
    });

    const categoryArray = categories.map((item) => ({
      id: item.id,
      category_name: item.category_name,
    }));

    return res.status(200).json({
      success: true,
      data: categoryArray,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching categories.",
    });
  }
};

//Add Category Data
const InsertCategory = async (req, res) => {
  const { category_name, logid, logip } = req.body;

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    if (!category_name) {
      // Log missing category name
      await db.logs.create({
        user_id: logid,
        api: "Insert Category",
        message: "Failed",
        data: JSON.stringify({ error: "Category name is required" }),
        ip: logip,
        date: dateString,
        time: timeString,
      });

      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const existingCategory = await db.Inventory_category.findOne({
      where: { category_name: category_name },
    });

    if (existingCategory) {
      // Log duplicate category attempt
      await db.logs.create({
        user_id: logid,
        api: "Insert Category",
        message: "Failed",
        data: JSON.stringify({ error: "Category already exists" }),
        ip: logip,
        date: dateString,
        time: timeString,
      });

      return res.status(400).json({
        success: false,
        message: "Category already exists",
      });
    }

    const newCategory = await db.Inventory_category.create({
      category_name: category_name,
    });

    // Log successful category creation
    await db.logs.create({
      user_id: logid,
      api: "Insert Category",
      message: "Success",
      data: JSON.stringify({
        id: newCategory.id,
        category_name: newCategory.category_name,
      }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: {
        id: newCategory.id,
        category_name: newCategory.category_name,
      },
    });
  } catch (error) {
    console.error("Error inserting category:", error);

    // Log error
    await db.logs.create({
      user_id: logid,
      api: "Insert Category",
      message: "Failed",
      data: JSON.stringify({ error: error.message }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    return res.status(500).json({
      success: false,
      message: "An error occurred while inserting the category",
    });
  }
};

//Get User Data For Inventory Api
const GetUserDataForInventory = async (req, res) => {
  try {
    const response = await db.users.findAll({
      attributes: ["first_name", "last_name", "emp_id", "id"],
    });
    res.status(200).json({
      data: response,
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user data.",
      error: error.message,
    });
  }
};

//Get User Data By Id For Inventory Api
const GetUserDataById = async (req, res) => {
  const { id } = req.params;

  try {
    if (!id) {
      return res.status(400).send({
        message: "User not found. Please provide a valid ID.",
      });
    }

    const response = await db.users.findByPk(id, {
      attributes: ["first_name", "last_name", "image", "emp_id", "id"],
    });

    if (!response) {
      return res.status(404).send({
        message: "User not found with the given ID.",
      });
    }

    return res.status(200).send(response);
  } catch (error) {
    console.error("Error fetching user data by ID:", error);
    return res.status(500).send({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Get the Inventory Data by the category id
const GetCategoryDatabyId = async (req, res) => {
  const { categoryid } = req.params;

  try {
    // Fetch inventories for the specified category ID
    const inventories = await db.Inventory.findAll({
      where: { category: categoryid },
      include: [
        {
          model: db.Inventory_category,
          as: "Category",
          attributes: ["category_name"],
        },
      ],
      attributes: [
        "id",
        "name",
        "description",
        "product_image",
        "quantity",
        "asign_item",
      ],
    });

    // If no inventories found, return an empty array
    if (!inventories || inventories.length === 0) {
      return res.send([]);
    }

    // Filter out inventories that are out of stock or assigned items exceed available quantity
    const validInventories = inventories.filter(
      (inventory) => inventory.quantity > inventory.asign_item
    );

    // If no valid inventories, return an empty array
    if (validInventories.length === 0) {
      return res.send([]);
    }

    // Process valid inventories to fetch images
    const processedInventories = await Promise.all(
      validInventories.map(async (inventory) => {
        const imageIds = Array.isArray(inventory.product_image)
          ? inventory.product_image
          : JSON.parse(inventory.product_image || "[]");

        const images = await db.Inventory_image.findAll({
          where: { id: imageIds },
          attributes: ["image"],
        });

        const imagePaths = images.map((img) => img.image.replace(/\\/g, "/"));

        const imagePath = imagePaths.length > 0 ? imagePaths[0] : null;

        return {
          id: inventory.id,
          name: inventory.name,
          description: inventory.description,
          category: inventory.Category.category_name,
          image: imagePath,
        };
      })
    );

    // Return the processed inventories
    res.send(processedInventories);
  } catch (error) {
    console.error("Error fetching category data:", error);
    res
      .status(500)
      .send({ message: "Internal server error while fetching category data." });
  }
};

//Insert Assign item to the User
// const InsertAssignInventory = async (req, res) => {
//   const { empid, dataid } = req.body;
//   console.log(empid, dataid);

//   try {
//     // Check if the employee already has an assigned inventory record
//     const isExist = await db.AssignInventory.findOne({
//       where: { emp_id: empid }
//     });

//     if (isExist) {
//       // Ensure assign_inventory is an array (flatten if it's a nested array)
//       let inventoryItems = isExist.assign_inventory;

//       // If it's not an array, try to parse it (for case where it's stored as a JSON string)
//       if (!Array.isArray(inventoryItems)) {
//         inventoryItems = JSON.parse(inventoryItems || '[]');
//       }

//       // Flatten the nested arrays if necessary
//       inventoryItems = inventoryItems.flat();

//       // Check if the dataid is already in the inventory array
//       if (inventoryItems.includes(dataid)) {
//         // If the dataid is already assigned to the employee, send a warning message
//         return res.status(400).json({
//           message: `Inventory item ${dataid} is already assigned to this employee.`
//         });
//       }

//       // If the dataid is not assigned, push the new dataid into the array
//       inventoryItems.push(dataid);

//       // Update the AssignInventory table with the new dataid added to the array
//       await isExist.update({
//         assign_inventory: inventoryItems // Store as an array
//       });

//       return res.status(200).json({
//         message: `Inventory item ${dataid} successfully assigned to employee.`
//       });
//     } else {
//       // If no record exists for this employee, create a new record
//       const response = await db.AssignInventory.create({
//         emp_id: empid,
//         assign_inventory:dataid // Initialize with the first item
//       });

//       return res.status(201).json({
//         message: `Inventory item ${dataid} successfully assigned to employee.`,
//         data: response
//       });
//     }
//   } catch (error) {
//     // Handle errors
//     console.error(error);
//     return res.status(500).json({
//       message: 'Something went wrong.',
//       error: error.message
//     });
//   }
// };

const InsertAssignInventory = async (req, res) => {
  const { empid, dataid } = req.body;
  const { logid, logip } = req.body; // 'dataid' is expected to be an array of IDs
  console.log(empid, dataid);
  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];
  try {
    // Check if the employee already has an assigned inventory record
    const isExist = await db.AssignInventory.findOne({
      where: { emp_id: empid },
    });

    if (isExist) {
      // Ensure assign_inventory is an array (flatten if it's a nested array)
      let inventoryItems = isExist.assign_inventory;

      // If it's not an array, try to parse it (for case where it's stored as a JSON string)
      if (!Array.isArray(inventoryItems)) {
        inventoryItems = JSON.parse(inventoryItems || "[]");
      }

      // Flatten the nested arrays if necessary
      inventoryItems = inventoryItems.flat();

      // Check for duplicates: filter out any dataids that already exist
      const existingDataIds = dataid.filter((item) =>
        inventoryItems.includes(item)
      );

      if (existingDataIds.length > 0) {
        // If there are any dataids that already exist, send an error message with those ids
        return res.status(400).json({
          message: `The following inventory items are already assigned to this employee: ${existingDataIds.join(
            ", "
          )}`,
        });
      }

      // Increment the asign_item field in the Inventory table for the new dataids
      for (const id of dataid) {
        const inventoryItem = await db.Inventory.findOne({ where: { id } });

        if (!inventoryItem) {
          // If the inventory item doesn't exist, return an error
          return res.status(404).json({
            message: `Inventory item with ID ${id} not found.`,
          });
        }

        // Increment the asign_item field by 1
        await db.Inventory.increment("asign_item", { where: { id } });
      }

      // Add the new dataids to the inventoryItems array
      inventoryItems = [...inventoryItems, ...dataid];

      // Update the AssignInventory table with the new dataids added to the array
      await isExist.update({
        assign_inventory: inventoryItems,
      });
      await db.logs.create({
        user_id: logid,
        api: "Assign Inventory to user ",
        message: `Success  assigned inventory${empid}.`,
        data: JSON.stringify(inventoryItems),
        ip: logip,
        date: dateString,
        time: timeString,
      });
      return res.status(200).json({
        message: `Inventory items successfully assigned to employee.`,
        data: inventoryItems,
      });
    } else {
      // If no record exists for this employee, create a new record
      // Increment the asign_item field in the Inventory table for the new dataids
      for (const id of dataid) {
        const inventoryItem = await db.Inventory.findOne({ where: { id } });

        if (!inventoryItem) {
          // If the inventory item doesn't exist, return an error
          return res.status(404).json({
            message: `Inventory item with ID ${id} not found.`,
          });
        }

        // Increment the asign_item field by 1
        await db.Inventory.increment("asign_item", { where: { id } });
      }

      // Create the new record in AssignInventory table
      const response = await db.AssignInventory.create({
        emp_id: empid,
        assign_inventory: dataid, // Initialize with the first item
      });

      return res.status(201).json({
        message: `Inventory items successfully assigned to employee.`,
        data: response,
      });
    }
  } catch (error) {
    // Handle errors
    console.error(error);
    return res.status(500).json({
      message: "Something went wrong.",
      error: error.message,
    });
  }
};

const GetAssignInventoryDataUser = async (req, res) => {
  const empid = req.params.userid;

  try {
    // Fetch the assign_inventory field for the given employee ID from the AssignInventory table
    const assignInventoryRecord = await db.AssignInventory.findOne({
      where: { emp_id: empid },
      attributes: ["assign_inventory"],
    });

    // Check if the employee has any assigned inventory
    if (!assignInventoryRecord || !assignInventoryRecord.assign_inventory) {
      return res.status(200).json({
        success: true,
        message: `No assigned inventory found for employee ID: ${empid}`,
        data: [],
      });
    }

    // Ensure it's parsed correctly
    let inventoryIds;
    try {
      inventoryIds =
        typeof assignInventoryRecord.assign_inventory === "string"
          ? JSON.parse(assignInventoryRecord.assign_inventory)
          : assignInventoryRecord.assign_inventory;

      if (!Array.isArray(inventoryIds) || inventoryIds.length === 0) {
        return res.status(200).json({
          success: true,
          message: `No valid assigned inventory found for employee ID: ${empid}`,
          data: [],
        });
      }
    } catch (parseError) {
      console.error("Error parsing inventory IDs:", parseError);
      return res.status(500).json({
        success: false,
        message: "Invalid inventory data format.",
        error: parseError.message,
      });
    }

    // Fetch inventory details for the given IDs using Op.in
    const inventoryData = await db.Inventory.findAll({
      where: {
        id: { [Op.in]: inventoryIds }, // Correct usage of Op.in
      },
    });

    return res.status(200).json({
      success: true,
      message: `Inventory data for employee ID: ${empid}`,
      data: inventoryData.length ? inventoryData : [],
    });
  } catch (error) {
    console.error("Error Fetching Inventory Data:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching inventory data.",
      error: error.message,
    });
  }
};

const DeleteAssignInvtory = async (req, res) => {
  const { empid, id } = req.params;
  const logid = req.query.logid;
  const logip = req.query.logip;

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    // Find the employee's assigned inventory record
    const assignInventoryRecord = await db.AssignInventory.findOne({
      where: { emp_id: empid },
    });

    if (!assignInventoryRecord) {
      await db.logs.create({
        user_id: logid,
        api: "DeleteAssignInventory",
        message: "Failed - Employee not found.",
        data: JSON.stringify({ empid, id }),
        ip: logip,
        date: dateString,
        time: timeString,
      });
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    let inventory = assignInventoryRecord.assign_inventory;

    // Convert inventory to array if it's a string
    if (typeof inventory === "string") {
      try {
        inventory = JSON.parse(inventory);
      } catch (error) {
        inventory = inventory.split(",").map((item) => item.trim());
      }
    }

    // If inventory is not an array, return an error
    if (!Array.isArray(inventory)) {
      await db.logs.create({
        user_id: logid,
        api: "DeleteAssignInventory",
        message: "Failed - assign_inventory is not an array.",
        data: JSON.stringify({ empid, id }),
        ip: logip,
        date: dateString,
        time: timeString,
      });
      return res.status(400).json({
        success: false,
        message: "The assign_inventory field is not in a valid format.",
      });
    }

    // Remove the item from inventory
    const idToDelete = id.toString();
    const updatedInventory = inventory.filter(
      (itemId) => itemId.toString() !== idToDelete
    );

    // If no changes happened, item wasn't found
    if (updatedInventory.length === inventory.length) {
      await db.logs.create({
        user_id: logid,
        api: "DeleteAssignInventory",
        message: `Failed - Item ID ${id} not found in assigned inventory.`,
        data: JSON.stringify({ empid, id }),
        ip: logip,
        date: dateString,
        time: timeString,
      });
      return res.status(404).json({
        success: false,
        message: "Item ID not found in assigned inventory.",
      });
    }

    // Check if the inventory becomes empty
    if (updatedInventory.length === 0) {
      await db.AssignInventory.destroy({ where: { emp_id: empid } });

      await db.logs.create({
        user_id: logid,
        api: "DeleteAssignInventory",
        message: `Success - Employee ${empid} record deleted (empty inventory).`,
        data: JSON.stringify({ empid, id }),
        ip: logip,
        date: dateString,
        time: timeString,
      });

      return res.status(200).json({
        success: true,
        message: `Employee ${empid} record deleted as inventory became empty.`,
      });
    }

    // Update the assigned inventory record
    assignInventoryRecord.assign_inventory = updatedInventory;
    await assignInventoryRecord.save();

    // Decrease the assigned item count in the inventory table
    const inventoryItem = await db.Inventory.findOne({
      where: { id: idToDelete },
    });

    if (!inventoryItem) {
      await db.logs.create({
        user_id: logid,
        api: "DeleteAssignInventory",
        message: `Failed - Inventory item with ID ${id} not found.`,
        data: JSON.stringify({ empid, id }),
        ip: logip,
        date: dateString,
        time: timeString,
      });
      return res.status(404).json({
        success: false,
        message: "Inventory item not found.",
      });
    }

    inventoryItem.asign_item = Math.max(0, inventoryItem.asign_item - 1);
    await inventoryItem.save();

    // Log success
    await db.logs.create({
      user_id: logid,
      api: "DeleteAssignInventory",
      message: "Success - Item removed from assigned inventory.",
      data: JSON.stringify({ empid, id }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    res.status(200).json({
      success: true,
      message:
        "Item removed successfully from assigned inventory, and inventory count updated.",
    });
  } catch (error) {
    console.error("Error in deleting assigned inventory:", error);

    // Log the error
    await db.logs.create({
      user_id: logid,
      api: "DeleteAssignInventory",
      message: `Error - ${error.message}`,
      data: JSON.stringify({ empid, id }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

//const Edit Category

const EditCategory = async (req, res) => {
  const { id } = req.params; // Get category ID from URL parameters
  const { category_name } = req.body; // Get updated category name from request body
  const logid = req.body.logid; // Get user ID from request body
  const logip = req.body.logip; // Get IP address from request body

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    // Find the category by ID
    const category = await db.Inventory_category.findOne({ where: { id } });

    if (!category) {
      // Log category not found
      await db.logs.create({
        user_id: logid,
        api: "EditCategory",
        message: "Failed - Category not found.",
        data: JSON.stringify({ id, category_name }),
        ip: logip,
        date: dateString,
        time: timeString,
      });

      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    // Check if the new category name already exists (excluding the current category)
    const existingCategory = await db.Inventory_category.findOne({
      where: { category_name, id: { [Op.ne]: id } }, // Exclude current category by ID
    });

    if (existingCategory) {
      // Log duplicate category name
      await db.logs.create({
        user_id: logid,
        api: "EditCategory",
        message: "Failed - Category name already exists.",
        data: JSON.stringify({ id, category_name }),
        ip: logip,
        date: dateString,
        time: timeString,
      });

      return res.status(400).json({
        success: false,
        message:
          "Category name already exists. Please choose a different name.",
      });
    }

    // Update the category name
    category.category_name = category_name;

    // Save the updated category
    await category.save();

    // Log success
    await db.logs.create({
      user_id: logid,
      api: "EditCategory",
      message: "Success - Category updated.",
      data: JSON.stringify({ id, category_name }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    // Respond with success
    return res.status(200).json({
      success: true,
      message: "Category updated successfully.",
      data: category, // Return updated category details
    });
  } catch (error) {
    console.error("Error editing category:", error);

    // Log server error
    await db.logs.create({
      user_id: logid,
      api: "EditCategory",
      message: `Error - ${error.message}`,
      data: JSON.stringify({ id, category_name }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    // Respond with server error
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

//Delete Category

const DeleteCategory = async (req, res) => {
  const { id } = req.params; // Get category ID from URL parameters
  const logid = req.query.logid; // Get user ID from request body
  const logip = req.query.logip; // Get IP address from request body

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    // Check if the category exists
    const category = await db.Inventory_category.findOne({ where: { id } });

    if (!category) {
      // Log category not found
      await db.logs.create({
        user_id: logid,
        api: "DeleteCategory",
        message: "Failed - Category not found.",
        data: JSON.stringify({ id }),
        ip: logip,
        date: dateString,
        time: timeString,
      });

      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    // Check if the category is being used by other records
    const isReferenced = await db.Inventory.findOne({
      where: { category: id }, // Assuming `category` is the foreign key in Inventory
    });

    if (isReferenced) {
      // Log category in use
      await db.logs.create({
        user_id: logid,
        api: "DeleteCategory",
        message: "Failed - Category is referenced by other records.",
        data: JSON.stringify({ id }),
        ip: logip,
        date: dateString,
        time: timeString,
      });

      return res.status(400).json({
        success: false,
        message:
          "Category cannot be deleted as it is being referenced by other records.",
      });
    }

    // If not referenced, proceed with deleting the category
    await category.destroy(); // Delete the category from the database

    // Log success
    await db.logs.create({
      user_id: logid,
      api: "DeleteCategory",
      message: "Success - Category deleted.",
      data: JSON.stringify({ id }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting category:", error);

    // Log server error
    await db.logs.create({
      user_id: logid,
      api: "DeleteCategory",
      message: `Error - ${error.message}`,
      data: JSON.stringify({ id }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    // Respond with server error
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

const DeleteInventory = async (req, res) => {
  const { id } = req.params; // Get the ID from the URL parameters
  const logid = req.query.logid; // Get user ID from request body
  const logip = req.query.logip; // Get IP address from request body

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    // Find the inventory item by ID
    const inventoryItem = await db.Inventory.findOne({
      where: { id: id }, // Ensure the condition matches the correct ID
    });

    // Check if the item exists
    if (!inventoryItem) {
      // Log item not found
      await db.logs.create({
        user_id: logid,
        api: "DeleteInventory",
        message: "Failed - Inventory item not found.",
        data: JSON.stringify({ id }),
        ip: logip,
        date: dateString,
        time: timeString,
      });

      return res.status(404).json({
        success: false,
        message: "Inventory item not found.",
      });
    }

    // Check if the item is assigned (asign_item !== 0)
    if (inventoryItem.asign_item !== 0) {
      // Log item is assigned
      await db.logs.create({
        user_id: logid,
        api: "DeleteInventory",
        message: "Failed - Item is assigned and cannot be deleted.",
        data: JSON.stringify({ id }),
        ip: logip,
        date: dateString,
        time: timeString,
      });

      return res.status(400).json({
        success: false,
        message: "This item is assigned and cannot be deleted.",
      });
    }

    // Delete the inventory item only if asign_item is 0
    await db.Inventory.destroy({
      where: {
        id: id,
        asign_item: 0, // Only delete the item if asign_item is 0
      },
    });

    // Log successful deletion
    await db.logs.create({
      user_id: logid,
      api: "DeleteInventory",
      message: "Success - Inventory item deleted.",
      data: JSON.stringify({ id }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    // Return a success response
    res.status(200).json({
      success: true,
      message: "Inventory item deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting inventory item:", error);

    // Log error
    await db.logs.create({
      user_id: logid,
      api: "DeleteInventory",
      message: `Error - ${error.message}`,
      data: JSON.stringify({ id }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    // Respond with server error
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

//1
//Get Inventory data by the id
const GetEditInventorydata = async (req, res) => {
  const { id } = req.params; // Get the 'id' parameter from the URL

  try {
    // Fetch the inventory item and include associated category data
    const inventoryItem = await db.Inventory.findOne({
      where: { id }, // Match the ID
      include: [
        {
          model: db.Inventory_category, // Replace with the actual model name for categories
          as: "Category", // Use the alias defined in associations
          attributes: ["id", "category_name"], // Fetch only specific attributes of the category
        },
      ],
    });

    // If the item is not found, return an error response
    if (!inventoryItem) {
      return res
        .status(404)
        .json({ success: false, message: "Inventory item not found" });
    }

    // Return the inventory data
    return res.json({ success: true, data: inventoryItem });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch inventory data" });
  }
};

//Edit Inventory
const EditInventoryData = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    category,
    purchase_date,
    expiry_date,
    brand_name,
    quantity,
  } = req.body;
  const logid = req.query.logid; // Get user ID from request query
  const logip = req.query.logip; // Get IP address from request query

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  // Handle image files
  let productImages = req.files ? req.files.map((file) => file.path) : []; // Save the image paths

  try {
    // Fetch the existing inventory item
    const inventoryItem = await db.Inventory.findOne({ where: { id } });

    if (!inventoryItem) {
      await db.logs.create({
        user_id: logid,
        api: "EditInventoryData",
        message: "Failed - Inventory item not found.",
        data: JSON.stringify({ id }),
        ip: logip,
        date: dateString,
        time: timeString,
      });

      return res.status(404).send({ message: "Inventory item not found" });
    }

    // Validate and normalize date inputs
    const isValidDate = (date) => {
      if (!date || date.trim() === "" || date === "0000-00-00") return false;
      return !isNaN(new Date(date).getTime());
    };

    const normalizedPurchaseDate = isValidDate(purchase_date)
      ? new Date(purchase_date).toISOString().split("T")[0]
      : null; // Set to null if invalid
    const normalizedExpiryDate = isValidDate(expiry_date)
      ? new Date(expiry_date).toISOString().split("T")[0]
      : null; // Set to null if invalid

    // Update the inventory item with the new data
    await inventoryItem.update({
      name: name || inventoryItem.name,
      description: description || inventoryItem.description,
      category: category || inventoryItem.category,
      purchase_date: normalizedPurchaseDate,
      expiry_date: normalizedExpiryDate,
      brand_name: brand_name || inventoryItem.brand_name,
      quantity: quantity !== undefined ? quantity : inventoryItem.quantity,
      product_images:
        productImages.length > 0 ? productImages : inventoryItem.product_images, // Keep existing images if no new ones are provided
    });

    // Log successful update
    await db.logs.create({
      user_id: logid,
      api: "EditInventoryData",
      message: "Success - Inventory item updated.",
      data: JSON.stringify({
        id,
        name: name || inventoryItem.name,
        description: description || inventoryItem.description,
        category: category || inventoryItem.category,
        purchase_date: normalizedPurchaseDate,
        expiry_date: normalizedExpiryDate,
        brand_name: brand_name || inventoryItem.brand_name,
        quantity: quantity !== undefined ? quantity : inventoryItem.quantity,
        product_images: productImages,
      }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    // Return a success response
    return res
      .status(200)
      .send({ message: "Inventory updated successfully", data: inventoryItem });
  } catch (error) {
    console.error("Error updating inventory:", error);

    // Log error
    await db.logs.create({
      user_id: logid,
      api: "EditInventoryData",
      message: `Error - ${error.message}`,
      data: JSON.stringify({
        id,
        name,
        description,
        category,
        purchase_date,
        expiry_date,
        brand_name,
        quantity,
      }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    // Return a failure response
    return res.status(500).send({ message: "Failed to update inventory" });
  }
};

module.exports = {
  GetInventoryData,
  GetInventoryCategoryData,
  InsertDataInventory,
  GetCategoryDataSelect,
  InsertCategory,
  GetUserDataForInventory,
  GetUserDataById,
  GetCategoryDatabyId,
  InsertAssignInventory,
  GetAssignInventoryDataUser,
  DeleteAssignInvtory,
  EditCategory,
  DeleteCategory,
  DeleteInventory,
  GetEditInventorydata,
  EditInventoryData,
};
