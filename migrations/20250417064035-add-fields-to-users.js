"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      const userTable = await queryInterface.describeTable("users");
   

      if (!userTable.date_of_joining) {
        await queryInterface.addColumn("users", "date_of_joining", {
          type: Sequelize.DATEONLY,
          allowNull: true,
        });
      }

      if (!userTable.contact_no) {
        await queryInterface.addColumn("users", "contact_no", {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }



      if (!userTable.personal_email) {
        await queryInterface.addColumn("users", "personal_email", {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }

      if (!userTable.middle_name) {
        await queryInterface.addColumn("users", "middle_name", {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }
    } catch (error) {
      console.error("Migration UP Error:", error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      const userTable = await queryInterface.describeTable("users");
      const attendanceTable = await queryInterface.describeTable("attendances"); // ✅ FIXED

      if (userTable.date_of_joining) {
        await queryInterface.removeColumn("users", "date_of_joining");
      }

      if (userTable.contact_no) {
        await queryInterface.removeColumn("users", "contact_no");
      }

      if (attendanceTable.leaveid) {
        await queryInterface.removeColumn("attendances", "leaveid"); // ✅ FIXED
      }

      if (userTable.personal_email) {
        await queryInterface.removeColumn("users", "personal_email");
      }

      if (userTable.middle_name) {
        await queryInterface.removeColumn("users", "middle_name");
      }
    } catch (error) {
      console.error("Migration DOWN Error:", error);
      throw error;
    }
  },
};
