const { Sequelize, Op } = require("sequelize");
const db = require("../Connection");
const moment = require("moment");
const moments = require("moment-timezone");
const NotificationService = require("../Firebase/Services/NotificationServices");
const findemployeedetail = async (req, res) => {
  const id = req.params.id;
  const today = new Date().toISOString().split("T")[0];

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
          where: { date: today },
          order: [["date", "DESC"]],
          limit: 1,
          attributes: ["in_time", "out_time", "date", "status"],
        },
      ],
    });

    if (user) {
      const response = {
        id: user.id,
        email: user.email,
        role: user.roleDetails,
        attendance: user.attendances.length > 0 ? user.attendances[0] : null, // Get today's attendance or null
      };
      res.json({ success: true, user: response });
    } else {
      res.json({ success: false, message: "No user found" });
    }
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const userattendance = async (req, res) => {
  const id = req.params.id;
  const today = moment().format("YYYY-MM-DD");

  try {
    const attendance = await db.attendances.findOne({
      where: { user_id: id, date: today },
    });

    res.json(attendance || {});
  } catch (error) {
    console.error("Error fetching attendance:", error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching attendance" });
  }
};

const convertTo24Hour = (timeStr) => {
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes, seconds] = time.split(":");

  if (modifier === "PM" && hours !== "12") {
    hours = parseInt(hours, 10) + 12;
  }
  if (modifier === "AM" && hours === "12") {
    hours = "00";
  }

  return `${hours.padStart(2, "0")}:${minutes.padStart(
    2,
    "0"
  )}:${seconds.padStart(2, "0")}`;
};

async function getFCMTokensForRoles(roles) {
  const users = await db.users.findAll({
    include: {
      model: db.roles,
      as: "roleDetails",
      attributes: ["role"],
      where: { role: roles },
    },
    attributes: ["id"],
  });

  const userIds = users.map((user) => user.id);

  const fcmTokens = await db.Notification.findAll({
    where: {
      userId: userIds,
      allow_notifcation: 1,
    },
    attributes: ["fcm_token"],
  });

  return fcmTokens
    .map((notification) => notification.fcm_token)
    .filter((token) => token);
}

async function findId(id, description) {
  try {
    console.log(
      "Function findId called with id:",
      id,
      "and description:",
      description
    );

    // Find the user and include role details
    const user = await db.users.findOne({
      where: { id },
      include: {
        model: db.roles,
        as: "roleDetails",
        attributes: ["role"],
      },
    });

    console.log("User found:", user ? user.toJSON() : "User not found");

    if (!user) {
      console.log("User not found, exiting.");
      return;
    }

    const userRole = user.roleDetails.role;

    // ✅ If Employee, notify HR/Admin (only if allow_notification = 1)
    if (userRole === "Employee") {
      console.log(
        "User role is Employee, looking for HR and Admin users with notifications enabled."
      );

      // Find HR & Admin users with allow_notification = 1
      const fcmTokens = await getFCMTokensForRoles(["HR", "Admin"]);

      if (fcmTokens.length > 0) {
        console.log("Sending notification to HR/Admin:", fcmTokens);
        await NotificationService.sendNotification(
          fcmTokens,
          user.email,
          description
        );
      } else {
        console.log("No HR/Admin users with notifications enabled, skipping.");
      }
    }
    // ✅ If HR, notify Admin (only if allow_notification = 1)
    else if (userRole === "HR") {
      console.log(
        "User role is HR, looking for Admin users with notifications enabled."
      );

      // Find Admin users with allow_notification = 1
      const fcmTokens = await getFCMTokensForRoles(["Admin"]);

      if (fcmTokens.length > 0) {
        console.log("Sending notification to Admin:", fcmTokens);
        await NotificationService.sendNotification(
          fcmTokens,
          `HR to Admin: ${user.email}`,
          description
        );
      } else {
        console.log("No Admin users with notifications enabled, skipping.");
      }
    } else {
      console.log("User is not an Employee or HR, skipping notification.");
    }
  } catch (error) {
    console.error("Error in findId:", error);
  }
}

