const db = require("../Connection");
const { generateOTP } = require("../utils/otpUtils");
const { sendPasswordResetEmail } = require("../services/emailService");
const jwt = require("jsonwebtoken");
const { Parser } = require("json2csv");
const { Op } = require("sequelize");
const Sequelize = require("sequelize");
const { generateToken, generateRefreshToken } = require("../middleware/token");
let otpStore = {};

const bcrypt = require("bcrypt");

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};
const createUser = async (req, res) => {
  const {
    email,
    first_name,
    last_name,
    street1,
    street2,
    city,
    state,
    country,
    role: roleName,
    status = "0",
    last_login = new Date(),
    user_agent,
    ip,
    created_on = new Date(),
    updated_on = new Date(),
    created_by = "Admin",
    password,
  } = req.body;

  if (
    !email ||
    !first_name ||
    !last_name ||
    !street1 ||
    !city ||
    !state ||
    !country ||
    !password
  ) {
    return res.status(400).json({ message: "Required fields are missing." });
  }

  const roleMappings = {
    Admin: 1,
    HR: 2,
    Employee: 3,
  };

  const roleId = roleMappings[roleName];
  if (!roleId) {
    return res
      .status(400)
      .json({
        message: "Invalid role provided. Valid roles are Admin, HR, Employee.",
      });
  }

  try {
    await db.sequelize.transaction(async (transaction) => {
      const [result] = await db.sequelize.query(
        "SELECT MAX(CAST(SUBSTRING(emp_id, 4) AS UNSIGNED)) AS max_id FROM users",
        { transaction }
      );
      const maxId = result[0].max_id || 0;
      const newEmpId = `Emp${maxId + 1}`;

      await db.users.create(
        {
          email,
          emp_id: newEmpId,
          first_name,
          last_name,
          street1,
          street2,
          city,
          state,
          country,
          role: roleId,
          status,
          last_login,
          user_agent,
          ip,
          created_on,
          updated_on,
          created_by,
          password,
        },
        { transaction }
      );
    });

    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Error creating user:", error);
    res
      .status(500)
      .json({ message: "Error occurred while creating user", error });
  }
};

const loginUser = async (req, res) => {
  const { email, password ,fcmtoken} = req.body;
  const ip = req.query.ip;
  const userAgent = req.query.userAgent;
  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await db.users.findOne({
      where: { email, status: "1" },
      include: [
        { model: db.roles, as: "roleDetails", attributes: ["id", "role"] },
      ],
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate token and refresh token
    const token = generateToken(user.id, user.roleDetails.role);
    const refreshToken = await generateRefreshToken(
      user.id,
      user.roleDetails.role
    );

    // Decode the token to get the expiry time
    const decodedToken = jwt.decode(token);
    const expiryTime = decodedToken.exp * 1000; // Convert to milliseconds

    // Update user login details in the database
    await db.users.update(
      { last_login: new Date(), ip, user_agent: userAgent, token },
      { where: { id: user.id } }
    );

    // Log the successful login
    await db.logs.create({
      user_id: user.id,
      api: `Login User`,
      message: "Success",
      data: JSON.stringify(user),
      ip: ip,
      date: dateString,
      time: timeString,
    });
    
   if(fcmtoken){
    let fcmtokenRecord = await db.Notification.findOne({ where: { userId: user.id }});
    if(fcmtokenRecord){
        fcmtokenRecord.fcm_token = fcmtoken;
        await fcmtokenRecord.save();
    } else {
        fcmtokenRecord = await db.Notification.create({
             userId: user.id,
             fcm_token: fcmtoken,
        });
    }
   }
    

    // Send the response with token, refresh token, and expiry time
    res.status(200).json({
      success: true,
      token,
      refreshtoken: refreshToken,
      expiryTime: jwt.decode(token).exp * 1000, 
      user: {
        email: user.email,
        id: user.id,
        role: user.roleDetails.role,
      },
    });
  } catch (error) {
    console.error("Internal server error:", error);

    // Uncomment if you want to log failed attempts
    // await db.logs.create({
    //   user_id: user.id,
    //   api: `Login User`,
    //   message: "Failed",
    //   data: JSON.stringify(user),
    //   ip: ip,
    //   date: dateString,
    //   time: timeString,
    // });

    res.status(500).json({ message: "Internal server error" });
  }
};

const logoutUser = async (req, res) => {
  const userId = req.params.id;
  const logip = req.query.logip;

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    await db.logs.create({
      user_id: userId,
      api: `Logout User`,
      message: "Success",
      data: JSON.stringify(userId),
      ip: logip || "0:0:0:0",
      date: dateString,
      time: timeString,
    });

    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Internal server error:", error);

    await db.logs.create({
      user_id: userId,
      api: `Logout User`,
      message: "Failed",
      data: JSON.stringify(userId),
      ip: logip || "0000",
      date: dateString,
      time: timeString,
    });

    res.status(500).json({ message: "Internal server error" });
  }
};

