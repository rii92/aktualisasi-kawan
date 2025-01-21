const schedule = require("node-schedule");

// Menjadwalkan tugas setiap jam 8 pagi (0 8 * * *)
// Format: Minute Hour Day Month DayOfWeek
const job = schedule.scheduleJob("0 8 * * *", () => {
    console.log("Starting job at 8 AM...");
    const currentTime = new Date();
    console.log(`Job executed at: ${currentTime}`);
});

module.exports.runPrompt = job;