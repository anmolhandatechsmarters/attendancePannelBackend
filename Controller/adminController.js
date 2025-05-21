const path = require("path");
const multer = require("multer");
const Sequelize = require("sequelize");
const db = require("../Connection");
const { Op } = require("sequelize");
const { Parser } = require("json2csv");
const fs = require("fs");
const bcrypt = require("bcrypt");
const moment = require("moment");
const { generateToken, verifyusertoken } = require("../middleware/token");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

const uploadImage = async (req, res) => {
  const { id } = req.params;
  const logid = req.query.logid;
  const logip = req.query.logip;
  const imagePath = req.file?.path;

  if (!id || !imagePath) {
    return res
      .status(400)
      .json({ message: "User ID and image file are required" });
  }

  const currentDate = new Date();

  try {
    const user = await db.users.findOne({ where: { id } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const previousImagePath = user.image;

    const defaultImagePath = "uploads/default.jpeg";

    if (previousImagePath && previousImagePath !== defaultImagePath) {
      fs.unlink(previousImagePath, (err) => {
        if (err) {
          console.error("Error deleting previous image:", err);
        }
      });
    }

    const [affectedRows] = await db.users.update(
      { image: imagePath },
      { where: { id } }
    );

    if (affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    await db.logs.create({
      user_id: logid,
      api: "Upload Image",
      message: "Success",
      data: JSON.stringify({ imagePath }),
      ip: logip,
      date: currentDate.toISOString().split("T")[0],
      time: currentDate.toTimeString().split(" ")[0],
    });

    res.json({ message: "Image updated successfully", imagePath });
  } catch (error) {
    console.error("Error updating image:", error);

    await db.logs.create({
      user_id: logid,
      api: "Upload Image",
      message: "Failed",
      data: JSON.stringify({ error: error.message }),
      ip: logip,
      date: currentDate.toISOString().split("T")[0],
      time: currentDate.toTimeString().split(" ")[0],
    });

    res.status(500).json({ message: "Internal server error" });
  }
};

const getImage = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await db.users.findOne({
      attributes: ["image"],
      where: { id },
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("Error fetching image:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const addUser = async (req, res) => {
  const logip = req.query.logip;
  const {
    email,
    first_name,
    last_name,
    street1,
    street2,
    city,
    state,
    country,
    role,
    status,
    created_by,
    password,
    department,
    designation,
    id,
    aadharcard,
    pancard,
    bankaccount,
    ifsccode,
    accountholder,
    date_of_joining,
    contact_no,
    personal_email,
    middle_name,
  } = req.body;

  // Validate required fields
  if (
    !email ||
    !first_name ||
    !last_name ||
    !street1 ||
    !city ||
    !state ||
    !country ||
    !password ||
    !department ||
    !designation
  ) {
    return res.status(400).json({ message: "Required fields are missing." });
  }

  // Aadhaar card validation: 12 digits only
  if (aadharcard) {
    if (!/^\d{12}$/.test(aadharcard)) {
      return res.status(400).json({
        message:
          "Invalid Aadhaar card number. It must be a 12-digit numeric value.",
      });
    }
  }
  try {
    // Check if email is already in use
    const existingUser = await db.users.findOne({ where: { email } });
    if (existingUser)
      return res.status(400).json({ message: "Email is already in use." });

    // Generate a unique employee ID
    const generateUniqueEmpId = async () => {
      let newEmpIdNumber = 1;
      while (true) {
        const newEmpId = `Emp${newEmpIdNumber}`;
        const existingEmp = await db.users.findOne({
          where: { emp_id: newEmpId },
        });
        if (!existingEmp) return newEmpId;
        newEmpIdNumber++;
      }
    };

    const newEmpId = await generateUniqueEmpId();

    // Map roles to predefined IDs
    const roleMapping = {
      Employee: "3",
      HR: "2",
    };
    const processedRole = roleMapping[role];
    if (!processedRole)
      return res.status(400).json({ message: "Invalid role provided." });

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user record
    const newUser = await db.users.create({
      email,
      emp_id: newEmpId,
      first_name,
      last_name,
      street1,
      street2,
      city,
      state,
      country,
      role: processedRole,
      status,
      created_by,
      password: hashedPassword,
      department_id: department,
      designation_id: designation,
      aadharcard,
      pancard,
      bankaccount,
      ifsc_code: ifsccode,
      account_holder_name: accountholder,
      date_of_joining,
      contact_no,
      personal_email,
      middle_name,
    });

    console.log(newUser);

    // Log success
    const currentDate = new Date();
    await db.logs.create({
      user_id: id,
      api: "Add User",
      message: "Success",
      data: JSON.stringify(newUser),
      ip: logip,
      date: currentDate.toISOString().split("T")[0],
      time: currentDate.toTimeString().split(" ")[0],
    });

    // Respond with success message
    res
      .status(201)
      .json({ message: "User created successfully", user: newUser });
  } catch (error) {
    console.error("Error creating user:", error);

    const currentDate = new Date();
    // Log failure
    await db.logs.create({
      user_id: id,
      api: "Add User",
      message: "Failed",
      data: JSON.stringify({ error: error.message }),
      ip: logip,
      date: currentDate.toISOString().split("T")[0],
      time: currentDate.toTimeString().split(" ")[0],
    });

    // Respond with error message
    res.status(500).json({
      message: "Error occurred while creating user",
      error: error.message,
    });
  }
};

const getAllUsers = async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const search = req.query.search || "";
  const role = req.query.role || "";
  const sortColumn = req.query.sort?.column || "id";
  const sortOrder = req.query.sort?.order || "DESC";
  const toggle = req.query.toggle;
  const offset = (page - 1) * limit;

  const validSortColumns = [
    "id",
    "first_name",
    "last_name",
    "email",
    "emp_id",
    "role",
    "country",
    "state",
    "city",
    "last_login",
    "status",
  ];
  if (!validSortColumns.includes(sortColumn)) {
    return res.status(400).json({ message: "Invalid sort column" });
  }

  try {
    const whereConditions = {
      [Op.and]: [
        {
          [Op.or]: [
            Sequelize.where(
              Sequelize.fn(
                "concat",
                Sequelize.col("first_name"),
                " ",
                Sequelize.col("last_name")
              ),
              { [Op.like]: `%${search}%` }
            ),
            { email: { [Op.like]: `%${search}%` } },
            { emp_id: { [Op.like]: `%${search}%` } },
          ],
        },
        role
          ? Sequelize.where(Sequelize.col("roleDetails.role"), {
              [Op.like]: `%${role}%`,
            })
          : {},
        { emp_id: { [Op.ne]: "admin" } },
        { "$roleDetails.id$": { [Op.notIn]: [1] } },
      ],
    };

    if (toggle === "Active") {
      whereConditions[Op.and].push({ status: "1" });
    }
    if (toggle === "Inactive") {
      whereConditions[Op.and].push({ status: "0" });
    }

    const users = await db.users.findAll({
      attributes: [
        "id",
        "email",
        "emp_id",
        "first_name",
        "last_name",
        "country",
        "state",
        "city",
        "street1",
        "street2",
        "last_login",
        "status",
        "middle_name",
        [Sequelize.col("roleDetails.role"), "role"],
      ],
      include: [
        {
          model: db.roles,
          as: "roleDetails",
          attributes: ["role"],
        },
        {
          model: db.cities,
          as: "cityDetails",
          attributes: ["name"],
        },
        {
          model: db.states,
          as: "stateDetails",
          attributes: ["name"],
        },
        {
          model: db.countries,
          as: "countryDetails",
          attributes: ["name"],
        },
      ],
      where: whereConditions,
      order: [[sortColumn, sortOrder]],
      limit,
      offset,
    });

    const total = await db.users.count({
      include: [
        {
          model: db.roles,
          as: "roleDetails",
          attributes: [],
        },
      ],
      where: whereConditions,
    });

    res.json({ users, total });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error fetching users" });
  }
};

const getUser = async (req, res) => {
  const id = parseInt(req.params.id, 10); // Ensure `id` is an integer

  try {
    const user = await db.users.findOne({
      where: { id },
      include: [
        {
          model: db.roles,
          as: "roleDetails",
          attributes: ["role"],
        },
        {
          model: db.countries,
          as: "countryDetails",
          attributes: ["id", "name"],
        },
        {
          model: db.states,
          as: "stateDetails",
          attributes: ["id", "name"],
        },
        {
          model: db.cities,
          as: "cityDetails",
          attributes: ["id", "name"],
        },
      ],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const editProfileofuser = async (req, res) => {
  const { id } = req.params;
  const {
    firstName,
    lastName,
    password,
    country,
    state,
    city,
    street1,
    street2,
  } = req.body;

  if (!id) {
    return res.status(400).json({ message: "User ID is required." });
  }

  try {
    const currentUser = await db.users.findOne({ where: { id } });
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const updateFields = {};

    if (firstName) updateFields.first_name = firstName;
    if (lastName) updateFields.last_name = lastName;
    if (country) updateFields.country = country;
    if (state) updateFields.state = state;
    if (city) updateFields.city = city;
    if (street1) updateFields.street1 = street1;
    if (street2) updateFields.street2 = street2;

    // 🔐 Password update logic
    if (password && password !== "#####") {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.password = hashedPassword;
    }

    const [affectedRows] = await db.users.update(updateFields, {
      where: { id },
    });

    res
      .status(200)
      .json({ message: "User updated successfully.", affectedRows });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const updateuser = async (req, res) => {
  const { id } = req.params;
  const logid = req.query.logid;
  const logip = req.query.logip;

  const {
    first_name,
    last_name,
    email,
    emp_id,
    role,
    country,
    state,
    city,
    street1,
    street2,
    department,
    designation,
    status,
    bankaccount,
    ifsccode,
    accountholder,
    adhaarcard,
    pancard,
    date_of_joining,
    contact_no,
    personal_email,
    password,
    empid,
    middle_name,
  } = req.body;

  if (!id) {
    return res.status(400).json({ message: "User ID is required." });
  }

  let currentUser;
  try {
    currentUser = await db.users.findOne({ where: { id } });
    if (!currentUser)
      return res.status(404).json({ message: "User not found" });
  } catch (error) {
    console.error("Error fetching current user data:", error);
    return res.status(500).json({ message: "Internal server error" });
  }

  const updateFields = {};
  if (first_name) updateFields.first_name = first_name;
  if (last_name) updateFields.last_name = last_name;
  if (status) updateFields.status = status;
  if (email) updateFields.email = email;
  if (emp_id) updateFields.emp_id = emp_id;
  if (adhaarcard) updateFields.aadharcard = adhaarcard;
  if (bankaccount) updateFields.bankaccount = bankaccount;
  if (pancard) updateFields.pancard = pancard;
  if (ifsccode) updateFields.ifsc_code = ifsccode;
  if (accountholder) updateFields.account_holder_name = accountholder;
  if (date_of_joining) updateFields.date_of_joining = date_of_joining;
  if (contact_no) updateFields.contact_no = contact_no;
  if (personal_email) updateFields.personal_email = personal_email;
  if (empid) updateFields.emp_id = empid;
  if (middle_name) updateFields.middle_name = middle_name;
  // Only hash and update password if it's provided and not "#####"
  if (password && password !== "#####") {
    const hashedPassword = await bcrypt.hash(password, 10);
    updateFields.password = hashedPassword;
  }

  if (role) {
    switch (role) {
      case "Employee":
        updateFields.role = 3;
        break;
      case "HR":
        updateFields.role = 2;
        break;
      default:
        return res.status(400).json({ message: "Invalid role provided." });
    }
  }

  if (country) updateFields.country = country;
  if (state) updateFields.state = state;
  if (city) updateFields.city = city;
  if (street1) updateFields.street1 = street1;
  if (street2) updateFields.street2 = street2;
  if (department) updateFields.department = department;
  if (designation) updateFields.designation = designation;

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toLocaleTimeString().split(" ")[0];

  try {
    const [affectedRows] = await db.users.update(updateFields, {
      where: { id },
    });

    // Fetch the updated user data
    const updatedUser = await db.users.findOne({
      where: { id },
      attributes: { exclude: ["password"] }, // Exclude sensitive data
    });
    return res.json({
      message: "User updated successfully",
      affectedRows,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update error:", error);
    return res.status(500).json({ message: "Failed to update user" });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const logid = req.query.logid;
  const logip = req.query.logip;
  const {
    first_name,
    last_name,
    email,
    emp_id,
    role,
    country,
    state,
    city,
    street1,
    street2,
    department,
    designation,
    status,
    bankaccount,
    ifsccode,
    accountholder,
    adhaarcard,
    pancard,
    date_of_joining,
    personal_email,
    contact_no,
  } = req.body;

  if (!id) {
    return res.status(400).json({ message: "User ID is required." });
  }

  let currentUser;
  try {
    currentUser = await db.users.findOne({ where: { id } });
    if (!currentUser)
      return res.status(404).json({ message: "User not found" });
  } catch (error) {
    console.error("Error fetching current user data:", error);
    return res.status(500).json({ message: "Internal server error" });
  }

  const updateFields = {};

  // Validate and assign first_name, last_name, etc.
  if (first_name) updateFields.first_name = first_name;
  if (last_name) updateFields.last_name = last_name;
  if (status) updateFields.status = status;
  if (email) updateFields.email = email;
  if (emp_id) updateFields.emp_id = emp_id;
  if (date_of_joining) updateFields.date_of_joining = date_of_joining;
  if (contact_no) updateFields.contact_no = contact_no;
  if (personal_email) updateFields.personal_email = personal_email;

  // Aadhaar card validation: If provided, it should be a 12-digit number
  if (adhaarcard) {
    if (adhaarcard === "") {
      updateFields.aadharcard = null; // Set to null if empty
    } else if (!/^\d{12}$/.test(adhaarcard)) {
      return res.status(400).json({
        message:
          "Invalid Aadhaar card number. It must be a 12-digit numeric value.",
      });
    } else {
      updateFields.aadharcard = adhaarcard;
    }
  }

  // PAN card validation: If provided, it should follow the format ABCDE1234F
  if (pancard) {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(pancard)) {
      return res.status(400).json({
        message:
          "Invalid PAN card format. It should be in the format: ABCDE1234F.",
      });
    }
    updateFields.pancard = pancard;
  }

  // Bank account validation: If provided, it should be numeric
  if (bankaccount) {
    const bankAccountRegex = /^\d+$/;
    if (!bankAccountRegex.test(bankaccount)) {
      return res
        .status(400)
        .json({ message: "Bank account must be a numeric value." });
    }
    updateFields.bankaccount = bankaccount;
  }

  // IFSC code validation: If provided, it should follow the format ABCD0123456
  if (ifsccode) {
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifsccode)) {
      return res
        .status(400)
        .json({ message: "IFSC code must be in the format: ABCD0123456." });
    }
    updateFields.ifsc_code = ifsccode;
  }

  // Account holder name validation: If provided, it should be a string
  if (accountholder) {
    updateFields.account_holder_name = accountholder;
  }

  // Role validation
  if (role) {
    switch (role) {
      case "Employee":
        updateFields.role = 3;
        break;
      case "HR":
        updateFields.role = 2;
        break;
      default:
        return res.status(400).json({ message: "Invalid role provided." });
    }
  }

  // Other fields
  if (country) updateFields.country = country;
  if (state) updateFields.state = state;
  if (city) updateFields.city = city;
  if (street1) updateFields.street1 = street1;
  if (street2) updateFields.street2 = street2;
  if (department) updateFields.department = department;
  if (designation) updateFields.designation = designation;

  if (Object.keys(updateFields).length === 0) {
    return res.status(400).json({ message: "No fields to update." });
  }

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toLocaleTimeString().split(" ")[0];

  try {
    const [affectedRows] = await db.users.update(updateFields, {
      where: { id },
    });

    if (affectedRows === 0)
      return res.status(404).json({ message: "User not found" });

    await db.logs.create({
      user_id: logid,
      api: `Update User/${id}`,
      message: "Success",
      data: JSON.stringify({
        previous: currentUser,
        updated: { ...currentUser, ...updateFields },
      }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    res.status(200).json({ message: "User updated successfully." });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Failed to update user." });
    await db.logs.create({
      user_id: logid,
      api: `Update User/${id}`,
      message: "Failed",
      data: JSON.stringify({
        previous: currentUser,
        attemptedUpdate: updateFields,
      }),
      ip: logip,
      date: dateString,
      time: timeString,
    });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  const logid = req.query.logid;
  const logip = req.query.logip;

  if (!id) return res.status(400).json({ message: "Id is required" });
  if (!logid) return res.status(400).json({ message: "Log ID is required" });

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    const currentUser = await db.users.findOne({ where: { id } });

    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Check if the user has assigned inventory
    const assignedInventory = await db.AssignInventory.findOne({
      where: { emp_id: currentUser.emp_id },
    });

    if (assignedInventory) {
      return res.status(400).json({
        message:
          "User has assigned inventory. Collect the inventory before deleting the user.",
      });
    }

    // ✅ Proceed with deletion if no inventory is assigned
    await Promise.all([
      db.applyleave.destroy({ where: { user_id: id } }),
      db.attendances.destroy({ where: { user_id: id } }),
      db.users.destroy({ where: { id } }),
    ]);

    // ✅ Log the deletion
    await db.logs.create({
      user_id: logid,
      api: `Delete User/${id}`,
      message: "Success",
      data: JSON.stringify(currentUser),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error occurred while deleting user:", error);

    // ✅ Log the failure
    await db.logs.create({
      user_id: logid,
      api: `Delete User/${id}`,
      message: "Failed",
      data: JSON.stringify({ error: error.message, stack: error.stack }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    res
      .status(500)
      .json({ message: "Error occurred while deleting user", error });
  }
};

const getAttendance = async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const search = req.query.search || "";
  const empIdParam = req.query.empid;
  const sortColumn = req.query.sort?.column || "id";
  const sortOrder = req.query.sort?.order || "asc";
  const month = parseInt(req.query.month, 10) || null;
  const year = parseInt(req.query.year, 10) || null;
  const startDate = req.query.startDate || null;
  const endDate = req.query.endDate || null;
  const status = req.query.status || null;
  const offset = (page - 1) * limit;

  const validSortColumns = ["id", "in_time", "out_time", "date"];
  if (!validSortColumns.includes(sortColumn)) {
    return res.status(400).json({ message: "Invalid sort column" });
  }
  if (!["asc", "desc"].includes(sortOrder)) {
    return res.status(400).json({ message: "Invalid sort order" });
  }

  try {
    let userIds = [];

    if (empIdParam) {
      const users = await db.users.findAll({
        attributes: ["id"],
        where: { emp_id: empIdParam },
      });

      userIds = users.map((user) => user.id);
    }

    const attendanceRecords = await db.attendances.findAll({
      include: [
        {
          model: db.users,
          as: "userDetails",
          attributes: ["first_name", "last_name", "emp_id", "role"],
          required: true,
        },
      ],
      attributes: [
        "id",
        "user_id",
        "in_time",
        "out_time",
        "date",
        "comment",
        "status",
        [
          Sequelize.literal(
            `CONCAT(userDetails.first_name, ' ', 
                    IFNULL(CONCAT(userDetails.middle_name, ' '), ''), 
                    userDetails.last_name, 
                    ' (', userDetails.emp_id, ')')`
          ),
          "fullname",
        ],
      ],
      where: {
        [Op.and]: [
          userIds.length > 0 ? { user_id: userIds } : {},
          { user_id: { [Op.ne]: 1 } },
          search
            ? {
                [Op.or]: [
                  { "$userDetails.first_name$": { [Op.like]: `%${search}%` } },
                  { "$userDetails.last_name$": { [Op.like]: `%${search}%` } },
                  { "$userDetails.emp_id$": { [Op.like]: `%${search}%` } },
                  { "$userDetails.email$": { [Op.like]: `%${search}%` } },
                ],
              }
            : {},
          month
            ? Sequelize.where(
                Sequelize.fn("MONTH", Sequelize.col("date")),
                month
              )
            : {},
          year
            ? Sequelize.where(Sequelize.fn("YEAR", Sequelize.col("date")), year)
            : {},
          startDate ? { date: { [Op.gte]: startDate } } : {},
          endDate ? { date: { [Op.lte]: endDate } } : {},
          status ? { status } : {},
        ],
      },
      order: [[sortColumn, sortOrder]],
      limit,
      offset,
    });

    const filteredRecords = attendanceRecords.filter((record) => {
      const userRole = record.userDetails.role;
      const recordUserId = record.user_id;

      return !(userRole === "Admin" && recordUserId === "1");
    });

    const total = await db.attendances.count({
      include: [
        {
          model: db.users,
          as: "userDetails",
          attributes: [],
        },
      ],
      where: {
        [Op.and]: [
          userIds.length > 0 ? { user_id: userIds } : {},
          { user_id: { [Op.ne]: 1 } },
          search
            ? {
                [Op.or]: [
                  { "$userDetails.first_name$": { [Op.like]: `%${search}%` } },
                  { "$userDetails.last_name$": { [Op.like]: `%${search}%` } },
                  { "$userDetails.emp_id$": { [Op.like]: `%${search}%` } },
                ],
              }
            : {},
          month
            ? Sequelize.where(
                Sequelize.fn("MONTH", Sequelize.col("date")),
                month
              )
            : {},
          year
            ? Sequelize.where(Sequelize.fn("YEAR", Sequelize.col("date")), year)
            : {},
          startDate ? { date: { [Op.gte]: startDate } } : {},
          endDate ? { date: { [Op.lte]: endDate } } : {},
          status ? { status } : {},
        ],
      },
    });

    res.json({
      success: true,
      attendance: filteredRecords,
      total,
    });
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const saveComment = async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;
  const logid = req.query.logid;
  const logip = req.query.logip;

  if (!comment) {
    return res
      .status(400)
      .json({ success: false, message: "Comment is required" });
  }

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    const attendanceRecord = await db.attendances.findOne({ where: { id } });

    if (!attendanceRecord) {
      return res
        .status(404)
        .json({ success: false, message: "Attendance record not found" });
    }

    const [updated] = await db.attendances.update(
      { comment },
      { where: { id } }
    );

    if (updated) {
      res.json({ success: true, message: "Comment added successfully" });
    }

    await db.logs.create({
      user_id: logid,
      api: `Add Comment/${id}`,
      message: "Success",
      data: JSON.stringify({
        previousComment: attendanceRecord.comment,
        newComment: comment,
      }),
      ip: logip,
      date: dateString,
      time: timeString,
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({ success: false, message: "Error updating comment" });
    await db.logs.create({
      user_id: logid,
      api: `Add Comment/${id}`,
      message: "Failed",
      data: JSON.stringify({ error: error.message }),
      ip: logip,
      date: dateString,
      time: timeString,
    });
  }
};

const deleteAttendance = async (req, res) => {
  const { id } = req.params;
  const logid = req.query.logid;
  const logip = req.query.logip;

  if (!id) {
    return res
      .status(400)
      .json({ success: false, message: "Attendance ID is required" });
  }

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    const deleted = await db.attendances.destroy({ where: { id } });

    if (deleted) {
      res.json({
        success: true,
        message: "Attendance record deleted successfully",
      });

      await db.logs.create({
        user_id: logid,
        api: `Delete Attendance/${id}`,
        message: "Success",
        data: JSON.stringify({ attendanceId: id }),
        ip: logip,
        date: dateString,
        time: timeString,
      });
    } else {
      res
        .status(404)
        .json({ success: false, message: "Attendance record not found" });
    }
  } catch (error) {
    console.error("Error deleting attendance record:", error);
    res
      .status(500)
      .json({ success: false, message: "Error deleting attendance record" });

    await db.logs.create({
      user_id: logid,
      api: `Delete Attendance/${id}`,
      message: "Failed",
      data: JSON.stringify({ error: error.message }),
      ip: logip,
      date: dateString,
      time: timeString,
    });
  }
};

const saveRecord = async (req, res) => {
  const { id } = req.params; // Attendance record ID
  const { in_time, out_time, date, status, comment } = req.body;
  const logid = req.query.logid; // User ID attempting to edit
  const logip = req.query.logip;

  if (!logid) {
    return res.status(400).json({
      success: false,
      message: "Missing logid in request.",
    });
  }

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    // Fetch the attendance record
    const attendanceRecord = await db.attendances.findOne({
      where: { id },
      attributes: ["user_id"],
    });

    if (!attendanceRecord) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    // Prevent self-editing (if HR cannot edit their own record)
    if (parseInt(attendanceRecord.user_id) === parseInt(logid)) {
      return res.status(403).json({
        success: false,
        message: "HR attendance is only editable by the Admin.",
      });
    }

    // Fetch roles of the logged-in user (`logid`) and target user (`user_id`)
    const [logUser, targetUser] = await Promise.all([
      db.users.findOne({ where: { id: logid }, attributes: ["role"] }),
      db.users.findOne({
        where: { id: attendanceRecord.user_id },
        attributes: ["role"],
      }),
    ]);

    if (!logUser || !targetUser) {
      return res.status(404).json({
        success: false,
        message: "User roles not found.",
      });
    }

    // Ensure both users' roles are correctly compared (roles stored as integers or strings)
    const logUserRole = parseInt(logUser.role);
    const targetUserRole = parseInt(targetUser.role);

    // Prevent edits if both have role "2"
    if (logUserRole === 2 && targetUserRole === 2) {
      return res.status(403).json({
        success: false,
        message:
          "HR cannot edit attendance for their own role. Please contact the admin.",
      });
    }

    // If status is 'Leave', set `in_time` and `out_time` to NULL
    const updatedInTime = status === "Leave" ? null : in_time;
    const updatedOutTime = status === "Leave" ? null : out_time;

    // Update the attendance record
    const [updated] = await db.attendances.update(
      {
        in_time: updatedInTime,
        out_time: updatedOutTime,
        date,
        status,
        comment,
      },
      { where: { id } }
    );

    if (updated) {
      res.json({
        success: true,
        message: "Attendance record updated successfully",
      });

      // Log the success
      await db.logs.create({
        user_id: logid,
        api: `Edit Attendance/${id}`,
        message: "Success",
        data: JSON.stringify({
          previous: attendanceRecord,
          new: {
            in_time: updatedInTime,
            out_time: updatedOutTime,
            date,
            status,
            comment,
          },
        }),
        ip: logip,
        date: dateString,
        time: timeString,
      });
    } else {
      res
        .status(404)
        .json({ success: false, message: "Attendance record not updated" });
    }
  } catch (error) {
    console.error("Error updating attendance record:", error);
    res
      .status(500)
      .json({ success: false, message: "Error updating attendance record" });

    // Log the failure
    await db.logs.create({
      user_id: logid,
      api: `Edit Attendance/${id}`,
      message: "Failed",
      data: JSON.stringify({ error: error.message }),
      ip: logip,
      date: dateString,
      time: timeString,
    });
  }
};

const viewUser = async (req, res) => {
  const { id } = req.params;
  const { Getrole } = req.query;
  try {
    if (Getrole === "HR" && id === "1") {
      return res.status(403).json({
        success: false,
        message: "Access denied for this user.",
      });
    }

    const user = await db.users.findOne({
      where: { id },
      include: [
        {
          model: db.roles,
          as: "roleDetails",
          attributes: ["id", "role"],
        },
        {
          model: db.countries,
          as: "countryDetails",
          attributes: ["id", "name"],
        },
        {
          model: db.states,
          as: "stateDetails",
          attributes: ["id", "name"],
        },
        {
          model: db.cities,
          as: "cityDetails",
          attributes: ["id", "name"],
        },
        {
          model: db.attendances,
          as: "attendances",
          attributes: [
            "id",
            "user_id",
            "in_time",
            "out_time",
            "date",
            "status",
          ],
        },
      ],
    });

    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error) {
    console.error("Error retrieving user:", error);
    res.status(500).json({ success: false, message: "Error retrieving user" });
  }
};

const viewUserAttendance = async (req, res) => {
  const { id } = req.params;

  try {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6); // Include today

    const attendanceRecords = await db.attendances.findAll({
      where: {
        user_id: id,
        date: {
          [db.Sequelize.Op.between]: [sevenDaysAgo, today],
        },
      },
      order: [["date", "DESC"]],
    });

    res.json(attendanceRecords);
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const logs = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    sortBy = "id",
    sortOrder = "ASC",
    startDate,
    endDate,
    getrole,
  } = req.query;
  const offset = (page - 1) * limit;
  try {
    const whereClause = {
      [Op.or]: [
        { user_id: { [Op.like]: `%${search}%` } },
        { api: { [Op.like]: `%${search}%` } },
      ],
    };
    if (startDate && endDate) {
      whereClause.date = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const { count, rows } = await db.logs.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
    });

    res.json({
      logs: rows,
      total: count,
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    res.status(500).json({ error: "An error occurred while fetching logs" });
  }
};

const deletelog = async (req, res) => {
  const id = req.params.id;
  try {
    const result = await db.logs.destroy({
      where: { id: id },
    });
    res.json(result);
  } catch (error) {
    res.json(error);
  }
};

const adddepartment = async (req, res) => {
  const departmentname = req.body.name;
  const logid = req.body.logid;
  const logip = req.body.logip;

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    const existingDepartment = await db.departments.findOne({
      where: { department_name: departmentname },
    });

    if (existingDepartment) {
      return res.status(409).json({ message: "Department already exists" });
    }

    const result = await db.departments.create({
      department_name: departmentname,
    });

    await db.logs.create({
      user_id: logid,
      api: `Add Department`,
      message: "Success",
      data: JSON.stringify({ new_department: result }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });

    await db.logs.create({
      user_id: logid,
      api: `Add Department`,
      message: "Failed",
      data: JSON.stringify({ error: error.message }),
      ip: logip,
      date: dateString,
      time: timeString,
    });
  }
};

const getdepartmentdetail = async (req, res) => {
  const { page = 1, limit = 10, search = "", sortOrder = "desc" } = req.query;

  const offset = (page - 1) * limit;

  try {
    const { count, rows } = await db.departments.findAndCountAll({
      where: {
        department_name: {
          [Op.like]: `%${search}%`,
        },
      },
      order: [["id", sortOrder]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      total: count,
      departments: rows,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Error fetching department details:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const editdepartment = async (req, res) => {
  const { id } = req.params;
  const department_name = req.body.name;
  const logid = req.body.logid;
  const logip = req.body.logip;

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    const existingDepartment = await db.departments.findOne({
      where: {
        department_name: department_name,
        id: { [db.Sequelize.Op.ne]: id },
      },
    });

    if (existingDepartment) {
      return res
        .status(400)
        .json({ success: false, message: "Department name already exists" });
    }

    const currentDepartment = await db.departments.findOne({ where: { id } });
    if (!currentDepartment) {
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });
    }

    const [updated] = await db.departments.update(
      { department_name },
      { where: { id } }
    );

    if (updated) {
      await db.logs.create({
        user_id: logid,
        api: `Edit Department/${id}`,
        message: "Success",
        data: JSON.stringify({
          old_department: currentDepartment.department_name,
          new_department: department_name,
        }),
        ip: logip,
        date: dateString,
        time: timeString,
      });

      return res.json({
        success: true,
        message: "Department updated successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });
    }
  } catch (error) {
    console.error("Error updating department:", error);
    await db.logs.create({
      user_id: logid,
      api: `Edit Department/${id}`,
      message: "Failed",
      data: JSON.stringify({ error: error.message }),
      ip: logip,
      date: dateString,
      time: timeString,
    });
    return res
      .status(500)
      .json({ success: false, message: "Error updating department" });
  }
};

const deletedepartment = async (req, res) => {
  const id = req.params.id;
  const logid = req.query.logid;
  const logip = req.query.logip;

  try {
    const currentDepartment = await db.departments.findOne({ where: { id } });
    if (!currentDepartment) {
      return res.status(404).json({ message: "Department not found" });
    }

    const result = await db.departments.destroy({
      where: { id },
    });

    const currentDate = new Date();
    const dateString = currentDate.toISOString().split("T")[0];
    const timeString = currentDate.toTimeString().split(" ")[0];

    await db.logs.create({
      user_id: logid,
      api: `Delete Department/${id}`,
      message: result > 0 ? "Success" : "Failed",
      data: JSON.stringify({
        department_id: id,
        department_name: currentDepartment.department_name,
      }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    if (result === 0) {
      return res.status(404).json({ message: "Department not found" });
    }

    res.status(200).json({ message: "Department deleted successfully" });
  } catch (error) {
    console.error("Error deleting department:", error);

    if (error.name === "SequelizeForeignKeyConstraintError") {
      return res.status(400).json({
        message:
          "This department cannot be deleted because it is associated with other records.",
      });
    }

    const currentDate = new Date();
    const dateString = currentDate.toISOString().split("T")[0];
    const timeString = currentDate.toTimeString().split(" ")[0];

    await db.logs.create({
      user_id: logid,
      api: `Delete Department/${id}`,
      message: "Failed",
      data: JSON.stringify({ error: error.message }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    res.status(500).json({ message: "Server error" });
  }
};

const adddesignation = async (req, res) => {
  const designationName = req.body.name;
  const logid = req.body.logid;
  const logip = req.body.logip;

  try {
    const existingDesignation = await db.designations.findOne({
      where: { designation_name: designationName },
    });

    if (existingDesignation) {
      return res.status(409).json({ message: "Designation already exists" });
    }

    const result = await db.designations.create({
      designation_name: designationName,
    });

    res.status(201).json(result);

    const currentDate = new Date();
    const dateString = currentDate.toISOString().split("T")[0];
    const timeString = currentDate.toTimeString().split(" ")[0];

    await db.logs.create({
      user_id: logid,
      api: `Add Designation`,
      message: "Success",
      data: JSON.stringify({ designation_name: designationName }),
      ip: logip,
      date: dateString,
      time: timeString,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });

    const currentDate = new Date();
    const dateString = currentDate.toISOString().split("T")[0];
    const timeString = currentDate.toTimeString().split(" ")[0];

    await db.logs.create({
      user_id: logid,
      api: `Add Designation`,
      message: "Failed",
      data: JSON.stringify({ error: error.message }),
      ip: logip,
      date: dateString,
      time: timeString,
    });
  }
};

const getdesignation = async (req, res) => {
  const { page = 1, limit = 10, search = "", sortOrder = "desc" } = req.query;

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(Math.max(1, parseInt(limit, 10) || 10), 100);
  const offset = (parsedPage - 1) * parsedLimit;

  try {
    const { count, rows } = await db.designations.findAndCountAll({
      where: {
        designation_name: {
          [Op.like]: `%${search.replace(/[%_]/g, "\\$&")}%`,
        },
      },
      order: [["id", sortOrder]],
      limit: parsedLimit,
      offset: offset,
    });

    res.json({
      total: count,
      designations: rows,
      totalPages: Math.ceil(count / parsedLimit),
      currentPage: parsedPage,
    });
  } catch (error) {
    console.error("Error fetching designation details:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const editdesignation = async (req, res) => {
  const { id } = req.params;
  const designation_name = req.body.name;
  const logid = req.body.logid;
  const logip = req.body.logip;

  try {
    const existingDesignation = await db.designations.findOne({
      where: {
        designation_name: designation_name,
        id: { [db.Sequelize.Op.ne]: id },
      },
    });

    if (existingDesignation) {
      return res
        .status(400)
        .json({ success: false, message: "Designation name already exists" });
    }

    const [updated] = await db.designations.update(
      { designation_name },
      { where: { id } }
    );

    if (updated) {
      const currentDate = new Date();
      const dateString = currentDate.toISOString().split("T")[0];
      const timeString = currentDate.toTimeString().split(" ")[0];

      await db.logs.create({
        user_id: logid,
        api: `Edit Designation/${id}`,
        message: "Success",
        data: JSON.stringify({ designation_name }),
        ip: logip,
        date: dateString,
        time: timeString,
      });

      return res.json({
        success: true,
        message: "Designation updated successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, message: "Designation not found" });
    }
  } catch (error) {
    console.error("Error updating designation:", error);
    const currentDate = new Date();
    const dateString = currentDate.toISOString().split("T")[0];
    const timeString = currentDate.toTimeString().split(" ")[0];

    await db.logs.create({
      user_id: logid,
      api: `Edit Designation/${id}`,
      message: "Failed",
      data: JSON.stringify({ error: error.message }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    return res
      .status(500)
      .json({ success: false, message: "Error updating designation" });
  }
};

const deletedesignation = async (req, res) => {
  const id = req.params.id;
  const logid = req.query.logid;
  const logip = req.query.logip;

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    const result = await db.designations.destroy({
      where: { id: id },
    });

    if (result === 0) {
      await db.logs.create({
        user_id: logid,
        api: `Delete Designation/${id}`,
        message: "Failed",
        data: JSON.stringify({ error: "Designation not found" }),
        ip: logip,
        date: dateString,
        time: timeString,
      });
      return res.status(404).json({ message: "Designation not found" });
    }

    await db.logs.create({
      user_id: logid,
      api: `Delete Designation/${id}`,
      message: "Success",
      data: JSON.stringify({ designation_id: id }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    res.status(200).json({ message: "Designation deleted successfully" });
  } catch (error) {
    console.error("Error deleting designation:", error);

    if (error.name === "SequelizeForeignKeyConstraintError") {
      await db.logs.create({
        user_id: logid,
        api: `Delete Designation/${id}`,
        message: "Failed",
        data: JSON.stringify({ error: "Foreign key constraint violation" }),
        ip: logip,
        date: dateString,
        time: timeString,
      });
      return res.status(400).json({
        message:
          "This designation cannot be deleted because it is associated with other records.",
      });
    }

    await db.logs.create({
      user_id: logid,
      api: `Delete Designation/${id}`,
      message: "Failed",
      data: JSON.stringify({ error: error.message }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    res.status(500).json({ message: "Server error" });
  }
};

const getadmindepartment = async (req, res) => {
  try {
    const result = await db.departments.findAll();
    res.json(result);
  } catch (error) {
    res.json(error);
  }
};

const getadmindesignation = async (req, res) => {
  try {
    const result = await db.designations.findAll();
    res.json(result);
  } catch (error) {
    res.json(error);
  }
};

const allattendancedownload = async (req, res) => {
  const logid = req.query.logid;
  const logip = req.query.logip;

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    const results = await db.attendances.findAll({
      include: [
        {
          model: db.users,
          as: "userDetails",
          attributes: ["first_name", "last_name", "emp_id", "email", "role"],
          required: true,
        },
      ],
      where: {
        "$userDetails.role$": { [Op.notIn]: [1, "Admin"] },
      },
    });

    const transformedResults = results.map((item) => {
      const attendance = item.get({ plain: true });
      const user = attendance.userDetails;
      return {
        fullname: `${user.first_name} ${user.last_name}`,
        email: user.email,
        emp_id: user.emp_id,
        in_time: attendance.in_time,
        out_time: attendance.out_time,
        date: attendance.date,
        status: attendance.status,
      };
    });

    const csv = new Parser().parse(transformedResults);

    res.header("Content-Type", "text/csv");
    res.attachment("Attendance.csv");
    res.send(csv);

    await db.logs.create({
      user_id: logid,
      api: `All Attendance Download`,
      message: "Success",
      data: JSON.stringify({ downloaded_records: transformedResults.length }),
      ip: logip,
      date: dateString,
      time: timeString,
    });
  } catch (error) {
    console.error(error);

    await db.logs.create({
      user_id: logid,
      api: `All Attendance Download`,
      message: "Failed",
      data: JSON.stringify({ error: error.message }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    res.status(500).send("Error querying the database");
  }
};

const admincountLeaveNotifications = async (req, res) => {
  try {
    const users = await db.users.findAll({
      where: {
        role: {
          [db.Sequelize.Op.or]: [2, 3],
        },
      },
      attributes: ["id"],
    });

    const userIds = users.map((user) => user.id);

    const count = await db.applyleave.count({
      where: {
        status: null,
        user_id: {
          [db.Sequelize.Op.in]: userIds,
        },
      },
    });

    res.status(200).json({ count: count || 0 });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred", error: error.message });
  }
};

const adminshowleaveDatanotification = async (req, res) => {
  try {
    const leaveRequests = await db.applyleave.findAll({
      include: [
        {
          model: db.users,
          as: "userDetails",
          required: true,
          attributes: ["first_name", "last_name", "emp_id"],
          where: {
            role: {
              [db.Sequelize.Op.notIn]: [1],
            },
          },
        },
      ],
      where: {
        status: null,
      },
      order: [["id", "DESC"]],
    });

    const nullStatusCount = await db.applyleave.count({
      where: {
        status: null,
      },
    });

    res.json({ leaveRequests, nullStatusCount });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred", error: error.message });
  }
};

const adminshowAllLeaveuser = async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const search = req.query.search || "";
  const status = req.query.status || "";
  const sortColumn = req.query.sort?.column || "id";
  const sortOrder = req.query.sort?.order || "asc";
  const leave = req.query.leave;
  const offset = (page - 1) * limit;

  const validSortColumns = [
    "id",
    "apply_date",
    "status",
    "first_name",
    "last_name",
    "emp_id",
  ];

  if (!validSortColumns.includes(sortColumn)) {
    return res.status(400).json({ message: "Invalid sort column" });
  }

  try {
    const leaveWhereConditions = {
      status: {
        [Op.ne]: null,
      },
      ...(status ? { status } : {}),
    };

    if (leave) {
      if (leave === "Approved") {
        leaveWhereConditions.status = "Approved";
      } else if (leave === "Rejected") {
        leaveWhereConditions.status = "Reject";
      } else if (leave === "Pending") {
        leaveWhereConditions.status = null;
      }
    }

    const leaveRequests = await db.applyleave.findAll({
      include: [
        {
          model: db.users,
          as: "userDetails",
          required: true,
          attributes: ["first_name", "last_name", "emp_id"],
          where: {
            [Op.or]: [
              Sequelize.where(
                Sequelize.fn(
                  "concat",
                  Sequelize.col("first_name"),
                  " ",
                  Sequelize.col("last_name")
                ),
                { [Op.like]: `%${search}%` }
              ),
              { emp_id: { [Op.like]: `%${search}%` } },
            ],
            role: {
              [Op.notIn]: [1],
            },
          },
        },
      ],
      where: leaveWhereConditions,
      order: [
        [
          sortColumn === "first_name"
            ? Sequelize.col("userDetails.first_name")
            : sortColumn,
          sortOrder,
        ],
      ],
      limit,
      offset,
    });

    const total = await db.applyleave.count({
      include: [
        {
          model: db.users,
          as: "userDetails",
          required: true,
          attributes: [],
          where: {
            role: {
              [Op.notIn]: [1],
            },
          },
        },
      ],
      where: leaveWhereConditions,
    });

    res.json({ data: leaveRequests, totalCount: total });
  } catch (error) {
    console.error("Error fetching leave users:", error);
    res.status(500).json({ message: "Error fetching leave users" });
  }
};

const employeelistdownload = async (req, res) => {
  const logid = req.query.logid;
  const logip = req.query.logip;

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    const results = await db.users.findAll({
      include: [
        {
          model: db.departments,
          as: "departmentDetails",
          attributes: ["department_name"],
        },
        {
          model: db.designations,
          as: "designationDetails",
          attributes: ["designation_name"],
        },
        {
          model: db.roles,
          as: "roleDetails",
          attributes: ["role"],
        },
        {
          model: db.cities,
          as: "cityDetails",
          attributes: ["name"],
        },
        {
          model: db.states,
          as: "stateDetails",
          attributes: ["name"],
        },
        {
          model: db.countries,
          as: "countryDetails",
          attributes: ["name"],
        },
      ],
      where: {
        role: { [Op.notIn]: [1, "Admin"] },
      },
    });

    const transformedResults = results.map((item) => {
      return {
        fullname: `${item.first_name} ${item.last_name}`,
        email: item.email,
        emp_id: item.emp_id,
        department: item.departmentDetails
          ? item.departmentDetails.department_name
          : "N/A",
        designation: item.designationDetails
          ? item.designationDetails.designation_name
          : "N/A",
        role: item.roleDetails ? item.roleDetails.role : "N/A",
        city: item.cityDetails ? item.cityDetails.name : "N/A",
        state: item.stateDetails ? item.stateDetails.name : "N/A",
        country: item.countryDetails ? item.countryDetails.name : "N/A",
      };
    });

    const csv = new Parser().parse(transformedResults);

    res.header("Content-Type", "text/csv");
    res.attachment("Employee.csv");
    res.send(csv);

    await db.logs.create({
      user_id: logid,
      api: `Download EmployeeList`,
      message: "Success",
      data: JSON.stringify({ downloaded_records: transformedResults.length }),
      ip: logip,
      date: dateString,
      time: timeString,
    });
  } catch (error) {
    console.error(error);

    await db.logs.create({
      user_id: logid,
      api: `All Attendance Download`,
      message: "Failed",
      data: JSON.stringify({ error: error.message }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    res.status(500).send("Error querying the database");
  }
};

const countTodayAttendance = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const count = await db.attendances.count({
      where: {
        date: {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay,
        },
        in_time: {
          [Op.ne]: null,
        },
      },
    });

    res.json({ count });
  } catch (error) {
    console.error("Error counting today's attendance:", error);
    res.status(500).json({ message: "Error counting attendance" });
  }
};

const countApprovedLeaves = async (req, res) => {
  try {
    const today = moment().startOf("day").format("YYYY-MM-DD");

    const count = await db.attendances.count({
      where: {
        status: "Leave",
        date: today,
      },
    });

    res.json({ count });
  } catch (error) {
    console.error("Error counting approved leaves:", error);
    res.status(500).json({ message: "Error counting approved leaves" });
  }
};

const AddattandanceAdmin = async (req, res) => {
  const { empId, in_time, out_time, date, status, comment } = req.body;
  const logid = req.query.logid;
  const logip = req.query.logip;

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  if (!empId || !in_time || !out_time || !date || !status) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const employee = await db.users.findOne({
      where: { emp_id: empId },
      attributes: ["id"],
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const attendanceData = {
      user_id: employee.id,
      in_time,
      out_time,
      date,
      status,
      comment,
    };

    await db.attendances.create(attendanceData);
    await db.logs.create({
      user_id: logid,
      api: `Add Attendance`,
      message: "success",
      data: JSON.stringify({ empId, in_time, out_time, date, status, comment }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    return res.status(201).json({ message: "Attendance added successfully" });
  } catch (error) {
    console.error("Error adding attendance:", error);

    await db.logs.create({
      user_id: logid,
      api: `Add Attendance`,
      message: "failed",
      data: JSON.stringify({ error: error.message }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const searchUser = async (req, res) => {
  try {
    const userAll = await db.users.findAll();

    const filteredUsers = userAll.filter((user) => user.emp_id !== "admin");

    if (filteredUsers.length === 0) {
      return res
        .status(404)
        .json({ message: "No users found excluding admins." });
    }

    const userIds = filteredUsers.map((user) => user.emp_id);
    res.json(userIds);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "An error occurred while fetching users." });
  }
};

const geteditleave = async (req, res) => {
  const { id } = req.params;

  try {
    const attendanceRecord = await db.applyleave.findOne({
      include: {
        model: db.users,
        as: "userDetails",
        attributes: ["first_name", "last_name", "emp_id", "role"],
        required: true,
      },
      attributes: [
        "id",
        "user_id",
        "apply_date",
        "start_date",
        "end_date", // Fixed: use 'end_date' consistently
        "comment",
        "type",
        "handleby",
        "shortOutTime",
        "shortInTime",
        "status",
        [
          Sequelize.fn(
            "CONCAT",
            Sequelize.col("userDetails.first_name"),
            " ",
            Sequelize.col("userDetails.last_name")
          ),
          "fullname",
        ],
      ],
      where: {
        id: id,
      },
    });

    if (!attendanceRecord) {
      return res
        .status(404)
        .json({ success: false, message: "Attendance record not found" });
    }

    res.json({
      success: true,
      record: attendanceRecord,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "An error occurred while fetching attendance data",
      error: error.message,
    });
  }
};

const editleave = async (req, res) => {
  const { id } = req.params;
  const {
    start_date,
    end_date,
    shortOutTime,
    shortInTime,
    status,
    type,
    comment: reason,
    logid,
    logip,
  } = req.body;

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    // Check if the leave request exists
    const currentLeave = await db.applyleave.findOne({ where: { id } });
    if (!currentLeave) {
      return res
        .status(404)
        .json({ success: false, message: "Leave request not found" });
    }

    // Update the leave request
    const [updated] = await db.applyleave.update(
      {
        start_date,
        end_date,
        shortOutTime,
        shortInTime,
        status,
        type,
        comment: reason,
      },
      { where: { id } }
    );

    if (updated) {
      await db.logs.create({
        user_id: logid,
        api: `Edit Leave/${id}`,
        message: "Success",
        data: JSON.stringify({
          old_leave: currentLeave,
          new_leave: {
            start_date,
            end_date,
            shortOutTime,
            shortInTime,
            status,
            type,
            reason,
          },
        }),
        ip: logip,
        date: dateString,
        time: timeString,
      });

      return res.json({
        success: true,
        message: "Leave request updated successfully",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, message: "Leave request not found" });
    }
  } catch (error) {
    console.error("Error updating leave request:", error);
    await db.logs.create({
      user_id: logid,
      api: `Edit Leave/${id}`,
      message: "Failed",
      data: JSON.stringify({ error: error.message }),
      ip: logip,
      date: dateString,
      time: timeString,
    });
    return res
      .status(500)
      .json({ success: false, message: "Error updating leave request" });
  }
};

const LoginAsClient = async (req, res) => {
  const { id } = req.params;
  const { admintoken } = req.query;

  try {

    const user = await db.users.findOne({
      where: { id },
      include: [
        {
          model: db.roles,
          as: "roleDetails",
          attributes: ["id", "role"],
        },
      ],
    });

 
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.roleDetails.role === "Admin") {
      if (user.token !== admintoken) {
        return res
          .status(401)
          .json({ message: "Unauthorized - Invalid Token" });
      }
    }

    
    let isValidToken = user.token ? verifyusertoken(user.token) : false;
    let newToken = user.token; 

    if (!user.token || !isValidToken) {
      newToken = generateToken(user.id, user.roleDetails.role);
      await db.users.update({ token: newToken }, { where: { id } });
    }

    return res.status(200).json({
      user: { ...user.toJSON(), token: newToken },
      message: "Successfully retrieved data",
    });
  } catch (error) {
    console.error("Error retrieving user:", error);
    return res.status(500).json({
      message: "An error occurred while retrieving user data",
      error: error.message,
    });
  }
};

const fetchCountry = async (req, res) => {
  try {
    const countries = await db.countries.findAll(); 
    res.json(countries);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const fetchState = async (req, res) => {
  try {
    const countryId = req.params.id;
    const states = await db.states.findAll({
      where: { country_id: countryId },
    });
    res.json(states);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const fetchCity = async (req, res) => {
  try {
    const stateId = req.params.id; 
    const cities = await db.cities.findAll({ where: { state_id: stateId } }); 
    res.json(cities);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getallEmpid = async (req, res) => {
  try {    const users = await db.users.findAll({
      attributes: ["empid"], 
    });

    
    if (users.length === 0) {
      return res.status(404).json({ message: "No employees found" });
    }


    const empIds = users.map((user) => user.empid);

   
    return res.status(200).json(empIds);
  } catch (error) {
    console.error("Error fetching employee IDs:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const FetchCountryCode = async (req, res) => {
  try {
    const result = await db.countries.findAll({
      attributes: ["phoneCode"],
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ message: error });
  }
};

const FetchCountryCodeById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.countries.findAll({
      where: { id },
      attributes: ["phoneCode"],
    });

    return res.json(result);
  } catch (error) {
    console.error("Error fetching country code:", error);
    return res.status(500).json({ error: "Failed to fetch country code" });
  }
};

module.exports = {
  getallEmpid,
  fetchCountry,
  fetchCity,
  fetchState,
  uploadImage,
  getImage,
  addUser,
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  upload,
  getAttendance,
  saveComment,
  deleteAttendance,
  saveRecord,
  viewUser,
  viewUserAttendance,
  logs,
  deletelog,
  adddepartment,
  getdepartmentdetail,
  editdepartment,
  deletedepartment,
  adddesignation,
  getdesignation,
  editdesignation,
  deletedesignation,
  getadmindepartment,
  getadmindesignation,
  allattendancedownload,
  admincountLeaveNotifications,
  adminshowleaveDatanotification,
  adminshowAllLeaveuser,
  employeelistdownload,
  countTodayAttendance,
  countApprovedLeaves,
  AddattandanceAdmin,
  searchUser,
  geteditleave,
  editleave,
  editProfileofuser,
  updateuser,
  LoginAsClient,
  FetchCountryCode,
  FetchCountryCodeById,
};
