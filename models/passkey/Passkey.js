module.exports = (Sequelize, DataTypes) => {
  const PasskeyModel = Sequelize.define(
    "user_passkey",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userid: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      current_challenge: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      // New field to store multiple passkeys (for multiple devices)
      passkeys: {
        type: DataTypes.JSON, // This will be an array of objects
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      tableName: "user_passkey",
      timestamps: true,
    }
  );

  return PasskeyModel;
};
