module.exports = (sequelize, DataTypes) => {
  const Inventory = sequelize.define(
    "Inventory",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      category: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "inventory_category",
          key: "id",
        },
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
          min: 0, // Ensures quantity cannot be negative
        },
      },
      purchase_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        defaultValue: null, // Ensure the default is NULL
      },
      expiry_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        defaultValue: null, // Ensure the default is NULL
      },
      product_image: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      brand_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      asign_item: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
          min: 0, // Ensure asign_item cannot be negative
        },
      },
    },
    {
      tableName: "inventory",
      timestamps: true,
    }
  );

  Inventory.associate = (models) => {
    Inventory.belongsTo(models.Inventory_category, {
      foreignKey: "category",
      as: "Category",
    });
  };

  return Inventory;
};
