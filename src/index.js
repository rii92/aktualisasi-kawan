const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");
const { runDialogFlow } = require("./dialog_flow");
const { cekSpreadsheetMessage } = require("./message_spreadsheet");
const { replaceMultipleStringsAll } = require("./replace-string.js");
const schedule = require("node-schedule");
const { MessageMedia } = require('whatsapp-web.js');

// Load environment variables
dotenv.config();
const {
  APIKEY: API,
  APIKEYPESALIR: APIPESALIR,
  APIKEY: noChatbot,
} = process.env;

// Initialize WhatsApp client
const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: false,
            args: ["--disable-popup-blocking"],
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        },
        // temp
        webVersionCache: {
            type: 'remote',
            remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/refs/heads/main/html/2.3000.1031490220-alpha.html`,    
        },
    });

// Store user states
const userState = {};

// Helper functions
const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

const notifyAdmins = async (contactId, message) => {
  try {
    const nomorPengguna = contactId.replace("@c.us", "");
    const notificationMessage = `User https://wa.me/${nomorPengguna} ingin menghubungi admin. Pesan: ${message}`;

    // Fetch admin data from API
    const adminResponse = await axios.get(`${API}?action=read-admin`);
    const adminNumbers = adminResponse.data.records.map((admin) => admin.no);

    // Send notification to all admins
    for (const admin of adminNumbers) {
      await client.sendMessage(`${admin}@c.us`, notificationMessage);
    }
  } catch (error) {
    console.error("Error notifying admins:", error);
  }
};

const modeTyping = async (message, replyMessage, contactId) => {
  const chat = await message.getChat();
  await chat.sendSeen();
  await chat.sendStateTyping();

  const typingTime = Math.min((replyMessage.length / 200) * 60000, 2000);
  await delay(typingTime);

  await client.sendMessage(contactId, replyMessage.toString());
};

// Message handling functions
const handleAdminMode = async (message, contactId) => {
  userState[contactId] = "admin";
  await modeTyping(
    message,
    `Anda akan dihubungkan dengan admin, mohon tunggu. Chatbot akan berhenti merespon. Ketik '00' untuk kembali ke menu awal.`,
    contactId
  );
  await notifyAdmins(contactId, message.body);
};

const handleBotMode = async (message, contactId) => {
  userState[contactId] = "bot";
  await modeTyping(
    message,
    `Anda sekarang berinteraksi dengan chatbot. Ada yang bisa saya bantu?`,
    contactId
  );
};

const handleResetMode = async (message, contactId) => {
  userState[contactId] = null;
  await modeTyping(
    message,
    `Anda sekarang kembali ke fitur awal. Ada yang bisa saya bantu?\n1. Rekrutmen mitra 2025 (fitur jawab otomatis di nonaktifkan dan akan dijawab langsung oleh admin)\n2. Chatbot Pelayanan Publik (fitur jawab otomatis aktif)\nKirim "1" untuk Rekrutmen dan "2" untuk Chatbot Pelayanan Publik. Untuk kembali ke fitur awal maka kirim "00"`,
    contactId
  );
};

const useTemplateMessageKawan = async (message, contact) => {
  try {
    const chat = await message.getChat();
    await chat.sendSeen();
    await chat.sendStateTyping();

    const response = await cekSpreadsheetMessage(message["_data"]["body"]);
    const answer = response || (await runDialogFlow(message["_data"]["body"], contact));

    const typingTime = Math.min((answer.message.length / 200) * 60000, 2000);
    await delay(typingTime);

    await client.sendMessage(contact, answer.message.toString());

    // Save message records
    const saveRecordURL = `${API}?id=${uuidv4()}&action=save-record-message`;
    await axios.get(
      `${saveRecordURL}&no=${contact["_data"]["id"]["id"]}&name=${contact["_data"]["id"]["id"]}&message=${message["_data"]["body"]}&status=receive`
    );
    await axios.get(
      `${saveRecordURL}&no=${noChatbot}&name=BotKawan&message=${answer.message}&status=send`
    );
  } catch (error) {
    console.log(`Error sending message: ${error}`);
  }
};

// Helper to generate random delay to avoid spam detection
const getRandomDelay = (minMs, maxMs) => {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
};

// Helper to add natural text variations to avoid duplicate message detection
const addTextVariation = (text, index) => {
  // Subtle variations that look natural
  const variations = [
    text,
    text.replace(/,\s*/g, ", "), // Normalize spacing
    text.replace(/\s+/g, " ").trim(), // Remove extra spaces
  ];
  return variations[index % variations.length];
};

