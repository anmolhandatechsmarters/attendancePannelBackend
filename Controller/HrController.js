const { Sequelize, Op } = require("sequelize");
const db = require("../Connection");

const hrdata = async (req, res) => {
  const id = req.params.id;

  try {
    const user = await db.users.findOne({
      where: { id: id },
      include: [
        {
          model: db.roles,
          as: "roleDetails",
          attributes: ["id", "role"],
        },
        {
          model: db.attendances,
          as: "attendances",
          attributes: ["in_time", "out_time", "date"],
        },
      ],
    });

    if (user) {
      res.json({ success: true, user });
    } else {
      res.json({ success: false, message: "No user found" });
    }
  } catch (error) {
    console.error("Error fetching user details:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Internal Server Error",
        error: error.message,
      });
  }
};

const hrcountemployee = async (req, res) => {
  try {
    const employeecount = await db.users.count({
      where: { role: 3 },
    });
    res.json({ success: true, count: employeecount });
  } catch (error) {
    console.error("Error counting employees:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const hractiveemployee = async (req, res) => {
  try {
    const result = await db.users.count({
      where: { role: 3, status: "1" },
    });
    res.json({ success: true, count: result });
  } catch (error) {
    console.error("Error counting active employees:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const hrinactiveemployee = async (req, res) => {
  try {
    const result = await db.users.count({
      where: { role: 3, status: "0" },
    });
    res.json({ success: true, count: result });
  } catch (error) {
    console.error("Error counting inactive employees:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const gethremployeeattendance = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || "";
  const userId = req.query.userid;
  const sortColumn = req.query.sort?.column || "id";
  const sortOrder = req.query.sort?.order || "asc";
  const month = parseInt(req.query.month) || null;
  const year = parseInt(req.query.year) || null;
  const startDate = req.query.startDate || null;
  const endDate = req.query.endDate || null;
  const status = req.query.status || null;
  const offset = (page - 1) * limit;

  const validSortColumns = ["id", "in_time", "out_time", "date"];
  if (!validSortColumns.includes(sortColumn)) {
    return res.status(400).json({ message: "Invalid sort column" });
  }

  try {
    const attendanceRecords = await db.attendances.findAll({
      include: {
        model: db.users,
        as: "userDetails",
        attributes: ["first_name", "last_name", "emp_id", "role"],
        required: true,
      },
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
            `CONCAT(userDetails.first_name, ' ',' ', userDetails.middle_name,' ', userDetails.last_name,  '(', userDetails.emp_id, ')')`
          ),
          "fullname",
        ], // Updated this line
      ],
      where: {
        [Op.and]: [
          userId ? { user_id: userId } : {},
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
          status ? { status } : {},
          year
            ? Sequelize.where(Sequelize.fn("YEAR", Sequelize.col("date")), year)
            : {},
          startDate ? { date: { [Op.gte]: startDate } } : {},
          endDate ? { date: { [Op.lte]: endDate } } : {},
        ],
      },
      order: [[sortColumn, sortOrder]],
      limit,
      offset,
    });

    const filteredRecords = attendanceRecords.filter((record) => {
      const userRole = record.userDetails.role;
      return !(userRole === 1);
    });

    const total = await db.attendances.count({
      include: {
        model: db.users,
        as: "userDetails",
        attributes: [],
      },
      where: {
        [Op.and]: [
          userId ? { user_id: userId } : {},
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
          status ? { status } : {},
          year
            ? Sequelize.where(Sequelize.fn("YEAR", Sequelize.col("date")), year)
            : {},
          startDate ? { date: { [Op.gte]: startDate } } : {},
          endDate ? { date: { [Op.lte]: endDate } } : {},
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

const getemployee = async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const search = req.query.search || "";
  const role = req.query.role || "";
  const sortColumn = req.query.sort?.column || "id";
  const sortOrder = req.query.sort?.order || "asc";
  const toggle = req.query.toggle;
  const offset = (page - 1) * limit;

  const validSortColumns = [
    "id",
    "first_name",
    "last_name",
    "email",
    "emp_id",
    "status",
    "last_login",
  ];
  if (!validSortColumns.includes(sortColumn)) {
    return res.status(400).json({ message: "Invalid sort column" });
  }

  try {
    const statusCondition =
      toggle === "Active"
        ? { status: "1" }
        : toggle === "Inactive"
        ? { status: "0" }
        : {};

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
      ],
      where: {
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
          statusCondition,
        ],
      },
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
      where: {
        [Op.and]: [
          Sequelize.where(
            Sequelize.fn(
              "concat",
              Sequelize.col("first_name"),
              " ",
              Sequelize.col("last_name")
            ),
            { [Op.like]: `%${search}%` }
          ),
          role
            ? Sequelize.where(Sequelize.col("roleDetails.role"), {
                [Op.like]: `%${role}%`,
              })
            : {},
          { emp_id: { [Op.ne]: "admin" } },
          { "$roleDetails.id$": { [Op.notIn]: [1, 2] } },
          statusCondition,
        ],
      },
    });

    res.json({ users, total });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getAttendanceByEmpId = async (req, res) => {
  const { id } = req.params;

  try {
    const attendanceRecord = await db.attendances.findOne({
      include: {
        model: db.users,
        as: "userDetails",
        attributes: ["first_name", "last_name", "emp_id", "role"],
        required: true,
      },
      attributes: [
        "id",
        "user_id",
        "in_time",
        "out_time",
        "date",
        "comment",
        "status",

        [
          Sequelize.fn(
            "CONCAT",
            Sequelize.col("userDetails.first_name"),
            " ",
            Sequelize.col("userDetails.middle_name"),
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
      attendance: attendanceRecord,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        message: "An error occurred while fetching attendance data",
        error: error.message,
      });
  }
};

module.exports = {
  hrdata,
  hrcountemployee,
  hractiveemployee,
  hrinactiveemployee,
  gethremployeeattendance,
  getemployee,
  getAttendanceByEmpId,
};
