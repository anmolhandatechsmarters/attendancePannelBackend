const { Sequelize, Op } = require("sequelize");
const db = require("../Connection");
const { Parser } = require("json2csv");

const applyleave = async (req, res) => {
  const {
    user_id,
    start_date,
    end_date,
    comment,
    type,
    shortInTime,
    shortOutTime,
  } = req.body;
  const today = new Date();
  const todayString = today.toISOString().split("T")[0];

  if (!start_date || !type) {
    return res
      .status(400)
      .json({ message: "Start date and leave type are required." });
  }

  if (isNaN(new Date(start_date)) || (end_date && isNaN(new Date(end_date)))) {
    return res.status(400).json({ message: "Invalid date format." });
  }

  if (start_date < todayString || (end_date && end_date < todayString)) {
    return res
      .status(400)
      .json({ message: "Start date and end date must be today or later." });
  }

  if (end_date && start_date > end_date) {
    return res
      .status(400)
      .json({ message: "End date cannot be earlier than start date." });
  }

  try {
    const result = await db.applyleave.create({
      user_id,
      start_date,
      end_date,
      comment,
      type,
      shortOutTime,
      shortInTime,
      apply_date: todayString,
    });

    res.status(201).json({ message: "Leave applied successfully", result });
  } catch (error) {
    console.error("Error applying leave:", error);
    res.status(500).json({
      message: "An error occurred while applying for leave",
      error: error.message,
    });
  }
};

