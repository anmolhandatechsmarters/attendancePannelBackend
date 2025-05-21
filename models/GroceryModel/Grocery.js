module.exports = (sequelize, DataTypes) => {
    const GroceryTable = sequelize.define('GroceryTable', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        category: {
            type: DataTypes.INTEGER,
            references: {
                model: 'stock_category',
                key: 'id',
            },
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 0,
            },
        },
        unit_price: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        total_price: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        purchase_date: {
            type: DataTypes.DATEONLY,
            allowNull: true,
            defaultValue: null, // Set default value to null
        },
        expiry_date: {
            type: DataTypes.DATEONLY,
            allowNull: true,
            defaultValue: null, // Set default value to null
        },
        used_item: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            validate: {
                min: 0,
            },
        },
    }, {
        tableName: "stock_inventory",
        timestamps: true,
    });

    GroceryTable.associate = (models) => {
        GroceryTable.belongsTo(models.StockCategory, {
            foreignKey: 'category',
            as: 'Category',
        });
    };

    return GroceryTable;
};
