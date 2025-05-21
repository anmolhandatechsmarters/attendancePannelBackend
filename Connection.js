const { Sequelize, DataTypes } = require("sequelize");
require("dotenv").config();

const requiredEnvVars = [
  "DATABASE_HOST",
  "DATABASE_USER",
  "DATABASE_PASS",
  "DATABASE",
];
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`Environment variable ${varName} is required.`);
    process.exit(1);
  }
});

const sequelize = new Sequelize({
  host: process.env.DATABASE_HOST,
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASS,
  database: process.env.DATABASE,
  dialect: "mysql",
  logging: false,
});

const db = {
  Sequelize,
  sequelize,
  countries: require("./models/country")(sequelize, DataTypes),
  states: require("./models/states")(sequelize, DataTypes),
  cities: require("./models/cities")(sequelize, DataTypes),
  roles: require("./models/role")(sequelize, DataTypes),
  users: require("./models/User")(sequelize, DataTypes),
  attendances: require("./models/attendance")(sequelize, DataTypes),
  logs: require("./models/log")(sequelize, DataTypes),
  departments: require("./models/Department")(sequelize, DataTypes),
  designations: require("./models/Designation")(sequelize, DataTypes),
  applyleave: require("./models/ApplyLeave")(sequelize, DataTypes),
  message: require("./models/Message")(sequelize, DataTypes),
  Inventory: require("./models/Inventory")(sequelize, DataTypes),
  Inventory_category: require("./models/Inventory_category")(
    sequelize,
    DataTypes
  ),
  Inventory_image: require("./models/Inventory_image")(sequelize, DataTypes),
  AssignInventory: require("./models/AssignInventory")(sequelize, DataTypes),
  GroceryInventory: require("./models/GroceryModel/Grocery")(
    sequelize,
    DataTypes
  ),
  StockCategory: require("./models/GroceryModel/StockMangerCatergory")(
    sequelize,
    DataTypes
  ),
  Notification: require("./models/Notification/Notification")(
    sequelize,
    DataTypes
  ),
  PasskeyModel: require("./models/passkey/Passkey")(sequelize, DataTypes),
};

const defineAssociations = () => {
  if (db.users && typeof db.users.associate === "function")
    db.users.associate(db);
  if (db.roles && typeof db.roles.associate === "function")
    db.roles.associate(db);
  if (db.cities && typeof db.cities.associate === "function")
    db.cities.associate(db);
  if (db.states && typeof db.states.associate === "function")
    db.states.associate(db);
  if (db.attendances && typeof db.attendances.associate === "function")
    db.attendances.associate(db);
  if (db.departments && typeof db.departments.associate === "function")
    db.departments.associate(db);
  if (db.designations && typeof db.designations.associate === "function")
    db.designations.associate(db);
  if (db.applyleave && typeof db.applyleave.associate === "function")
    db.applyleave.associate(db);
  if (db.Inventory && typeof db.Inventory.associate === "function")
    db.Inventory.associate(db);
  if (
    db.Inventory_category &&
    typeof db.Inventory_category.associate === "function"
  )
    db.Inventory_category.associate(db);
  if (db.AssignInventory && typeof db.AssignInventory.associate === "function")
    db.AssignInventory.associate(db);
  if (
    db.GroceryInventory &&
    typeof db.GroceryInventory.associate === "function"
  )
    db.GroceryInventory.associate(db);
  if (db.StockCategory && typeof db.StockCategory.associate === "function")
    db.StockCategory.associate(db);
  if (db.Notification && typeof db.Notification.associate === "function")
    db.Notification.associate(db);
  if (db.PasskeyModel && typeof db.PasskeyModel.associate === "function")
    db.Notification.associate(db);
};

defineAssociations();

const connectToDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log(
      "Connection to the database has been established successfully."
    );
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    process.exit(1);
  }
};

connectToDatabase();

module.exports = db;