const AddLeaves = async (req, res) => {
  const {
    start_date,
    end_date,
    comment,
    type,
    shortOutTime,
    shortInTime,
    empid,
    userrole,
  } = req.body;
  const today = new Date();
  const todayString = today.toISOString().split("T")[0];
  const logid = req.query.logid;
  const logip = req.query.logip;

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  if (!start_date || !type) {
    return res
      .status(400)
      .json({ message: "Start date and leave type are required." });
  }

  if (isNaN(new Date(start_date)) || (end_date && isNaN(new Date(end_date)))) {
    return res.status(400).json({ message: "Invalid date format." });
  }



  if (end_date && start_date > end_date) {
    return res
      .status(400)
      .json({ message: "End date cannot be earlier than start date." });
  }

  if (type === "ShortLeave") {
    if (!shortOutTime || !shortInTime) {
      return res.status(400).json({
        message:
          "Short Out Time and Short In Time are required for Short Leave.",
      });
    }

    if (
      isNaN(new Date(`${shortOutTime}`)) ||
      isNaN(new Date(`${shortInTime}`))
    ) {
      return res.status(400).json({ message: "Invalid time format." });
    }
    if (shortInTime < shortOutTime) {
      return res.status(400).json({
        message: "Short In Time cannot be earlier than Short Out Time.",
      });
    }
  }

  try {
    const user = await db.users.findOne({
      where: { emp_id: empid },
      attributes: ["id"],
    });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found with the provided employee ID." });
    }

    const userId = user.id;

    const result = await db.applyleave.create({
      user_id: userId,
      start_date,
      end_date,
      comment,
      type,
      shortOutTime: type === "ShortLeave" ? shortOutTime : null,
      shortInTime: type === "ShortLeave" ? shortInTime : null,
      apply_date: todayString,
      status: "Approved",
      handleBy: userrole,
    });

    await db.logs.create({
      user_id: logid,
      api: `Add Leave`,
      message: "Success",
      data: JSON.stringify({ result }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    res.status(201).json({ message: "Leave applied successfully", result });
  } catch (error) {
    console.error("Error applying leave:", error);

    await db.logs.create({
      user_id: logid,
      api: `Add Leave`,
      message: "Failed",
      data: JSON.stringify({ error }),
      ip: logip,
      date: dateString,
      time: timeString,
    });
    res.status(500).json({
      message: "An error occurred while applying for leave",
      error: error.message,
    });
  }
};

const showleaveDatanotification = async (req, res) => {
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
              [db.Sequelize.Op.notIn]: [1, 2],
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

const approveleave = async (req, res) => {
  const { id } = req.params;
  const role = req.query.role;
  const logid = req.query.logid;
  const logip = req.query.logip;

  if (!id || !role || !logid || !logip) {
    return res.status(400).json({ message: "Invalid input data." });
  }

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    const result = await db.applyleave.update(
      { status: "Approved", handleBy: role },
      { where: { id } }
    );

    if (result[0] === 0) {
      return res.status(404).json({ message: "Leave request not found." });
    }

    await db.logs.create({
      user_id: logid,
      api: `Approve Leave/${id}`,
      message: "Success",
      data: JSON.stringify(role),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    res.status(200).json({ message: "Leave request approved successfully." });
  } catch (error) {
    console.error(error);

    await db.logs.create({
      user_id: logid,
      api: `Approve Leave/${id}`,
      message: "Failed",
      data: JSON.stringify({ error: error.message }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    res
      .status(500)
      .json({ message: "An error occurred", error: error.message });
  }
};

const rejectleave = async (req, res) => {
  const { id } = req.params;
  const role = req.query.role;
  const logid = req.query.logid;
  const logip = req.query.logip;
  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];
  try {
    const result = await db.applyleave.update(
      { status: "Reject", handleBy: role },
      {
        where: { id: id },
      }
    );

    if (result[0] === 0) {
      return res.status(404).json({ message: "Leave request not found." });
    }
    res.status(200).json({ message: "Leave request approved successfully." });

    await db.logs.create({
      user_id: logid,
      api: `Reject Leave/${id}`,
      message: "Success",
      data: JSON.stringify(role),
      ip: logip,
      date: dateString,
      time: timeString,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred", error: error.message });
    await db.logs.create({
      user_id: logid,
      api: `Reject Leave/${id}`,
      message: "Failed",
      data: JSON.stringify(role),
      ip: logip,
      date: dateString,
      time: timeString,
    });
  }
};

const countLeaveNotifications = async (req, res) => {
  try {
    const count = await db.applyleave.count({
      where: {
        status: null,
        user_id: {
          [db.Sequelize.Op.in]: await db.users
            .findAll({
              where: { role: 3 },
              attributes: ["id"],
            })
            .then((users) => users.map((user) => user.id)),
        },
      },
    });
    res.status(200).json({ count });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred", error: error.message });
  }
};

const showAllLeaveuser = async (req, res) => {
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
    "middle_name",
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
          attributes: ["first_name", "last_name", "emp_id", "id","middle_name"],
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
              [Op.notIn]: [1, 2],
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

    // Extract user IDs from leaveRequests if needed
    const userIds = leaveRequests.map((leave) => leave.userDetails.id);

    res.json({ data: leaveRequests, totalCount: total, userIds });
  } catch (error) {
    console.error("Error fetching leave users:", error);
    res.status(500).json({ message: "Error fetching leave users" });
  }
};

const deleteleave = async (req, res) => {
  const id = req.params.id;
  const logid = req.query.logid;
  const logip = req.query.logip;

  try {
    const leaveApplication = await db.applyleave.findOne({
      where: { id: id },
      attributes: [
        "id",
        "user_id",
        "apply_date",
        "start_date",
        "end_date",
        "status",
      ],
    });

    if (!leaveApplication) {
      return res.status(404).json({ message: "Leave application not found" });
    }

    const result = await db.applyleave.destroy({
      where: { id: id },
    });
    const currentDate = new Date();

    await db.logs.create({
      user_id: logid,
      api: `Delete Leave/${id}`,
      message: "Success",
      ip: logip,
      data: JSON.stringify(leaveApplication),
      date: currentDate.toISOString().split("T")[0],
      time: currentDate.toTimeString().split(" ")[0],
    });
    res
      .status(200)
      .json({ message: "Leave application deleted successfully", result });
  } catch (error) {
    console.error("Error deleting leave:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const showAllLeave = async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const month = parseInt(req.query.month, 10) || null;
  const year = parseInt(req.query.year, 10) || null;
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;
  const offset = (page - 1) * limit;

  try {
    const where = { user_id: id };
    const conditions = [];

    if (month) {
      conditions.push(
        Sequelize.where(
          Sequelize.fn("MONTH", Sequelize.col("apply_date")),
          month
        )
      );
    }

    if (year) {
      conditions.push(
        Sequelize.where(Sequelize.fn("YEAR", Sequelize.col("apply_date")), year)
      );
    }

    if (startDate) {
      conditions.push({ apply_date: { [Op.gte]: startDate } });
    }

    if (endDate) {
      conditions.push({ apply_date: { [Op.lte]: endDate } });
    }

    if (conditions.length > 0) {
      where[Op.and] = conditions;
    }

    const userLeaves = await db.applyleave.findAndCountAll({
      where,
      offset,
      limit,
      order: [["id", "DESC"]],
    });

    res.json({
      totalCount: userLeaves.count,
      data: userLeaves.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while fetching leaves." });
  }
};

const showLatestNotificationForId = async (req, res) => {
  const id = req.params.id;

  try {
    const result = await db.applyleave.findOne({
      where: { user_id: id },
      order: [["updatedAt", "DESC"]],
    });

    res.json(result ? [result] : []);
  } catch (error) {
    console.error("Error fetching leave notification:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const allleavedownlaod = async (req, res) => {
  const logid = req.query.logid;
  const logip = req.query.logip;
  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];
  try {
    const results = await db.applyleave.findAll({
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
      const applyleave = item.get({ plain: true });
      const user = applyleave.userDetails;

      return {
        fullname: `${user.first_name} ${user.last_name}`,
        email: user.email,
        emp_id: user.emp_id,
        apply_date: applyleave.apply_date,
        Start_Leave_date: applyleave.start_date,
        End_leave_Date: applyleave.end_date,
        Typeofleave: applyleave.type,
        status: applyleave.status,
      };
    });

    const csv = new Parser().parse(transformedResults);

    res.header("Content-Type", "text/csv");
    res.attachment("Attendance.csv");
    res.send(csv);

    await db.logs.create({
      user_id: logid,
      api: `Download Leave List`,
      message: "Success",
      data: JSON.stringify({ results }),
      ip: logip,
      date: dateString,
      time: timeString,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error querying the database");
    await db.logs.create({
      user_id: logid,
      api: `Download Leave List`,
      message: "Failed",
      data: JSON.stringify({ results }),
      ip: logip,
      date: dateString,
      time: timeString,
    });
  }
};

const hrshowleaveDatanotification = async (req, res) => {
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
              [db.Sequelize.Op.notIn]: [1, 2],
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

module.exports = {
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
};