// Helper to manage message sending with anti-spam measures
const sendMessageWithAntiSpam = async (phoneNumber, message, contact, pathFile) => {
  try {
    // Simulate typing with natural duration
    const baseTypingTime = Math.max((message.length / 200) * 1500, 500);
    const typingDuration = getRandomDelay(
      Math.floor(baseTypingTime * 0.7),
      Math.floor(baseTypingTime * 1.3)
    );

    // Send typing indicator via chat object
    try {
      const chat = await client.getChatById(`${phoneNumber}@c.us`);
      await chat.sendStateTyping();
      await delay(Math.min(typingDuration, 3000)); // Cap typing at 3s
    } catch (e) {
      console.log(`Could not send typing state for ${phoneNumber}`);
      await delay(Math.min(typingDuration, 1500));
    }

    // Send message
    if (pathFile && pathFile !== "") {
      const media = MessageMedia.fromFilePath(
        pathFile
      );
      await client.sendMessage(`${phoneNumber}@c.us`, media);
    }
    await client.sendMessage(`${phoneNumber}@c.us`, message);

    return true;
  } catch (error) {
    console.error(`Failed to send message to ${phoneNumber}:`, error);
    return false;
  }
};

const getData = async (idMessage, messageText) => {
  try {
    const response = await axios.get(`${API}?action=read-spam`);
    const data = response.data.records;

    const targetRecipients = data.filter(
      (element) =>
        element.idMessage.toString() === idMessage.toString() &&
        element.status.toString() === "true"
    );

    if (targetRecipients.length === 0) {
      console.log("No target recipients found for broadcast");
      return;
    }

    console.log(
      `Starting broadcast to ${targetRecipients.length} recipients...`
    );
    let successCount = 0;
    let failureCount = 0;

    // Process recipients with optimized delays to avoid spam detection
    for (let index = 0; index < targetRecipients.length; index++) {
      const element = targetRecipients[index];

      try {
        const replacementData = [
          [element.no, "[[no]]"],
          [element.panggilan, "[[panggilan]]"],
          [element.nama, "[[nama]]"],
          [element.status, "[[status]]"],
          [element.catatan, "[[catatan]]"],
          [element.cp, "[[cp]]"],
          [element.idMessage, "[[idMessage]]"],
          [element.Tanggal, "[[tanggal]]"],
          [element.Waktu, "[[waktu]]"],
          [element.Username, "[[username]]"],
          [element.Password, "[[password]]"],
          [element.Email, "[[email]]"],
          [element.Grup, "[[grup]]"],
          [element.Nama_Survei, "[[nama survei]]"],
          [element.Role, "[[role]]"],
          [element.Link, "[[link]]"],
        ];

        const newString = await replaceMultipleStringsAll(
          messageText,
          replacementData
        );

        // Validation
        if (!element.no || !newString) {
          console.error(
            `Invalid recipient or message: no='${element.no}', message='${newString}'`
          );
          failureCount++;
          continue;
        }

        // Add text variation (only normalize spacing, no weird characters)
        const messageWithVariation = addTextVariation(newString, index);

        pathFile = element.filepath;
        // Send message with anti-spam measures
        const sent = await sendMessageWithAntiSpam(
          element.no,
          messageWithVariation,
          element,
          pathFile
        );

        if (sent) {
          successCount++;
          console.log(
            `✓ Sent to ${element.nama} (${element.no}) [${index + 1}/${
              targetRecipients.length
            }]`
          );
        } else {
          failureCount++;
        }

        // Optimized delay strategy:
        // - Base delay: 2000-4000ms (faster than before)
        // - Every 5 messages: longer pause of 3000-5000ms
        // - Every 15 messages: extra longer pause of 5000-8000ms
        let nextDelay;
        
        if (index % 15 === 14) {
          // Every 15 messages - longer pause
          nextDelay = getRandomDelay(5000, 8000);
          console.log(`📌 Extended pause: ${(nextDelay / 1000).toFixed(1)}s (message ${index + 1}/${targetRecipients.length})`);
        } else if (index % 5 === 4) {
          // Every 5 messages - medium pause
          nextDelay = getRandomDelay(3000, 5000);
          console.log(`⏸️ Pause: ${(nextDelay / 1000).toFixed(1)}s`);
        } else {
          // Regular delay between messages
          nextDelay = getRandomDelay(2000, 4000);
        }

        if (index < targetRecipients.length - 1) {
          await delay(nextDelay);
        }
      } catch (error) {
        console.log(`Failed to send data for: ${element.nama}`, error);
        failureCount++;

        // Brief pause on error
        await delay(getRandomDelay(3000, 5000));
      }
    }

    console.log(
      `✅ Broadcast completed - Success: ${successCount}, Failed: ${failureCount}`
    );
  } catch (error) {
    console.log("Error in getData:", error);
  }
};

