module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    "notification",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      allow_notifcation: {
        type: DataTypes.STRING,
        allowNull: true,
        default: false,
      },
      fcm_token: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      tableName: "notification",
      timestamps: false,
    }
  );

  return Notification;
};
