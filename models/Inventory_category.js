module.exports = (sequelize, DataTypes) => {
    const Inventory_category = sequelize.define('Inventory_category', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        category_name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM,
            values: ['0', '1'],
            allowNull: false,  
            defaultValue: '0', 
          },
          
    }, {
        tableName: 'inventory_category',
        timestamps: false,
    });

    Inventory_category.associate = (models) => {
        Inventory_category.hasMany(models.Inventory, {
            foreignKey: 'category', // Matches the `category` field in `Inventory`
            as: 'Inventories',      // Alias for the reverse association
        });
    };

    return Inventory_category;
};