const MarkAttendance = async (req, res) => {
  const id = req.params.id;
  const { logid, logip } = req.body;
  const today = moments().tz("Asia/Kolkata").format("YYYY-MM-DD");

  const previousDay = moments()
    .tz("Asia/Kolkata")
    .subtract(1, "days")
    .format("YYYY-MM-DD");
  const dateStrings = moments().tz("Asia/Kolkata").format("YYYY-MM-DD");
  const timeStrings = moments().tz("Asia/Kolkata").format("HH:mm:ss");

  if (!id || !logid) {
    return res.status(400).json({
      success: false,
      message: "Missing required parameters.",
    });
  }

  try {
    const incompleteRecords = await db.attendances.findAll({
      where: {
        user_id: id,
        out_time: null,
          [Op.or]: [
      { status: null },
      { status: { [Op.ne]: 'Leave' } }
    ]
  
      },
    
      attributes: ["date"],
      order: [["date"]],
    });
    console.log(incompleteRecords);
    if (incompleteRecords.length > 0) {
      const missingDates = incompleteRecords.map((record) => record.date);
      return res.status(400).json({
        success: false,
        message: `Incomplete attendance found on previous dates: ${missingDates.join(
          ", "
        )}`,
        userId: id,
        today,
        missingDates,
      });
    }

  

    // Check for leave records
    const leaveRecord = await db.applyleave.findOne({
      where: {
        status: "Approved",
        user_id: id,
        [Op.or]: [
          { start_date: today },
          { end_date: today },
          {
            [Op.and]: [
              { start_date: { [Op.lte]: today } },
              { end_date: { [Op.gte]: today } },
            ],
          },
        ],
      },
    });

    if (leaveRecord) {
      return res.status(400).json({
        success: false,
        message: "Attendance cannot be marked because you are on leave today.",
      });
    }

    const todayRecord = await db.attendances.findOne({
      where: { user_id: id, date: today },
    });

    if (todayRecord) {
      if (todayRecord.in_time && todayRecord.out_time === null) {
        // Marking the out time
        const outtime = moments().tz("Asia/Kolkata").format("HH:mm:ss");
        todayRecord.out_time = outtime;
        await todayRecord.save();

        await db.logs.create({
          user_id: logid,
          api: `Mark Attendance`,
          message: "Success - Out time marked",
          data: JSON.stringify(todayRecord),
          ip: logip,
          date: dateStrings,
          time: timeStrings,
        });

        return res.json({ success: true, record: todayRecord });
      } else if (
        todayRecord.in_time === null &&
        todayRecord.out_time === null
      ) {
        // Marking the in time
        const intime = moments().tz("Asia/Kolkata").format("HH:mm:ss");
        todayRecord.in_time = intime;
        await todayRecord.save();

        await db.logs.create({
          user_id: logid,
          api: `Mark Attendance`,
          message: "Success - In time marked",
          data: JSON.stringify(todayRecord),
          ip: logip,
          date: dateStrings,
          time: timeStrings,
        });

        return res.json({ success: true, record: todayRecord });
      } else {
        return res.status(400).json({
          success: false,
          message: "Attendance already fully marked for today.",
        });
      }
    } else {
      // Create a new attendance record if none exists
      const intime = moments().tz("Asia/Kolkata").format("HH:mm:ss");

      const newAttendanceRecord = await db.attendances.create({
        user_id: id,
        date: today,
        in_time: intime,
        out_time: null,
      });

      await findId(logid, "Mark attendance");
      await db.logs.create({
        user_id: logid,
        api: `Mark Attendance`,
        message: "Success - New record created",
        data: JSON.stringify(newAttendanceRecord),
        ip: logip,
        date: dateStrings,
        time: timeStrings,
      });

      return res.json({ success: true, record: newAttendanceRecord });
    }
  } catch (error) {
    console.error(error);
    await db.logs.create({
      user_id: logid,
      api: `Mark Attendance`,
      message: "Failed",
      data: JSON.stringify(error.message || "Failed Attendance"),
      ip: logip,
      date: dateStrings,
      time: timeStrings,
    });
    return res.status(500).json({
      success: false,
      message: "An error occurred while marking attendance.",
    });
  }
};

