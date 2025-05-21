module.exports = (sequelize, DataTypes) => {
  const Attendance = sequelize.define(
    "attendances",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        references: {
          model: "users",
          key: "id",
        },
      },
      in_time: DataTypes.TIME,
      out_time: DataTypes.TIME,
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      comment: DataTypes.TEXT,
      status: {
        type: DataTypes.ENUM(
          "Present",
          "Absent",
          "Halfday",
          "Pending",
          "Leave"
        ),
      },
      leaveid: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "attendances",
      timestamps: false,
    }
  );

  Attendance.associate = (models) => {
    Attendance.belongsTo(models.users, {
      foreignKey: "user_id",
      as: "userDetails",
    });
  };

  return Attendance;
};
