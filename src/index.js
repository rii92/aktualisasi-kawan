const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");
const { runDialogFlow } = require("./dialog_flow");
const { cekSpreadsheetMessage } = require("./message_spreadsheet");
const { replaceMultipleStringsAll } = require("./replace-string.js");
const schedule = require("node-schedule");

// Load environment variables
dotenv.config();
const {
  APIKEY: API,
  APIKEY: noChatbot,
} = process.env;

// Initialize WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth(),
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
    const adminNumbers = adminResponse.data.records.map(admin => admin.no);
    
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

    const response = await cekSpreadsheetMessage(message.body);
    const answer = response || (await runDialogFlow(message.body));

    const typingTime = Math.min((answer.message.length / 200) * 60000, 2000);
    await delay(typingTime);

    await client.sendMessage(contact.id._serialized, answer.message.toString());

    // Save message records
    const saveRecordURL = `${API}?id=${uuidv4()}&action=save-record-message`;
    await axios.get(
      `${saveRecordURL}&no=${contact.id.user}&name=${contact.name}&message=${message.body}&status=receive`
    );
    await axios.get(
      `${saveRecordURL}&no=${noChatbot}&name=BotKawan&message=${answer.message}&status=send`
    );
  } catch (error) {
    console.log(`Error sending message: ${error}`);
  }
};

const getData = async (idMessage, messageText) => {
  try {
    const response = await axios.get(`${API}?action=read-spam`);
    const data = response.data.records;

    for (const element of data) {
      if (
        element.idMessage.toString() === idMessage.toString() &&
        element.status.toString() === "true"
      ) {
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
          // Add validation and logging before sending
          if (!element.no || !newString) {
            console.error(`Invalid recipient or message: no='${element.no}', message='${newString}'`);
            continue;
          }
          await client.sendMessage(`${element.no}@c.us`, newString);

          const date = new Date();
          // await axios.get(
          //   `${API}?action=update&id=${
          //     element.no
          //   }&status=false${date.getTime()}`
          // );

          await delay(1000);
        } catch (error) {
          console.log(`Failed to send data for: ${element.nama}`, error);
        }
      }
    }
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
    client.sendPresenceUnavailable();
  } else {
    console.log("Old message ignored.");
  }
});

const saveMessage = async (message) => {
  try {
    const contact = await message.getContact();
    const contactId = contact.id._serialized;

    if (message.id.remote.includes("@c.us") && message.type === "chat") {
      if (message.body.toLowerCase().includes("kirim-pesan-umum")) {
        const [, idMessage, category, messageText] = message.body
          .split("::");
        const nomorPengguna = contactId.replace("@c.us", "");

        try {
          // Fetch admin data from API
          const adminResponse = await axios.get(`${API}?action=read-admin`);
          const adminNumbers = adminResponse.data.records.map(admin => admin.no);
          
          // Check if sender is an admin
          if (adminNumbers.includes(parseInt(nomorPengguna)) || adminNumbers.includes(nomorPengguna)) {
            if (category === "delay") {
              console.log("Scheduling message broadcast for 7:30 AM tomorrow...");
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
            await client.sendMessage(contactId, "Maaf, Anda tidak memiliki izin untuk mengirim pesan umum.");
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          
          const adminResponse = await axios.get(`${API}?action=read-admin`);
          const adminNumbers = adminResponse.data.records.map(admin => admin.no);
          if (adminNumbers.includes(nomorPengguna)) {
            if (category === "delay") {
              console.log("Scheduling message broadcast for 7:30 AM tomorrow (fallback)...");
              schedule.scheduleJob("0 7 * * *", async () => {
                console.log("Executing scheduled message broadcast (fallback)...");
                await getData(idMessage, messageText);
              });
            } else {
              console.log("Executing immediate message broadcast (fallback)...");
              await getData(idMessage, messageText);
            }
          }
        }
        return;
      }

      const command = message.body.toLowerCase();
      if (!userState[contactId] || userState[contactId] === null) {
        switch (command) {
          case "1":
            await handleAdminMode(message, contactId);
            break;
          case "2":
            await handleBotMode(message, contactId);
            break;
          case "00":
            await handleResetMode(message, contactId);
            break;
          default:
            await modeTyping(
              message,
              `Selamat datang di Layanan WhatsApp BPS Kabupaten Sanggau
Silahkan pilih layanan yang Anda inginkan:
1. Hubungi Admin BPS Sanggau
2. Chatbot Pelayanan Publik
Kirim "1" untuk menghubungi Admin atau "2" untuk menggunakan Chatbot
Untuk kembali ke menu awal kirim "00"`,
              contactId
            );
        }
      } else if (
        userState[contactId] === "admin" ||
        userState[contactId] === "bot"
      ) {
        if (command === "00") {
          await handleResetMode(message, contactId);
        } else if (userState[contactId] === "bot") {
          await useTemplateMessageKawan(message, contact);
        }
      }
    }
  } catch (error) {
    console.log("Error in saveMessage:", error);
  }
};

client.initialize();

