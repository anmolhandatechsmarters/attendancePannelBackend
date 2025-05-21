const bcrypt = require('bcrypt');

exports.seed = async function(knex) {
  await knex('users').del();
  await knex('roles').del();
  await knex('inventory_category').del();

  await knex('roles').insert([
    { id: 1, role: 'Admin' },
    { id: 2, role: 'HR' },
    { id: 3, role: 'Employee' }
  ]);

  await knex('stock_category').insert([
    {
      id: 1,
      category_name: 'Kitchen',
      createdAt: new Date(), 
      updatedAt: new Date(), 
    },
    {
      id: 2,
      category_name: 'Washroom',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  


await knex('inventory_category').insert([
  {id:1,category_name:'laptop'},
  {id:2,category_name:'Pc'},
  {id:3,category_name:'Keyboard'},
  {id:4,category_name:'Mouse'},
  {id:5,category_name:'Mobiles'},
  {id:6,category_name:'Monitor'},
  {id:7,category_name:'Mac mini'},
  {id:8,category_name:'CPU'},
  {id:9,category_name:'Window Laptop'},
  {id:10,category_name:'Macbook'},
  {id:11,category_name:'Apple TV'},
  {id:12,category_name:"LED's"},
  {id:13,category_name:"Extensions"},
  {id:14,category_name:'type C cables'},
  {id:15,category_name:'Connectors (VGA to C)'},
  {id:16,category_name:'Tables(workstation)'},
  {id:17,category_name:'Chairs(workstation)'},
  {id:18,category_name:'Tables (management)'},
  {id:19,category_name:'Dustbins(steels)'},
  {id:20,category_name:'Fancy Hanging Lights'},
  {id:21,category_name:'Cameras'},
  {id:22,category_name:'Lockers(deck)'},
  {id:23,category_name:'Router'},
  {id:24,category_name:'UPS'},
  {id:25,category_name:'UPS Batteries'},
  {id:26,category_name:'Numbering Wire'},
  {id:27,category_name:'Network Wire'},
  {id:28,category_name:'LAN Wires'},
  {id:29,category_name:'Single LAN'},
  {id:30,category_name:'Double LAN'},
  {id:31,category_name:'LAN Connector Box'},
  {id:32,category_name:'CAT C connection Hardware'},
  {id:33,category_name:'Printer'},

])

  const hashedPassword = await bcrypt.hash('admin', 10);

  
  await knex('users').insert([
    {
      email: 'admin@gmail.com',
      emp_id: 'admin',
      first_name: 'Admin',
      last_name: 'Lastname',
      street1: '123 Main St',
      street2: 'Apt 4B',
      city: 3237,
      state: 32,
      country: 101,
      role: 1,
      status: '1',
      user_agent: 'Mozilla/5.0',
      ip: '192.168.1.1',
      created_by: 'admin',
      password: hashedPassword 
    }
  ]);

  console.log('Seed data inserted successfully.');
};
