module.exports = (Sequelize, DataTypes) => {
    const applyleave = Sequelize.define('leave', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        user_id: {
            type: DataTypes.INTEGER,
            references: {
                model: 'users',
                key: 'id',
            },
        },
        apply_date: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        start_date: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        end_date: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        comment: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        type: {
            type: DataTypes.ENUM("Fullday", "Halfday","ShortLeave"),
            allowNull: false,
        },
        handleBy: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        shortOutTime:{
            type: DataTypes.TIME,
            allowNull:true
        },
        shortInTime:{
            type: DataTypes.TIME,
            allowNull:true
        },
        status: {
            type: DataTypes.ENUM("Approved", "Reject"),
            allowNull: true,
        },
    }, {
        tableName: "leave",
        timestamps: true,
    });

    applyleave.associate = models => {
        applyleave.belongsTo(models.users, { foreignKey: 'user_id', as: 'userDetails' });
    };

    return applyleave;
};