// Event handlers
client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Client is ready!");
  const now = new Date();
  client.readyTimestamp = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    0,
    0,
    0
  );

  // Initialize PESALIR notification scheduler
  schedulePesalirNotifications();
});

client.on("authenticated", () => {
  console.log("AUTHENTICATED");
});

client.on("auth_failure", (msg) => {
  console.error("AUTHENTICATION FAILURE", msg);
});

client.on("message", async (message) => {
  if (
    new Date(message.timestamp * 1000).getTime() >
    client.readyTimestamp.getTime()
  ) {
    client.sendPresenceAvailable();
    await saveMessage(message);
    // console.log(message["_data"]["from"]);
    // console.log(message);
    
    client.sendPresenceUnavailable();
  } else {
    console.log("Old message ignored.");
  }
});

const saveMessage = async (message) => {
  try {
    const contactId = await message["_data"]["from"];
    console.log("test contactId:", contactId);
    if (contactId.includes("@c.us") && message["_data"]["type"] === "chat") {
      if (message["_data"]["body"].toLowerCase().includes("kirim-pesan-umum")) {
        const [, idMessage, category, messageText] = message["_data"]["body"].split("::");
        const nomorPengguna = contactId.replace("@c.us", "");

        try {
          // Fetch admin data from API
          const adminResponse = await axios.get(`${API}?action=read-admin`);
          const adminNumbers = adminResponse.data.records.map(
            (admin) => admin.no
          );

          // Check if sender is an admin
          if (
            adminNumbers.includes(parseInt(nomorPengguna)) ||
            adminNumbers.includes(nomorPengguna)
          ) {
            if (category === "delay") {
              console.log(
                "Scheduling message broadcast for 7:30 AM tomorrow..."
              );
              schedule.scheduleJob("0 7 * * *", async () => {
                console.log("Executing scheduled message broadcast...");
                await getData(idMessage, messageText);
              });
            } else {
              console.log("Executing immediate message broadcast...");
              await getData(idMessage, messageText);
            }
          } else {
            console.log(`Unauthorized broadcast attempt from ${nomorPengguna}`);
            await client.sendMessage(
              contactId,
              "Maaf, Anda tidak memiliki izin untuk mengirim pesan umum."
            );
          }
        } catch (error) {
          console.error("Error checking admin status:", error);

          // Fallback to environment variables if API call fails
          const fallbackAdmins = [noAdmin1, noAdmin2, noAdmin3, noAdmin4];
          if (fallbackAdmins.includes(nomorPengguna)) {
            if (category === "delay") {
              console.log(
                "Scheduling message broadcast for 7:30 AM tomorrow (fallback)..."
              );
              schedule.scheduleJob("0 7 * * *", async () => {
                console.log(
                  "Executing scheduled message broadcast (fallback)..."
                );
                await getData(idMessage, messageText);
              });
            } else {
              console.log(
                "Executing immediate message broadcast (fallback)..."
              );
              await getData(idMessage, messageText);
            }
          }
        }
        return;
      }

      // UNTUK PESAN OTOMATIS CHATBOT DAN ADMIN, DI NONAKTIFKAN SEMENTARA
      //       const command = message.body.toLowerCase();
      //       if (!userState[contactId] || userState[contactId] === null) {
      //         switch (command) {
      //           case "1":
      //             await handleAdminMode(message, contactId);
      //             break;
      //           case "2":
      //             await handleBotMode(message, contactId);
      //             break;
      //           case "00":
      //             await handleResetMode(message, contactId);
      //             break;
      //           default:
      //             await modeTyping(
      //               message,
      //               `Selamat datang di Layanan WhatsApp BPS Kabupaten Sanggau
      // Silahkan pilih layanan yang Anda inginkan:
      // 1. Hubungi Admin BPS Sanggau
      // 2. Chatbot Pelayanan Publik
      // Kirim "1" untuk menghubungi Admin atau "2" untuk menggunakan Chatbot
      // Untuk kembali ke menu awal kirim "00"`,
      //               contactId
      //             );
      //         }
      //       } else if (
      //         userState[contactId] === "admin" ||
      //         userState[contactId] === "bot"
      //       ) {
      //         if (command === "00") {
      //           await handleResetMode(message, contactId);
      //         } else if (userState[contactId] === "bot") {
      //           await useTemplateMessageKawan(message, contactId);
      //         }
      //       }
    }
  } catch (error) {
    console.log("Error in saveMessage:", error);
  }
};