// const UnmarkAttendance = async (req, res) => {
//     const { id } = req.params;
//     const { logid, logip } = req.body; // Access logid and logip from req.body
//     let dateString, timeStrings;

//     try {
//         const outtime = moment();
//         const timeString = outtime.format('HH:mm:ss');

//         const latestRecord = await db.attendances.findOne({
//             where: { user_id: id },
//             order: [['date', 'DESC'], ['id', 'DESC']]
//         });

//         if (!latestRecord) {
//             return res.status(404).json({ success: false, message: "Attendance record not found" });
//         }

//         const [updatedRows] = await db.attendances.update(
//             { out_time: timeString },
//             { where: { id: latestRecord.id } }
//         );

//         if (updatedRows === 0) {
//             return res.status(500).json({ success: false, message: "Failed to update attendance record" });
//         }

//         const updatedRecord = await db.attendances.findOne({
//             where: { id: latestRecord.id }
//         });

//         const recordDate = updatedRecord.date;
//         console.log("Record Date:", recordDate);

//         const inTimeString = `${recordDate}T${convertTo24Hour(updatedRecord.in_time)}`;
//         const outTimeString = `${recordDate}T${convertTo24Hour(timeString)}`;

//         console.log("In Time String:", inTimeString);
//         console.log("Out Time String:", outTimeString);

//         const inTime = moment(inTimeString);
//         const outTime = moment(outTimeString);

//         if (!inTime.isValid() || !outTime.isValid()) {
//             return res.status(400).json({ success: false, message: "Invalid date or time format" });
//         }

//         const diffMs = outTime.diff(inTime);
//         const diffHours = diffMs / (1000 * 60 * 60);

//         let status = '';
//         if (diffHours > 6) {
//             status = 'Present';
//         } else if (diffHours <= 6 && diffHours >= 4) {
//             status = 'Halfday';
//         } else {
//             status = 'Absent';
//         }

//         await db.attendances.update(
//             { status },
//             { where: { id: latestRecord.id } }
//         );

//         const currentDate = new Date();
//         dateString = currentDate.toISOString().split('T')[0];
//         timeStrings = currentDate.toTimeString().split(' ')[0];

//         await db.logs.create({
//             user_id: logid,
//             api: `Logout Attendance`,
//             message: "Success",
//             data: JSON.stringify("Success"),
//             ip: logip,
//             date: dateString,
//             time: timeStrings,
//         });

//         return res.json({ success: true, record: { ...updatedRecord.toJSON(), status } });
//     } catch (error) {
//         console.error("Error updating attendance:", error);
//         await db.logs.create({
//             user_id: logid,
//             api: `Logout Attendance`,
//             message: "Failed",
//             data: JSON.stringify("Error occurred"),
//             ip: logip,
//             date: dateString || new Date().toISOString().split('T')[0],
//             time: timeStrings || new Date().toTimeString().split(' ')[0],
//         });
//         return res.status(500).json({ success: false, message: "An error occurred while updating attendance" });
//     }
// };

