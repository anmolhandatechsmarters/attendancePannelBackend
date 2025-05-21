'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const attendanceTable = await queryInterface.describeTable("attendances");

    if (!attendanceTable.leaveid) {
      await queryInterface.addColumn("attendances", "leaveid", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const attendanceTable = await queryInterface.describeTable("attendances");

    if (attendanceTable.leaveid) {
      await queryInterface.removeColumn("attendances", "leaveid");
    }
  }
};
