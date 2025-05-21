module.exports = (sequelize, DataTypes) => {
  const Designation = sequelize.define('designations', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    designation_name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    }
  }, {
    tableName: 'designations',
    timestamps: true,
  });

  // No direct association here either
  Designation.associate = (models) => {
    // Define associations here if needed
  };

  return Designation;
};