const totalUserCount = async (req, res) => {
  try {
    const [result] = await db.sequelize.query(
      "SELECT COUNT(*) AS count FROM users WHERE id <> 1 AND role <> 1"
    );
    res.status(200).send(result[0].count.toString());
  } catch (error) {
    console.error("Error fetching total user count:", error);
    res.status(500).send("Error occurred");
  }
};

const activeUserCount = async (req, res) => {
  try {
    const [result] = await db.sequelize.query(
      "SELECT COUNT(*) AS user_active FROM users WHERE status = '1'  AND role <> 1"
    );
    res.status(200).send(result[0].user_active.toString());
  } catch (error) {
    console.error("Error fetching active user count:", error);
    res.status(500).send("Server Error");
  }
};

const inactiveUserCount = async (req, res) => {
  try {
    const [result] = await db.sequelize.query(
      "SELECT COUNT(*) AS user_inactive FROM users WHERE status = '0'  AND role <> 1"
    );
    res.status(200).send(result[0].user_inactive.toString());
  } catch (error) {
    console.error("Error fetching inactive user count:", error);
    res.status(500).send("Server Error");
  }
};


const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await db.users.findOne({ where: { email } });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "No user found with that email." });
    }

    const otp = generateOTP();
    otpStore[email] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };

    const success = await sendPasswordResetEmail(email, otp);

    if (!success) {
      return res
        .status(500)
        .json({ success: false, message: "Error sending email." });
    }

    return res.json({
      success: true,
      message: "Email sent successfully. Please check your email.",
    });
  } catch (error) {
    console.error("Error during password reset request:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};

const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const otpRecord = otpStore[email];

    if (!otpRecord) {
      return res
        .status(400)
        .json({ success: false, message: "OTP not found or expired." });
    }

    if (Date.now() > otpRecord.expiresAt) {
      delete otpStore[email];
      return res
        .status(400)
        .json({ success: false, message: "OTP has expired." });
    }

    if (otp !== otpRecord.otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    const token = jwt.sign(
      { email },
      process.env.JWT_SECRET || "defaultsecret",
      { expiresIn: "1h" }
    );
    delete otpStore[email];

    return res.json({
      success: true,
      token,
      message: "OTP verified successfully.",
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};
const updatePassword = async (req, res) => {
  const { email, newPassword } = req.body;
  const logip = req.query.logip || req.ip || "0000";

  try {
    if (!email || !newPassword) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Email and new password must be provided.",
        });
    }

    const user = await db.users.findOne({
      where: { email },
      attributes: ["id"],
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const hashedPassword = await hashPassword(newPassword);

    const [updateCount] = await db.users.update(
      { password: hashedPassword },
      { where: { email } }
    );

    if (updateCount === 0) {
      return res
        .status(500)
        .json({ success: false, message: "Password update failed." });
    }

    const currentDate = new Date();
    const dateString = currentDate.toISOString().split("T")[0];
    const timeString = currentDate.toTimeString().split(" ")[0];

    await db.logs.create({
      user_id: user.id,
      api: `Forget Password`,
      message: "Success",
      data: JSON.stringify(user.id),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    return res.json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error) {
    console.error("Error updating password:", error);
    await db.logs.create({
      user_id: user.id,
      api: `Forget Password`,
      message: "Failed",
      data: JSON.stringify(user.id),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};

const verifyForgetPasswordToken = (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "No token provided." });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET || "defaultsecret");
    res.json({ success: true });
  } catch (error) {
    console.error("Error verifying token:", error);
    res
      .status(401)
      .json({ success: false, message: "Invalid or expired token." });
  }
};

const downloadattendanceuser = async (req, res) => {
  const userId = req.params.id;

  if (!userId) {
    return res.status(400).send("User ID is required.");
  }

  try {
    const results = await db.attendances.findAll({
      include: [
        {
          model: db.users,
          as: "userDetails",
          attributes: ["first_name", "last_name", "email"],
          required: true,
        },
      ],
      where: {
        user_id: userId,
      },
    });

    if (results.length === 0) {
      return res.status(404).send("No attendance records found for this user.");
    }

    const transformedResults = results.map((item) => {
      const attendance = item.get({ plain: true });
      const user = attendance.userDetails;
      return {
        in_time: attendance.in_time,
        out_time: attendance.out_time,
        date: attendance.date,
        comment: attendance.comment,
        status: attendance.status,
        fullname: `${user.first_name} ${user.last_name}`,
        email: user.email,
      };
    });

    const csv = new Parser().parse(transformedResults);

    res.header("Content-Type", "text/csv");
    res.attachment("Attendance.csv");
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error querying the database");
  }
};

//===============================\

const userprofileget = async (req, res) => {
  const id = req.params.id; // Get the user ID from the URL
  const logid = req.query.logid; // Get the logged-in user ID from query parameters

  console.log(logid);

  // Ensure the user ID is provided
  if (!id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  // Check if the logged-in user is trying to access their own profile
  if (logid !== id) {
    try {
      // Fetch user profile details excluding the password
      const result = await db.users.findAll({
        where: { id: logid },
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
          "image",
          "department_id",
          "designation_id",
          [Sequelize.col("roleDetails.role"), "role"],
          [Sequelize.col("departmentDetails.department_name"), "department"],
          [Sequelize.col("designationDetails.designation_name"), "designation"],
        ],
        include: [
          {
            model: db.roles,
            as: "roleDetails",
            attributes: ["role"],
          },
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
      });

      return res.status(200).json(result); // Return user data without the password
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "An error occurred while fetching the user profile" });
    }
  }

  // If the logged-in user is trying to access their own profile, include additional fields, but **do not include the password**
  try {
    const result = await db.users.findAll({
      where: { id: id },
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
        "image",
        "department_id",
        "designation_id",
        // Exclude the password from the response
        [Sequelize.col("roleDetails.role"), "role"],
        [Sequelize.col("departmentDetails.department_name"), "department"],
        [Sequelize.col("designationDetails.designation_name"), "designation"],
      ],
      include: [
        {
          model: db.roles,
          as: "roleDetails",
          attributes: ["role"],
        },
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
    });

    if (result.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(result); // Return user data excluding password
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "An error occurred while fetching the user profile" });
  }
};

const checkuserid = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await db.users.findOne({
      where: {
        [Op.or]: [{ id: id }, { emp_id: id }],
      },
    });

    if (user) {
      return res.json({ exists: true });
    } else {
      return res.json({ exists: false });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const GraphData = async (req, res) => {
  const { startdate, enddate } = req.query;

  // Validate that both startdate and enddate are provided
  if (!startdate || !enddate) {
    return res
      .status(400)
      .json({ message: "Start date and end date are required." });
  }

  // Log the incoming date values
  console.log("Received startdate:", startdate);
  console.log("Received enddate:", enddate);

  try {
    const start = new Date(startdate);
    const end = new Date(enddate);

    // Validate the created Date objects
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return res.status(400).json({ message: "Invalid date range." });
    }

    // Fetch attendance data for users within the specified date range
    const attendanceCounts = await db.attendances.findAll({
      where: {
        date: { [Op.between]: [start, end] },
        status: { [Op.or]: ["Present", "Absent"] },
      },
      attributes: [
        [
          db.Sequelize.fn("DATE_FORMAT", db.Sequelize.col("date"), "%Y-%m-%d"),
          "date",
        ],
        "status",
        [db.Sequelize.fn("COUNT", db.Sequelize.col("status")), "count"],
      ],
      group: ["date", "status"],
    });

    const attendanceData = {};
    attendanceCounts.forEach((record) => {
      const { date, status, count } = record;
      if (!attendanceData[date]) {
        attendanceData[date] = { present: 0, absent: 0 };
      }
      attendanceData[date][status.toLowerCase()] = count;
    });

    // Count total users
    const totalUsers = await db.users.count();

    // Prepare response data
    res.json({
      data: attendanceData,
      totalUsers: totalUsers,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const graphuser = async (req, res) => {
  const month = parseInt(req.query.month);
  const year = parseInt(req.query.year);

  if (!month || !year || month < 1 || month > 12) {
    return res.status(400).json({ error: "Invalid month or year" });
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  try {
    const userCount = await db.users.count({
      where: {
        status: "1",
        role: {
          [Op.or]: [2, 3],
        },
      },
    });

    const attendanceRecords = await db.attendances.findAll({
      where: {
        date: {
          [Op.between]: [startDate, endDate],
        },
      },
    });

    const leaveRecords = await db.applyleave.findAll({
      where: {
        status: "Approved",
        [Op.or]: [
          {
            start_date: {
              [Op.between]: [startDate, endDate],
            },
          },
          {
            end_date: {
              [Op.between]: [startDate, endDate],
            },
          },
          {
            [Op.and]: [
              { start_date: { [Op.lte]: startDate } },
              { end_date: { [Op.gte]: endDate } },
            ],
          },
        ],
      },
    });

    const recordsMap = attendanceRecords.reduce((acc, record) => {
      const recordDate = new Date(record.date).toISOString().split("T")[0];
      acc[recordDate] = acc[recordDate] || { present: 0, absent: 0 };

      if (record.status === "Present") {
        acc[recordDate].present += 1;
      } else if (record.status === "Absent") {
        acc[recordDate].absent += 1;
      }
      return acc;
    }, {});

    const leaveMap = leaveRecords.reduce((acc, record) => {
      const start = new Date(record.start_date);
      const end = new Date(record.end_date);

      for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
        const recordDate = new Date(d).toISOString().split("T")[0];
        acc[recordDate] = acc[recordDate] || { leave: 0 };
        acc[recordDate].leave += 1;
      }
      return acc;
    }, {});

    const dateLabels = [];
    for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
      dateLabels.push(new Date(d).getDate().toString().padStart(2, "0"));
    }

    const presentCounts = dateLabels.map((day) => {
      const fullDate = `${year}-${month.toString().padStart(2, "0")}-${day}`;
      return recordsMap[fullDate]?.present || 0;
    });

    const absentCounts = dateLabels.map((day) => {
      const fullDate = `${year}-${month.toString().padStart(2, "0")}-${day}`;
      return recordsMap[fullDate]?.absent || 0;
    });

    const leaveCounts = dateLabels.map((day) => {
      const fullDate = `${year}-${month.toString().padStart(2, "0")}-${day}`;
      return leaveMap[fullDate]?.leave || 0;
    });

    console.log({
      userCount,
      dateLabels,
      presentCounts,
      absentCounts,
      leaveCounts,
    });

    res.json({
      userCount,
      dateLabels,
      presentCounts,
      absentCounts,
      leaveCounts,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred" });
  }
};


const tokendata = async (req, res) => {
  try {
    const id = req.params.id;
    
    // Check if id is provided
    if (!id) {
      return res.json({ message: "ID is required" });
    }

    // Fetch user by ID
    const user = await db.users.findOne({
      where: { id },
      attributes: ['last_login']  
    });

    // Check if user exists
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Send the last_login value in the response
    return res.json({ last_login: user.last_login });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "An error occurred", error: error.message });
  }
};




//===========================
module.exports = {
  createUser,
  loginUser,
  logoutUser,
  totalUserCount,
  activeUserCount,
  inactiveUserCount,
  forgotPassword,
  verifyOTP,
  verifyForgetPasswordToken,
  updatePassword,
  downloadattendanceuser,
  userprofileget,
  checkuserid,
  GraphData,
  graphuser,tokendata
};
