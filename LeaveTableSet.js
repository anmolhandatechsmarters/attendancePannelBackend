const db = require("./Connection.js");
const moment = require("moment");
const { Op } = require("sequelize");

const checkLeaveTable = async () => {
  try {
    const today = moment().startOf("day").format("YYYY-MM-DD");

    const leaves = await db.applyleave.findAll({
      where: {
        status: "Approved",
        [Op.or]: [
          { start_date: { [Op.eq]: today } },
          { end_date: { [Op.eq]: today } },
          {
            [Op.and]: [
              { start_date: { [Op.lte]: today } },
              { end_date: { [Op.gte]: today } },
            ],
          },
        ],
      },
    });

    if (leaves.length > 0) {
      for (const leave of leaves) {
        const existingAttendance = await db.attendances.findOne({
          where: {
            user_id: leave.user_id,
            date: today,
          },
        });

        if (!existingAttendance) {
          await db.attendances.create({
            user_id: leave.user_id,
            date: today,
            status: "Leave",
            leaveid: leave.id, // Store leave.id into attendance.leaveid
          });

        //   console.log(
        //     `Attendance record created for user_id ${leave.user_id} on ${today} with leaveid ${leave.id}`
        //   );
        } else {
        //   console.log(
        //     `Attendance already exists for user_id ${leave.user_id} on ${today}`
        //   );
        }
      }
    //   console.log(`Checked attendance for ${leaves.length} users on ${today}`);
    } else {
    //   console.log("No leave records found for today.");
    }
  } catch (error) {
    console.error("Error checking leave table:", error);
  }
};

module.exports = checkLeaveTable;
