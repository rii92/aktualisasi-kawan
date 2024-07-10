const schedule = require("node-schedule");
// const date = new Date();

const job = schedule.scheduleJob("6 7 * * *", () => {
    console.log("I'm working...");
});

module.exports.runPrompt = job;