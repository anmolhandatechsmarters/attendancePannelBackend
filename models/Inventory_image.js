module.exports=(sequilizer,DataTypes)=>{
    const Product_Image=sequilizer.define('product_image',{
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        image:{
            type:DataTypes.STRING,
            required:true,
        }
        
    },{
        tableName: 'inventory_image',
        timestamps: true,
    });
    return Product_Image
}