const UnmarkAttendance = async (req, res) => {
  const { id } = req.params;
  const { logid, logip } = req.body; // Access logid and logip from req.body
  let dateString, timeStrings;

  try {
    // Set `outtime` to the current time in IST
    const outtime = moment().tz("Asia/Kolkata");
    const timeString = outtime.format("HH:mm:ss");

    const latestRecord = await db.attendances.findOne({
      where: { user_id: id },
      order: [
        ["date", "DESC"],
        ["id", "DESC"],
      ],
    });

    if (!latestRecord) {
      return res
        .status(404)
        .json({ success: false, message: "Attendance record not found" });
    }

    const [updatedRows] = await db.attendances.update(
      { out_time: timeString },
      { where: { id: latestRecord.id } }
    );

    if (updatedRows === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to update attendance record",
      });
    }

    const updatedRecord = await db.attendances.findOne({
      where: { id: latestRecord.id },
    });

    const recordDate = updatedRecord.date;
    console.log("Record Date:", recordDate);

    const inTimeString = `${recordDate}T${convertTo24Hour(
      updatedRecord.in_time
    )}`;
    const outTimeString = `${recordDate}T${convertTo24Hour(timeString)}`;

    console.log("In Time String:", inTimeString);
    console.log("Out Time String:", outTimeString);

    const inTime = moment(inTimeString);
    const outTime = moment(outTimeString);

    if (!inTime.isValid() || !outTime.isValid()) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid date or time format" });
    }

    const diffMs = outTime.diff(inTime);
    const diffHours = diffMs / (1000 * 60 * 60);

    let status = "";
    if (diffHours > 6) {
      status = "Present";
    } else if (diffHours <= 6 && diffHours >= 4) {
      status = "Halfday";
    } else {
      status = "Absent";
    }

    await db.attendances.update({ status }, { where: { id: latestRecord.id } });

    const currentDate = moment().tz("Asia/Kolkata");
    dateString = currentDate.format("YYYY-MM-DD");
    timeStrings = currentDate.format("HH:mm:ss");

    await findId(logid, "logout attendance");
    await db.logs.create({
      user_id: logid,
      api: `Logout Attendance`,
      message: "Success",
      data: JSON.stringify("Success"),
      ip: logip,
      date: dateString,
      time: timeStrings,
    });

    return res.json({
      success: true,
      record: { ...updatedRecord.toJSON(), status },
    });
  } catch (error) {
    console.error("Error updating attendance:", error);
    await db.logs.create({
      user_id: logid,
      api: `Logout Attendance`,
      message: "Failed",
      data: JSON.stringify("Error occurred"),
      ip: logip,
      date: dateString || moment().tz("Asia/Kolkata").format("YYYY-MM-DD"),
      time: timeStrings || moment().tz("Asia/Kolkata").format("HH:mm:ss"),
    });
    return res.status(500).json({
      success: false,
      message: "An error occurred while updating attendance",
    });
  }
};

const Getattendance = async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const month = parseInt(req.query.month, 10) || null;
  const year = parseInt(req.query.year, 10) || null;
  const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
  const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
  const status = req.query.status || null;
  const offset = (page - 1) * limit;

  try {
    const where = { user_id: id };

    const conditions = [];

    conditions.push({ in_time: { [Op.ne]: null } });

    if (month) {
      conditions.push(
        Sequelize.where(Sequelize.fn("MONTH", Sequelize.col("date")), month)
      );
    }
    if (year) {
      conditions.push(
        Sequelize.where(Sequelize.fn("YEAR", Sequelize.col("date")), year)
      );
    }
    if (startDate) {
      conditions.push({ date: { [Op.gte]: startDate } });
    }
    if (endDate) {
      conditions.push({ date: { [Op.lte]: endDate } });
    }
    if (status) {
      conditions.push({ status });
    }

    if (conditions.length > 0) {
      where[Op.and] = conditions;
    }

    const user = await db.attendances.findAndCountAll({
      where,
      offset,
      limit,
      order: [["date", "DESC"]],
    });
    const count = await db.attendances.count({
      where: {
        user_id: id,
        in_time: { [Op.ne]: null },
      },
    });
    res.json({
      totalCount: user.count,
      data: user.rows,
      count,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const viewGetattendance = async (req, res) => {
  const { id } = req.params;

  try {
    const startDate = moment().subtract(7, "days").startOf("day").toDate();
    const endDate = moment().endOf("day").toDate();

    const where = {
      user_id: id,
      date: {
        [Op.between]: [startDate, endDate],
      },
    };

    const user = await db.attendances.findAndCountAll({
      where,
      order: [["date", "DESC"]],
    });

    res.json({
      totalCount: user.count,
      data: user.rows,
    });
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  findemployeedetail,
  userattendance,
  MarkAttendance,
  UnmarkAttendance,
  Getattendance,
  viewGetattendance,
};
