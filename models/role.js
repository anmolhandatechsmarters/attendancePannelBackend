module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define('roles', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false, 
    },
  }, {
    tableName: 'roles',
    timestamps: false,
  });

  Role.associate = (models) => {
    Role.hasMany(models.users, { foreignKey: 'role', as: 'roleDetails' });
  };

  return Role;
};
