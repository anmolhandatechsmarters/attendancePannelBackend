const cron =require("node-cron")
const checkLeaveTable =require("./LeaveTableSet.js")
cron.schedule('* * * * * *', () => {
   try{
    checkLeaveTable()
   }catch{
    console.log("Not Leave table Working")
   }
  });


module.exports =cron
