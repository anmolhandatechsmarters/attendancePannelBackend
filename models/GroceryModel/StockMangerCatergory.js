module.exports=(sequelize,DataTypes)=>{
    const Stock =sequelize.define('stock_category',{
        id:{
            type:DataTypes.INTEGER,
            primaryKey:true,
            autoIncrement:true
        },
        category_name:{
            type:DataTypes.STRING,
            required:true
        },
    },{
        tableName:"stock_category",
        timeStamps:true
    })



    return Stock
}