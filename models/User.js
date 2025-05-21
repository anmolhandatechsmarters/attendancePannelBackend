module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "users",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      emp_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      first_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      middle_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      last_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      street1: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      street2: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      date_of_joining: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      contact_no: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      personal_email: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      department_id: {
        type: DataTypes.INTEGER,
        references: {
          model: "departments",
          key: "id",
        },
      },
      designation_id: {
        type: DataTypes.INTEGER,
        references: {
          model: "designations",
          key: "id",
        },
      },
      city: {
        type: DataTypes.INTEGER,
        references: {
          model: "cities",
          key: "id",
        },
      },
      state: {
        type: DataTypes.INTEGER,
        references: {
          model: "states",
          key: "id",
        },
      },
      country: {
        type: DataTypes.INTEGER,
        references: {
          model: "countries",
          key: "id",
        },
      },
      role: {
        type: DataTypes.INTEGER,
        references: {
          model: "roles",
          key: "id",
        },
      },
      aadharcard: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      pancard: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bankaccount: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      ifsc_code: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      account_holder_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("0", "1"),
        defaultValue: "0",
      },
      last_login: DataTypes.DATE,
      user_agent: DataTypes.STRING,
      ip: DataTypes.STRING,
      created_on: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_on: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        onUpdate: DataTypes.NOW,
      },
      created_by: DataTypes.STRING,
      password: DataTypes.STRING,
      image: {
        type: DataTypes.STRING,
        defaultValue: "uploads/default.jpeg",
      },
      // assign_item: {
      //   type: DataTypes.JSON,  // Change from JSON to INTEGER
      // },
      token: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "users",
      timestamps: false,
    }
  );

  User.associate = (models) => {
    User.belongsTo(models.cities, { foreignKey: "city", as: "cityDetails" });
    User.belongsTo(models.states, { foreignKey: "state", as: "stateDetails" });
    User.belongsTo(models.countries, {
      foreignKey: "country",
      as: "countryDetails",
    });
    User.belongsTo(models.roles, { foreignKey: "role", as: "roleDetails" });
    User.belongsTo(models.departments, {
      foreignKey: "department_id",
      as: "departmentDetails",
    });
    User.belongsTo(models.designations, {
      foreignKey: "designation_id",
      as: "designationDetails",
    });
    User.hasMany(models.attendances, {
      foreignKey: "user_id",
      as: "attendances",
    });
  };

  return User;
};
