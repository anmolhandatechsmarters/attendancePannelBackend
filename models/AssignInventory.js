module.exports=(sequelize,DataTypes)=>{
const AssignInventory=sequelize.define('assign_inventory',{
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
    emp_id:{
        type:DataTypes.STRING,
        references: {
            model: 'users',
            key: 'emp_id',
          },
        require:true,

    },
    assign_inventory:{
            type:DataTypes.JSON,
            require:true
    }
},{
    tableName:"assign_inventory",
    timestamps:true,
});
AssignInventory.associate = models => {
    AssignInventory.belongsTo(models.users, { foreignKey: 'emp_id', as: 'userDetails' });
  };
return AssignInventory
}