client.initialize();

// Scheduler for PESALIR duty notifications
const schedulePesalirNotifications = async () => {
  try {
    // Fetch schedule data
    const scheduleResponse = await axios.get(`${API}?action=petugas-pesalir`);
    const attendanceResponse = await axios.get(`${APIPESALIR}?action=read`);
    const adminResponse = await axios.get(`${API}?action=read-admin`);

    // Process attendance data to find backup officers
    const attendanceData = attendanceResponse.data.records;
    const officerAttendance = {};

    // Count attendance for each officer
    attendanceData.forEach((record) => {
      if (!officerAttendance[record.Nama_Petugas]) {
        officerAttendance[record.Nama_Petugas] = 0;
      }
      officerAttendance[record.Nama_Petugas]++;
    });

    // Sort officers by attendance (least to most)
    const backupOfficers = Object.keys(officerAttendance)
      .sort((a, b) => officerAttendance[a] - officerAttendance[b])
      .slice(0, 6);

    // Get admin numbers from API response
    const adminNumbers = adminResponse.data.records.map((admin) => admin.no);

    // Schedule daily check at 7 AM
    schedule.scheduleJob("0 7 * * *", async () => {
      console.log("Running PESALIR notification check...");
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check for today's schedule
      const scheduleData = scheduleResponse.data.records;
      for (const duty of scheduleData) {
        const dutyDate = new Date(duty.Datetime);
        dutyDate.setHours(0, 0, 0, 0);

        if (dutyDate.getTime() === today.getTime()) {
          // Get officer name and number
          const officerName = duty.Nama_Petugas
            ? duty.Nama_Petugas.split(",")[0]
            : "Petugas";
          const officerNumber = duty.Nomor_Petugas;

          // Get supervisor name and number
          const supervisorName = duty.Pengawas
            ? duty.Pengawas.split(",")[0]
            : "Tidak Ada";
          const supervisorNumber = duty.Nomor_Pengawas;

          // Create backup officer message
          const backupMessage = `🔔 *INFORMASI BACKUP PESALIR*\n\nJika berhalangan hadir hari ini, berikut adalah 3 petugas dengan jadwal paling sedikit yang dapat menggantikan:\n\n1. ${backupOfficers[1]}\n2. ${backupOfficers[2]}\n3. ${backupOfficers[3]}\n4. ${backupOfficers[4]}\n5. ${backupOfficers[5]}\n\nMohon koordinasinya. Terima kasih.`;

          // Send notification to officer with backup info
          const officerMessage = `🔔 *PENGINGAT JADWAL PESALIR*\n\nSelamat pagi ${officerName}!\nAnda dijadwalkan bertugas hari ini sebagai petugas PESALIR.\nMohon hadir tepat waktu dan melaksanakan tugas sesuai SOP.\n\n${backupMessage}`;

          // Send to officer
          if (officerNumber) {
            await client.sendMessage(`${officerNumber}@c.us`, officerMessage);
            console.log(
              `Sent notification to officer ${officerName} at ${officerNumber}`
            );
          }

          // Send notification to supervisor if any, also with backup info
          if (
            supervisorName !== "Tidak Ada" &&
            supervisorNumber &&
            supervisorNumber !== officerNumber
          ) {
            const supervisorMessage = `🔔 *PENGINGAT JADWAL PENGAWASAN PESALIR*\n\nSelamat pagi ${supervisorName}!\nAnda dijadwalkan sebagai pengawas PESALIR hari ini.\nPetugas yang bertugas: ${officerName} (${officerNumber})\n\n${backupMessage}`;

            await client.sendMessage(
              `${supervisorNumber}@c.us`,
              supervisorMessage
            );
            console.log(
              `Sent notification to supervisor ${supervisorName} at ${supervisorNumber}`
            );
          }

          // Also send notification to admins
          const adminMessage = `🔔 *INFORMASI JADWAL PESALIR HARI INI*\n\nPetugas: ${officerName} (${officerNumber})\nPengawas: ${supervisorName} (${
            supervisorNumber || "Tidak Ada"
          })\n\n${backupMessage}`;

          for (const admin of adminNumbers) {
            if (admin !== officerNumber && admin !== supervisorNumber) {
              await client.sendMessage(`${admin}@c.us`, adminMessage);
            }
          }

          console.log(`Completed PESALIR notifications for ${officerName}`);
        }
      }
    });

    console.log("PESALIR notification scheduler initialized");
  } catch (error) {
    console.error("Error setting up PESALIR notifications:", error);
  }
};
