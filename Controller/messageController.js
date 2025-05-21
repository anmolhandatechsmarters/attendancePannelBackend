const { type } = require("os");
const db = require("../Connection");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const sequelize = require("sequelize");

const viewoption2 = async (req, res) => {
  const search = req.query.search || "";

  try {
    const users = await db.users.findAll({
      where: {
        [Op.or]: [
          { first_name: { [Op.like]: `%${search}%` } },
          { last_name: { [Op.like]: `%${search}%` } },
          { emp_id: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
        ],
      },
      attributes: ["id", "first_name", "last_name", "emp_id"],
      limit: 20,
    });

    const formattedUsers = users.map((user) => ({
      empid: user.emp_id,
      value: user.id,
      label: `${user.first_name} ${user.last_name} (${user.emp_id})`,
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Some error occurred" });
  }
};
const viewoption = async (req, res) => {
  const search = req.query.search || "";
  const limit = search ? 20 : 2;

  try {
    const users = await db.users.findAll({
      where: {
        emp_id: {
          [Op.not]: "admin",
        },
        [Op.or]: [
          { first_name: { [Op.like]: `%${search}%` } },
          { last_name: { [Op.like]: `%${search}%` } },
          { emp_id: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
        ],
      },
      attributes: ["id", "first_name", "last_name", "emp_id"],
      limit: limit,
    });

    const formattedUsers = users.map((user) => ({
      empid: user.emp_id,
      value: user.id,
      label: `${user.first_name} ${user.last_name} (${user.emp_id})`,
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Some error occurred" });
  }
};

const submitmessage = async (req, res) => {
  const { title, description, startDate, endDate, selectedOptions, status } =
    req.body;
  const logip = req.query.logip;
  const logid = req.query.logid;

  let userList = [];
  if (selectedOptions.includes("all")) {
    userList = ["all"];
  } else {
    userList = selectedOptions;
  }

  let image = null;
  let bgimage = null;

  if (req.files) {
    if (req.files["image"] && !req.files["bgimage"]) {
      image = `messageImage/${req.files["image"][0].filename}`;
    } else if (req.files["bgimage"] && !req.files["image"]) {
      bgimage = `messageImage/${req.files["bgimage"][0].filename}`;
    } else {
      return res.status(400).json({
        error: "Please upload either an image or a background image, not both.",
      });
    }
  }

  try {
    const result = await db.message.create({
      title,
      description,
      image,
      startDate,
      endDate,
      user: userList,
      status,
      bgimage,
    });

    res.json(result);
    const currentDate = new Date();
    const dateString = currentDate.toISOString().split("T")[0];
    const timeString = currentDate.toTimeString().split(" ")[0];
    await db.logs.create({
      user_id: logid,
      api: `Submit Message`,
      message: "Success",
      data: JSON.stringify(result),
      ip: logip,
      date: dateString,
      time: timeString,
    });
  } catch (error) {
    console.error("Error creating message:", error);
    res
      .status(500)
      .json({ error: "An error occurred while creating the message." });
    await db.logs.create({
      user_id: logid,
      api: `Submit Message`,
      message: "Failed",
      data: JSON.stringify(result),
      ip: logip,
      date: dateString,
      time: timeString,
    });
  }
};

// const viewmessage = async (req, res) => {
//   const { id } = req.params; // Extract user ID from request parameters
//   try {
//     // Fetch messages where status is '1', within the date range, and the user exists in the 'user' field
//     let messages = await db.message.findAll({
//       where: {
//         status: '1',
//         startDate: {
//           [db.Sequelize.Op.lte]: new Date(),
//         },
//         endDate: {
//           [db.Sequelize.Op.gte]: new Date(),
//         },
//         // Find messages where the user array contains the given ID
//         user: {
//           [db.Sequelize.Op.and]: [
//             db.Sequelize.where(
//               db.Sequelize.fn('JSON_CONTAINS', db.Sequelize.col('user'), JSON.stringify(id)),
//               true
//             ),
//           ],
//         },
//       },
//     });

//     // Filter messages where 'view' field doesn't include the user ID
//     const filteredMessages = messages.filter(message => {
//       // Ensure view is an array, and then check if the ID exists in the 'view' array
//       return !Array.isArray(message.view) || !message.view.includes(parseInt(id));
//     });

//     // If no messages are found in the first query, look for 'all' users
//     if (filteredMessages.length === 0) {
//       messages = await db.message.findAll({
//         where: {
//           status: '1',
//           startDate: {
//             [db.Sequelize.Op.lte]: new Date(),
//           },
//           endDate: {
//             [db.Sequelize.Op.gte]: new Date(),
//           },
//           // Find messages where 'user' field includes 'all'
//           [db.Sequelize.Op.and]: [
//             db.Sequelize.where(
//               db.Sequelize.fn('JSON_CONTAINS', db.Sequelize.col('user'), JSON.stringify('all')),
//               true
//             ),
//           ],
//         },
//       });

//       // Filter out messages where the user ID already exists in the 'view' array
//       const filteredMessagesFromAll = messages.filter(message => {
//         return !Array.isArray(message.view) || !message.view.includes(parseInt(id));
//       });

//       // Return filtered messages from the 'all' user query
//       return res.status(200).json(filteredMessagesFromAll);
//     }

//     // Return the filtered messages from the first query
//     return res.status(200).json(filteredMessages);

//   } catch (error) {
//     console.error('Error fetching messages:', error);
//     return res.status(500).json({ error: 'An error occurred while fetching messages.' });
//   }
// };
const viewmessage = async (req, res) => {
  const { id } = req.params;

  try {
    // Convert the `id` parameter to an integer
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid User ID." });
    }

    // Query messages from the database
    let messages = await db.message.findAll({
      where: {
        status: {
          [db.Sequelize.Op.ne]: 1, // Ensure status is not 1
        },
        startDate: {
          [db.Sequelize.Op.lte]: new Date(), // Ensure startDate is less than or equal to the current date
        },
        endDate: {
          [db.Sequelize.Op.gte]: new Date(), // Ensure endDate is greater than or equal to the current date
        },
        [db.Sequelize.Op.or]: [
          // Check if "all" is in the 'user' field
          db.Sequelize.where(
            db.Sequelize.fn(
              "JSON_CONTAINS",
              db.Sequelize.col("user"),
              '"all"' // Using JSON-compatible string
            ),
            true
          ),
          // Check if the specific `userId` is in the 'user' field
          db.Sequelize.where(
            db.Sequelize.fn(
              "JSON_CONTAINS",
              db.Sequelize.col("user"),
              `"${userId}"` // Ensure `userId` is treated as a JSON-compatible integer
            ),
            true
          ),
        ],
      },
    });

    // If no messages are found, return an empty array
    if (messages.length === 0) {
      return res.json([]);
    }

    // Filter messages to exclude ones where the `userId` is in the `view` field
    const filteredMessages = messages.filter((message) => {
      let viewArray = message.view || [];
      if (typeof viewArray === "string") {
        try {
          // Parse the view field as JSON if it's a string
          viewArray = JSON.parse(viewArray);
        } catch (error) {
          console.warn(
            "Failed to parse `view` as JSON. Initializing as an empty array."
          );
          viewArray = [];
        }
      }

      // Ensure `viewArray` contains only integers
      viewArray = Array.isArray(viewArray)
        ? viewArray.map((v) => parseInt(v, 10)).filter((v) => !isNaN(v))
        : [];

      // Return only messages where the `userId` is not in the `view` field
      return !viewArray.includes(userId);
    });

    // Return the filtered messages
    res.json(filteredMessages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching messages" });
  }
};

// const markMessage = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { userid } = req.query;
//     console.log(id, userid);
//     console.log(userid);
//     console.log(typeof userid);
//     if (!id || !userid) {
//       return res
//         .status(400)
//         .json({ error: "Message ID and User ID are required." });
//     }

//     const message = await db.message.findOne({ where: { id } });
//     if (!message) {
//       return res.status(404).json({ error: "Message not found." });
//     }

//     console.log(
//       "View before processing:",
//       message.view,
//       "Type:",
//       typeof message.view
//     );

//     let view = Array.isArray(message.view)
//       ? message.view
//       : message.view
//       ? JSON.parse(message.view)
//       : [];

//     const userIdToAdd = parseInt(userid);

//     if (!view.includes(userIdToAdd)) {
//       view.push(userIdToAdd);

//       await message.update({ view });
//     }

//     return res.status(200).json({
//       message: "Message view updated successfully.",
//       data: {
//         id: message.id,
//         title: message.title,
//         view: message.view,
//       },
//     });
//   } catch (error) {
//     console.error("Error in markMessage:", error);
//     return res.status(500).json({ error: "Internal server error." });
//   }
// };

// const Viewtable = async (req, res) => {
//   try {
//     const { search, startDate, endDate, status, user, page = 1, limit = 10 } = req.query;

//     const whereConditions = {};

//     // Search condition
//     if (search) {
//       whereConditions.title = {
//         [db.Sequelize.Op.like]: `%${search}%`
//       };
//     }

//     // Status condition
//     if (status) {
//       whereConditions.status = status === "Active" ? "1" : "0";
//     }

//     // Date range conditions
//     if (startDate) {
//       whereConditions.endDate = {
//         [db.Sequelize.Op.gte]: new Date(startDate)
//       };
//     }
//     if (endDate) {
//       whereConditions.endDate = {
//         ...whereConditions.endDate,
//         [db.Sequelize.Op.lte]: new Date(endDate)
//       };
//     }

//     // User filtering
//     let userIds = [];
//     let filterByUser = true;

//     if (user) {
//       try {
//         userIds = Array.isArray(user) ? user : JSON.parse(user);
//         if (userIds.includes("all")) {
//           filterByUser = false;
//         }
//       } catch (err) {
//         return res.status(400).json({ message: 'Invalid user parameter format' });
//       }
//     }

//     if (filterByUser && userIds.length > 0) {
//       whereConditions[db.Sequelize.Op.or] = [
//         db.Sequelize.where(
//           db.Sequelize.fn('JSON_CONTAINS', db.Sequelize.col('user'), JSON.stringify(userIds)),
//           true
//         )
//       ];
//     }

//     // Auto-expire messages
//     await db.message.update(
//       { status: "0" },
//       {
//         where: {
//           endDate: { [db.Sequelize.Op.lt]: new Date() },
//           status: "1"
//         }
//       }
//     );

//     // Count total messages
//     const totalMessages = await db.message.count({ where: whereConditions });

//     // Fetch messages with pagination
//     const messages = await db.message.findAll({
//       where: whereConditions,
//       limit: parseInt(limit),
//       offset: (page - 1) * limit,
//       order: [["id", "DESC"]]
//     });

//     // Log messages before formatting to inspect data structure
//     console.log('Messages:', messages);

//     // Collect unique user IDs from `user` and `view` fields
//     const uniqueUserIds = new Set();
//     messages.forEach(message => {
//       if (Array.isArray(message.user)) {
//         message.user.forEach(id => uniqueUserIds.add(id));
//       }
//       if (Array.isArray(message.view)) {
//         message.view.forEach(id => uniqueUserIds.add(id));
//       }
//     });

//     const allUserIds = filterByUser ? (userIds.length > 0 ? userIds : Array.from(uniqueUserIds)) : [];

//     // Fetch user details for the collected IDs
//     const users = filterByUser
//       ? await db.users.findAll({
//           where: {
//             id: {
//               [db.Sequelize.Op.in]: allUserIds
//             }
//           },
//           attributes: ['id', 'first_name', 'last_name', 'emp_id']
//         })
//       : await db.users.findAll({
//           attributes: ['id', 'first_name', 'last_name', 'emp_id']
//         });

//     // Map user details by ID
//     const userMap = {};
//     users.forEach(user => {
//       userMap[user.id] = `${user.first_name} ${user.last_name} (${user.emp_id})`;
//     });

//     // Format messages with user and view mapping
//     const formattedMessages = messages.map(message => ({
//       ...message.toJSON(),
//       user: message.user && Array.isArray(message.user) ? message.user.map(id => userMap[id] || id) : [],
//       view: message.view && Array.isArray(message.view) ? message.view.map(id => userMap[id] || id) : []
//     }));

//     // Log formatted messages to check how user and view fields are being populated
//     console.log('Formatted Messages:', formattedMessages);

//     // Response
//     res.json({
//       messages: formattedMessages,
//       totalMessages,
//       currentPage: parseInt(page),
//       totalPages: Math.ceil(totalMessages / limit),
//     });
//   } catch (error) {
//     console.error('Error fetching messages:', error);
//     res.status(500).json({ message: 'Internal server error' });
//   }
// };

// const markMessage = async (req, res) => {
//   try {
//     const { id } = req.params; // Message ID
//     const { userid } = req.query; // User ID

//     // Validate input
//     if (!id || !userid) {
//       return res.status(400).json({ error: "Message ID and User ID are required." });
//     }

//     // Convert `userid` to an integer
//     const userIdToAdd = parseInt(userid, 10);
//     if (isNaN(userIdToAdd)) {
//       return res.status(400).json({ error: "User ID must be a valid integer." });
//     }

//     // Fetch the message from the database
//     const message = await db.message.findOne({ where: { id } });
//     if (!message) {
//       return res.status(404).json({ error: "Message not found." });
//     }

//     // Ensure `view` is an array, if it's not an array, initialize it as an empty array
//     let view = Array.isArray(message.view) ? message.view : [];

//     // Check if the user ID is already in the view array
//     if (!view.includes(userIdToAdd)) {
//       // Add the user ID to the view array
//       view.push(userIdToAdd);

//       // Update the message's `view` array in the database
//       await message.update({ view: view });

//       return res.status(200).json({
//         message: "Message view updated successfully.",
//         data: {
//           id: message.id,
//           title: message.title,
//           view: view, // Return the updated view array
//         },
//       });
//     } else {
//       return res.status(200).json({
//         message: "User ID already exists in the view array.",
//         data: {
//           id: message.id,
//           title: message.title,
//           view: view, // Return the existing view array
//         },
//       });
//     }

//   } catch (error) {
//     console.error("Error in markMessage:", error);
//     return res.status(500).json({ error: "Internal server error." });
//   }
// };

// const markMessage = async (req, res) => {
//   try {
//     const { id } = req.params; // Message ID
//     const { userid } = req.query; // User ID

//     // Validate input
//     if (!id || !userid) {
//       return res.status(400).json({ error: "Message ID and User ID are required." });
//     }

//     // Convert `userid` to an integer
//     const userIdToAdd = parseInt(userid, 10);
//     if (isNaN(userIdToAdd)) {
//       return res.status(400).json({ error: "User ID must be a valid integer." });
//     }

//     // Fetch the message from the database
//     const message = await db.message.findOne({ where: { id } });
//     if (!message) {
//       return res.status(404).json({ error: "Message not found." });
//     }

//     // If the `view` field is null or undefined, initialize it as an empty array
//     let view = message.view || [];

//     // Create a new array to manipulate
//     let updatedView = Array.isArray(view) ? [...view] : []; // Ensure view is treated as an array

//     // Check if the user ID is already in the array, if not, add it to the dummy array
//     if (!updatedView.includes(userIdToAdd)) {
//       updatedView.push(userIdToAdd); // Add the new userId to the array
//     } else {
//       return res.status(200).json({
//         message: "User ID already exists in the view array.",
//         data: {
//           id: message.id,
//           title: message.title,
//           view: updatedView, // Return the existing view array
//         },
//       });
//     }

//     // Update the message with the new `view` array in the database
//     await message.update({ view: updatedView });

//     return res.status(200).json({
//       message: "Message view updated successfully.",
//       data: {
//         id: message.id,
//         title: message.title,
//         view: updatedView, // Return the updated view array
//       },
//     });
//   } catch (error) {
//     console.error("Error in markMessage:", error);
//     return res.status(500).json({ error: "Internal server error." });
//   }
// };

const markMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { userid } = req.body;

    console.log(id, userid, typeof id, typeof userid);

    if (!id || !userid) {
      return res
        .status(400)
        .json({ error: "Message ID and User ID are required." });
    }

    // Ensure both `id` and `userid` are integers
    const messageId = parseInt(id, 10);
    const userIdToAdd = parseInt(userid, 10);

    console.log("Converted values:", { messageId, userIdToAdd });

    if (isNaN(messageId) || isNaN(userIdToAdd)) {
      return res.status(400).json({ error: "Invalid Message ID or User ID." });
    }

    const message = await db.message.findOne({ where: { id: messageId } });

    if (!message) {
      return res.status(404).json({ error: "Message not found." });
    }

    // Handle the `view` field, ensuring it's treated as an array
    let view = message.view || [];
    if (typeof view === "string") {
      try {
        view = JSON.parse(view);
        console.log("Parsed `view` field as JSON:", view);
      } catch (parseError) {
        console.warn(
          "Failed to parse `view` as JSON. Initializing as an empty array."
        );
        view = [];
      }
    }

    if (!Array.isArray(view)) {
      console.warn("`view` is not an array. Initializing as an empty array.");
      view = [];
    }

    // Ensure `view` contains only unique integers
    const updatedView = Array.from(
      new Set([
        ...view.map((v) => parseInt(v, 10)).filter((v) => !isNaN(v)),
        userIdToAdd,
      ])
    );

    // Update the `view` field in the database
    await message.update({ view: updatedView });

    return res.status(200).json({
      message: "Message view updated successfully.",
      data: {
        id: message.id,
        title: message.title,
        view: updatedView,
      },
    });
  } catch (error) {
    console.error("Error in markMessage:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};

// const markMessage = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { userid } = req.query;

//     console.log("Received Params - ID:", id, "UserID:", userid);

//     if (!id || !userid) {
//       return res.status(400).json({ error: "Message ID and User ID are required." });
//     }

//     // Fetch the 'view' field and include the primary key
//     const message = await db.message.findOne({
//       where: { id },
//       attributes: ["id", "view"], // Ensure primary key is included
//     });

//     if (!message) {
//       return res.status(404).json({ error: "Message not found." });
//     }

//     console.log("Fetched 'view':", message.view);

//     // Initialize 'view' as an empty array if it's null
//     let view = Array.isArray(message.view) ? message.view : [];

//     console.log("Parsed 'view' before update:", view);

//     // Parse the userid to an integer
//     const userIdToAdd = parseInt(userid, 10);
//     if (isNaN(userIdToAdd)) {
//       return res.status(400).json({ error: "Invalid User ID." });
//     }

//     // Add the userid to the 'view' array if it's not already present
//     if (!view.includes(userIdToAdd)) {
//       view.push(userIdToAdd);

//       // Update the 'view' field in the database
//       await message.update({ view });

//       console.log("Updated 'view' after adding user ID:", view);
//     } else {
//       console.log("User ID already exists in 'view'. No update needed.");
//     }

//     return res.json({
//       message: "Message view updated successfully.",
//       data: {
//         id: message.id,
//         view,
//       },
//     });
//   } catch (error) {
//     console.error("Error in markMessage:", error);
//     return res.status(500).json({ error: "Internal server error." });
//   }
// };

const Viewtable = async (req, res) => {
  try {
    const {
      search,
      startDate,
      endDate,
      status,
      page = 1,
      limit = 10,
    } = req.query;

    const whereConditions = {};

    // Search condition
    if (search) {
      whereConditions.title = {
        [db.Sequelize.Op.like]: `%${search}%`,
      };
    }

    // Status condition
    if (status) {
      whereConditions.status = status === "Active" ? "1" : "0";
    }

    // Date range conditions
    if (startDate) {
      whereConditions.endDate = {
        [db.Sequelize.Op.gte]: new Date(startDate),
      };
    }
    if (endDate) {
      whereConditions.endDate = {
        ...whereConditions.endDate,
        [db.Sequelize.Op.lte]: new Date(endDate),
      };
    }

    await db.message.update(
      { status: "0" },
      {
        where: {
          endDate: { [db.Sequelize.Op.lt]: new Date() },
          status: "1",
        },
      }
    );

    const totalMessages = await db.message.count({ where: whereConditions });

    const messages = await db.message.findAll({
      where: whereConditions,
      limit: parseInt(limit),
      offset: (page - 1) * limit,
      order: [["id", "DESC"]],
    });

    const userIds = new Set();
    const viewIds = new Set();

    messages.forEach((message) => {
      let users = message.user ? message.user : [];
      let views = message.view ? message.view : [];

      if (users !== "all" && typeof users === "string") {
        try {
          users = JSON.parse(users);
        } catch (e) {
          users = []; // If JSON.parse fails, default to an empty array
        }
      }
      if (views !== "all" && typeof views === "string") {
        try {
          views = JSON.parse(views);
        } catch (e) {
          views = []; // If JSON.parse fails, default to an empty array
        }
      }

      // Collect user IDs if not `["all"]`
      if (Array.isArray(users) && users[0] !== "all") {
        users.forEach((id) => userIds.add(id));
      }

      // Collect view IDs if not `["all"]`
      if (Array.isArray(views) && views[0] !== "all") {
        views.forEach((id) => viewIds.add(id));
      }
    });

    // Fetch user details from `users` table
    const allIds = Array.from(new Set([...userIds, ...viewIds]));
    const userDetails = await db.users.findAll({
      where: {
        id: {
          [db.Sequelize.Op.in]: allIds,
        },
      },
      attributes: ["id", "first_name", "last_name", "emp_id"],
    });

    // Map user details by ID
    const userMap = {};
    userDetails.forEach((user) => {
      userMap[
        user.id
      ] = `${user.first_name} ${user.last_name} (${user.emp_id})`;
    });

    // Format messages for frontend
    const formattedMessages = messages.map((message) => {
      let users = message.user ? message.user : [];
      let views = message.view ? message.view : [];

      // Handle "all" as a special case, otherwise parse if it's a JSON string
      if (users !== "all" && typeof users === "string") {
        try {
          users = JSON.parse(users);
        } catch (e) {
          users = []; // If JSON.parse fails, default to an empty array
        }
      }
      if (views !== "all" && typeof views === "string") {
        try {
          views = JSON.parse(views);
        } catch (e) {
          views = []; // If JSON.parse fails, default to an empty array
        }
      }

      // Check for special case "all", otherwise map valid IDs to user names
      const formattedUsers =
        users === "all"
          ? ["All"]
          : Array.isArray(users) && users.length > 0
          ? users.map((id) => userMap[id] || `${id}`)
          : [""];

      const formattedViews =
        views === "all"
          ? "All"
          : Array.isArray(views) && views.length > 0
          ? views.map((id) => userMap[id] || ` ${id}`)
          : "";

      return {
        ...message.toJSON(),
        user: formattedUsers,
        view: formattedViews,
      };
    });

    // Send response with formatted messages and pagination details
    res.json({
      messages: formattedMessages,
      totalMessages,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalMessages / limit),
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const viewimage = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.message.findByPk(id, {
      attributes: ["image", "bgimage"],
    });

    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Message not found" });
    }
  } catch (error) {
    console.error("Error fetching image:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const DeleteMessage = async (req, res) => {
  const { id } = req.params;
  const logid = req.query.logid;
  const logip = req.query.logip;

  const currentDate = new Date();
  const dateString = currentDate.toISOString().split("T")[0];
  const timeString = currentDate.toTimeString().split(" ")[0];

  try {
    const message = await db.message.findOne({ where: { id } });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const imagePath = message.image;

    await db.message.destroy({ where: { id } });

    if (imagePath) {
      const fullImagePath = path.join(__dirname, "..", imagePath);
      fs.unlink(fullImagePath, (err) => {
        if (err) {
          console.error("Error deleting image:", err);
        } else {
          console.log("Image deleted successfully");
        }
      });
    }

    await db.logs.create({
      user_id: logid,
      api: `Delete Message/${id}`,
      message: "Success",
      data: JSON.stringify({ id }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    return res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error deleting message:", error);

    await db.logs.create({
      user_id: logid,
      api: `Delete Message/${id}`,
      message: "Failed",
      data: JSON.stringify({ error: error.message, id }),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    return res.status(500).json({ message: "Internal server error" });
  }
};

const EditMessage = async (req, res) => {
  const { id } = req.params;
  const logid = req.query.logid;
  const logip = req.query.logip;
  const { title, description, startDate, endDate, selectedOptions, status } =
    req.body;

  console.log("Request Body:", req.body);

  let image = null;
  let bgimage = null;

  if (req.files) {
    if (req.files["image"] && req.files["bgimage"]) {
      return res.status(400).json({
        error: "Please upload either an image or a background image, not both.",
      });
    } else if (req.files["image"]) {
      image = `messageImage/${req.files["image"][0].filename}`;
    } else if (req.files["bgimage"]) {
      bgimage = `messageImage/${req.files["bgimage"][0].filename}`;
    }
  }

  try {
    const message = await db.message.findByPk(id);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    message.title = title !== undefined ? title : message.title;
    message.description =
      description !== undefined ? description : message.description;
    message.startDate = startDate !== undefined ? startDate : message.startDate;
    message.endDate = endDate !== undefined ? endDate : message.endDate;
    message.status = status !== undefined ? status : message.status;

    if (Array.isArray(selectedOptions)) {
      message.user = selectedOptions;
    } else {
      return res
        .status(400)
        .json({ error: "selectedOptions must be an array" });
    }

    if (image) {
      if (message.image) {
        fs.unlinkSync(path.join(__dirname, "..", message.image));
      }
      message.image = image;
      message.bgimage = null;
      message.view = null;
    } else if (bgimage) {
      if (message.bgimage) {
        fs.unlinkSync(path.join(__dirname, "..", message.bgimage));
      }
      message.bgimage = bgimage;
      message.image = null;
      message.title = null;
      message.description = null;
      message.view = null;
    }

    await message.save();
    const currentDate = new Date();
    const dateString = currentDate.toISOString().split("T")[0];
    const timeString = currentDate.toTimeString().split(" ")[0];
    await db.logs.create({
      user_id: logid,
      api: `Edit Message/${id}`,
      message: "Success",
      data: JSON.stringify(message),
      ip: logip,
      date: dateString,
      time: timeString,
    });

    return res.status(200).json({ message: "Message updated successfully" });
  } catch (error) {
    console.error("Error updating message:", error);
    await db.logs.create({
      user_id: logid,
      api: `Edit Message/${id}`,
      message: "Failed",
      data: JSON.stringify(message),
      ip: logip,
      date: dateString,
      time: timeString,
    });
    return res
      .status(500)
      .json({ error: "An error occurred while updating the message" });
  }
};

const fetchMessage = async (req, res) => {
  const { id } = req.params;

  try {
    const message = await db.message.findByPk(id);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    return res.status(200).json(message);
  } catch (error) {
    console.error("Error fetching message:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching the message" });
  }
};

module.exports = {
  viewoption,
  submitmessage,
  viewmessage,
  markMessage,
  Viewtable,
  viewimage,
  DeleteMessage,
  EditMessage,
  fetchMessage,
  viewoption2
};
