const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');
const { runDialogFlow } = require('./dialog_flow');
const { cekSpreadsheetMessage } = require('./message_spreadsheet');
const { replaceMultipleStringsAll } = require('./replace-string.js');
const schedule = require('node-schedule');
const { MessageMedia } = require('whatsapp-web.js');

dotenv.config();
const { APIKEY: API, APIKEYPESALIR: APIPESALIR, No_CHATBOT: noChatbot } = process.env;

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const userState = {};
const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

const notifyAdmins = async (contactId, message) => {
  try {
    const nomorPengguna = contactId.replace("@c.us", "");
    const notificationMessage = `User https://wa.me/${nomorPengguna} ingin menghubungi admin. Pesan: ${message}`;
    const adminResponse = await axios.get(`${API}?action=read-admin`);
    const adminNumbers = adminResponse.data.records.map((admin) => admin.no);
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

    const saveRecordURL = `${API}?id=${uuidv4()}&action=save-record-message`;
    await axios.get(`${saveRecordURL}&no=${contact}&name=${contact}&message=${message["_data"]["body"]}&status=receive`);
    await axios.get(`${saveRecordURL}&no=${noChatbot}&name=BotKawan&message=${answer.message}&status=send`);
  } catch (error) {
    console.log(`Error sending message: ${error}`);
  }
};

const getRandomDelay = (minMs, maxMs) => {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
};

const addTextVariation = (text, index) => {
  const variations = [
    text,
    text.replace(/,\s*/g, ", "),
    text.replace(/\s+/g, " ").trim(),
  ];
  return variations[index % variations.length];
};

const sendMessageWithAntiSpam = async (phoneNumber, message, contact, pathFile) => {
  try {
    const baseTypingTime = Math.max((message.length / 200) * 1500, 500);
    const typingDuration = getRandomDelay(
      Math.floor(baseTypingTime * 0.7),
      Math.floor(baseTypingTime * 1.3)
    );
    try {
      const chat = await client.getChatById(`${phoneNumber}@c.us`);
      await chat.sendStateTyping();
      await delay(Math.min(typingDuration, 3000));
    } catch (e) {
      console.log(`Could not send typing state for ${phoneNumber}`);
      await delay(Math.min(typingDuration, 1500));
    }
    if (pathFile && pathFile !== "") {
      const media = MessageMedia.fromFilePath(pathFile);
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
    console.log(`Starting broadcast to ${targetRecipients.length} recipients...`);
    let successCount = 0;
    let failureCount = 0;

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
        const newString = await replaceMultipleStringsAll(messageText, replacementData);
        if (!element.no || !newString) {
          console.error(`Invalid recipient or message: no='${element.no}', message='${newString}'`);
          failureCount++;
          continue;
        }
        const messageWithVariation = addTextVariation(newString, index);
        pathFile = element.filepath;
        const sent = await sendMessageWithAntiSpam(element.no, messageWithVariation, element, pathFile);
        if (sent) {
          successCount++;
          console.log(`✓ Sent to ${element.nama} (${element.no}) [${index + 1}/${targetRecipients.length}]`);
        } else {
          failureCount++;
        }

        let nextDelay;
        if (index % 15 === 14) {
          nextDelay = getRandomDelay(5000, 8000);
          console.log(`Extended pause: ${(nextDelay / 1000).toFixed(1)}s (message ${index + 1}/${targetRecipients.length})`);
        } else if (index % 5 === 4) {
          nextDelay = getRandomDelay(3000, 5000);
          console.log(`Pause: ${(nextDelay / 1000).toFixed(1)}s`);
        } else {
          nextDelay = getRandomDelay(2000, 4000);
        }
        if (index < targetRecipients.length - 1) {
          await delay(nextDelay);
        }
      } catch (error) {
        console.log(`Failed to send data for: ${element.nama}`, error);
        failureCount++;
        await delay(getRandomDelay(3000, 5000));
      }
    }
    console.log(`Broadcast completed - Success: ${successCount}, Failed: ${failureCount}`);
  } catch (error) {
    console.log("Error in getData:", error);
  }
};

const schedulePesalirNotifications = async () => {
  try {
    const scheduleResponse = await axios.get(`${API}?action=petugas-pesalir`);
    const attendanceResponse = await axios.get(`${APIPESALIR}?action=read`);
    const adminResponse = await axios.get(`${API}?action=read-admin`);

    const attendanceData = attendanceResponse.data.records;
    const officerAttendance = {};

    attendanceData.forEach((record) => {
      if (!officerAttendance[record.Nama_Petugas]) {
        officerAttendance[record.Nama_Petugas] = 0;
      }
      officerAttendance[record.Nama_Petugas]++;
    });

    const backupOfficers = Object.keys(officerAttendance)
      .sort((a, b) => officerAttendance[a] - officerAttendance[b])
      .slice(0, 6);

    const adminNumbers = adminResponse.data.records.map((admin) => admin.no);

    schedule.scheduleJob("0 7 * * *", async () => {
      console.log("Running PESALIR notification check...");
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const scheduleData = scheduleResponse.data.records;
      for (const duty of scheduleData) {
        const dutyDate = new Date(duty.Datetime);
        dutyDate.setHours(0, 0, 0, 0);

        if (dutyDate.getTime() === today.getTime()) {
          const officerName = duty.Nama_Petugas
            ? duty.Nama_Petugas.split(",")[0]
            : "Petugas";
          const officerNumber = duty.Nomor_Petugas;
          const supervisorName = duty.Pengawas
            ? duty.Pengawas.split(",")[0]
            : "Tidak Ada";
          const supervisorNumber = duty.Nomor_Pengawas;

          const backupMessage = `🔔 *INFORMASI BACKUP PESALIR*\n\nJika berhalangan hadir hari ini, berikut adalah 3 petugas dengan jadwal paling sedikit yang dapat menggantikan:\n\n1. ${backupOfficers[1]}\n2. ${backupOfficers[2]}\n3. ${backupOfficers[3]}\n4. ${backupOfficers[4]}\n5. ${backupOfficers[5]}\n\nMohon koordinasinya. Terima kasih.`;

          const officerMessage = `🔔 *PENGINGAT JADWAL PESALIR*\n\nSelamat pagi ${officerName}!\nAnda dijadwalkan bertugas hari ini sebagai petugas PESALIR.\nMohon hadir tepat waktu dan melaksanakan tugas sesuai SOP.\n\n${backupMessage}`;

          if (officerNumber) {
            await client.sendMessage(`${officerNumber}@c.us`, officerMessage);
            console.log(`Sent notification to officer ${officerName} at ${officerNumber}`);
          }

          if (supervisorName !== "Tidak Ada" && supervisorNumber && supervisorNumber !== officerNumber) {
            const supervisorMessage = `🔔 *PENGINGAT JADWAL PENGAWASAN PESALIR*\n\nSelamat pagi ${supervisorName}!\nAnda dijadwalkan sebagai pengawas PESALIR hari ini.\nPetugas yang bertugas: ${officerName} (${officerNumber})\n\n${backupMessage}`;
            await client.sendMessage(`${supervisorNumber}@c.us`, supervisorMessage);
            console.log(`Sent notification to supervisor ${supervisorName} at ${supervisorNumber}`);
          }

          const adminMessage = `🔔 *INFORMASI JADWAL PESALIR HARI INI*\n\nPetugas: ${officerName} (${officerNumber})\nPengawas: ${supervisorName} (${supervisorNumber || "Tidak Ada"})\n\n${backupMessage}`;

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

const whatsappBotMapping = {};
let client = null;

const initWhatsApp = (sessionId) => {
  if (whatsappBotMapping[sessionId]) {
    return whatsappBotMapping[sessionId];
  }

  client = new Client({
    authStrategy: new LocalAuth({ clientId: sessionId }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-popup-blocking",
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      dumpio: true,
    },
  });

  client.on("qr", async (qr) => {
    try {
      const url = await qrcode.toDataURL(qr);
      io.emit('qr', { sessionId, url });
      console.log(`QR code generated for session: ${sessionId}`);
    } catch (err) {
      console.error("Error generating QR code:", err);
    }
  });

  client.on("ready", () => {
    console.log("Client is ready!");
    io.emit('ready', { sessionId });
    const now = new Date();
    client.readyTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    schedulePesalirNotifications();
  });

  client.on("authenticated", (session) => {
    console.log("AUTHENTICATED", new Date().toISOString());
    io.emit('authenticated', { sessionId });
  });

  client.on("auth_failure", (msg) => {
    console.error("AUTHENTICATION FAILURE", msg);
    io.emit('auth_failure', { sessionId, message: msg });
  });

  client.on("disconnected", (reason) => {
    console.log("DISCONNECTED", reason, new Date().toISOString());
    io.emit('disconnected', { sessionId, reason });
  });

  client.on("change_state", (state) => {
    console.log("CHANGE_STATE", state, new Date().toISOString());
    io.emit('change_state', { sessionId, state });
  });

  client.on("remote_session_saved", () => {
    console.log("REMOTE_SESSION_SAVED", new Date().toISOString());
    io.emit('remote_session_saved', { sessionId });
  });

  client.on("message", async (message) => {
    if (new Date(message.timestamp * 1000).getTime() > client.readyTimestamp.getTime()) {
      client.sendPresenceAvailable();
      await saveMessage(message);
      client.sendPresenceUnavailable();
    } else {
      console.log("Old message ignored.");
    }
  });

  client.initialize();
  whatsappBotMapping[sessionId] = client;
  return client;
};

const saveMessage = async (message) => {
  try {
    const contact = await message.getContact();
    console.log(message.from);
    const number = contact.number;
    console.log("nomor pengirim pesan: ", number);

    const isiPesan = message.body;
    console.log("isi pesan: ", isiPesan);

    console.log("Apakah group: ", contact.isGroup);

    if (message.from.includes("@lid") || message.from.includes("@c.us") || message.from.includes("@s.whatsapp.net")) {
      if (isiPesan.toLowerCase().includes("kirim-pesan-umum")) {
        const [, idMessage, category, messageText] = isiPesan.split("::");
        const nomorPengguna = number;
        try {
          const adminResponse = await axios.get(`${API}?action=read-admin`);
          const adminNumbers = adminResponse.data.records.map((admin) => admin.no);
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
            await client.sendMessage(`${nomorPengguna}@c.us`, "Maaf, Anda tidak memiliki izin untuk mengirim pesan umum.");
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
        }
        return;
      }

      const updateMatch = isiPesan.match(/^#UPDATE_(\w+)_(\d+)_(\w+)_(\d+)(?:_(\w+))?$/i);
      if (updateMatch) {
        const [, kodesls, jumlah, kategori, jumlahSubmit, statusSls] = updateMatch;
        const id = uuidv4();
        const no = number;

        if (kategori.toUpperCase() !== "PML" && kategori.toUpperCase() !== "PPL") {
          await client.sendMessage(`${number}@c.us`, "kategori harus PML atau PPL");
          return;
        }

        const isPML = kategori.toUpperCase() === "PML";
        const statusLower = isPML ? "" : (statusSls || "").toLowerCase();

        if (!isPML && statusLower !== "selesai" && statusLower !== "belum") {
          await client.sendMessage(`${number}@c.us`, "statusSls harus 'selesai' atau 'belum'");
          return;
        }

        try {
          const chat = await message.getChat();
          await chat.sendSeen();
          await chat.sendStateTyping();
          const checkResponse = await axios.get(`${API}?action=readDBSLS`);
          const records = checkResponse.data.records;
          const isRegistered = records.some((record) => String(record.noHPMitra) === String(no) || String(record.noHpPml) === String(no));
          if (!isRegistered) {
            await client.sendMessage(`${number}@c.us`, "anda tidak punya wewenang update data");
            return;
          }
          const slsMatch = records.some(
            (record) =>
              (String(record.noHPMitra) === String(no) &&
              String(record.kodeSLS).startsWith(String(kodesls))) ||
              (String(record.noHpPml) === String(no) &&
              String(record.kodeSLS).startsWith(String(kodesls)))
          );
          if (!slsMatch) {
            await client.sendMessage(`${number}@c.us`, "sls tidak tepat");
            return;
          }
          const baseUrl = `https://script.google.com/macros/s/AKfycbxryhvmXetPamDTnX0PwgdQmo0t7dluEPIPHajXMRb4j0Res05WrPbM-lEMfBG3_39oMQ/exec`;
          const updateUrl = `${baseUrl}?action=save-record-message-sls&kodesls=${kodesls}&no=${no}&jumlah=${jumlah}&kategori=${kategori}&id=${id}&jumlahSubmit=${jumlahSubmit}&statusSls=${statusLower}`;
          await axios.get(updateUrl);
          await client.sendMessage(`${number}@c.us`, "data sudah terupdate");
        } catch (error) {
          console.error("Error processing UPDATE command:", error);
          await client.sendMessage(`${number}@c.us`, "data gagal diupdate");
        }
        return;
      }

      if (isiPesan.trim().toUpperCase() === "#CHECKSLS") {
        try {
          const chat = await message.getChat();
          await chat.sendSeen();
          await chat.sendStateTyping();
          const checkResponse = await axios.get(`${API}?action=readDBSLS`);
          const records = checkResponse.data.records;
          const userRecords = records.filter((record) => String(record.noHPMitra) === String(number) || String(record.noHpPml) === String(number) );
          if (userRecords.length === 0) {
            await client.sendMessage(`${number}@c.us`, "anda tidak punya wewenang");
            return;
          }
          let listMessage = "*Daftar SLS Anda:*\n\n";
          userRecords.forEach((record, index) => {
            const isPML = String(record.noHpPml) === String(number);
            const role = isPML ? "PML" : "PPL";
            listMessage += `${index + 1}. ${record.kodeSLS} - ${record.nmsls} (${role})\n`;
            if (isPML) {
              listMessage += `   ├ Approve: ${record.JumlahApproved || 0}\n`;
              listMessage += `   └ Reject: ${record.JumlahReject || 0}\n`;
            } else {
              listMessage += `   ├ Selesai Lapangan: ${record.jumlahSelesaiLapangan || 0}\n`;
              listMessage += `   ├ Submit: ${record.jumlahSubmit || 0}\n`;
              listMessage += `   └ Status: ${record.statusSls || "-"}\n`;
            }
          });
          listMessage += `\nTotal SLS: ${userRecords.length}.\n\nFormat UPDATE:\n- PML: #UPDATE_{kodesls}_{jumlah Approve}_PML_{jumlah Reject}\n- PPL: #UPDATE_{kodesls}_{jumlah selesai lapangan}_PPL_{jumlah Submit}_{Status SLS}\n\nContoh:\n- #UPDATE_61************_10_PML_5\n- #UPDATE_61************_10_PPL_5_Selesai (untuk progress sudah selesai)\n- #UPDATE_61************_10_PPL_5_Belum (untuk progress belum selesai)`;
          await client.sendMessage(`${number}@c.us`, listMessage);
        } catch (error) {
          console.error("Error processing CHECKSLS command:", error);
          await client.sendMessage(`${number}@c.us`, "gagal mengambil data sls");
        }
        return;
      }

      const command = isiPesan.toLowerCase();
      if (!userState[`${number}@c.us`] || userState[`${number}@c.us`] === null) {
        switch (command) {
          case "1":
            await handleAdminMode(message, `${number}@c.us`);
            break;
          case "2":
            await handleBotMode(message, `${number}@c.us`);
            break;
          case "00":
            await handleResetMode(message, `${number}@c.us`);
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
              `${number}@c.us`
            );
        }
      } else if (userState[`${number}@c.us`] === "admin" || userState[`${number}@c.us`] === "bot") {
        if (command === "00") {
          await handleResetMode(message, `${number}@c.us`);
        } else if (userState[`${number}@c.us`] === "bot") {
          await useTemplateMessageKawan(message, `${number}@c.us`);
        }
      }
    }
  } catch (error) {
    console.log("Error in saveMessage:", error);
  }
};

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT_EXCEPTION", err && err.stack ? err.stack : err);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED_REJECTION", reason);
});

const deleteFolderRecursive = (dirPath) => {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach((file) => {
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dirPath);
  }
};

const destroySession = async (sessionId) => {
  const sid = sessionId || 'default';
  console.log(`Destroying session: ${sid}`);

  const existingClient = whatsappBotMapping[sid];
  if (existingClient) {
    try {
      await existingClient.destroy();
    } catch (err) {
      console.error('Error destroying client:', err);
    }
    delete whatsappBotMapping[sid];
  }

  const authDir = path.join(process.cwd(), '.wwebjs_auth');
  if (fs.existsSync(authDir)) {
    deleteFolderRecursive(authDir);
    console.log(`Deleted auth folder: ${authDir}`);
  }

  client = null;
  console.log(`Session ${sid} destroyed`);
};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('create-session', async (sessionId) => {
    const sid = sessionId || 'default';
    console.log(`Creating session: ${sid}`);
    initWhatsApp(sid);
  });

  socket.on('disconnect-session', async (sessionId) => {
    const sid = sessionId || 'default';
    console.log(`Disconnect requested for session: ${sid}`);
    await destroySession(sid);
    socket.emit('session-destroyed', { sessionId: sid });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  const url = `http://localhost:${port}`;
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
  require('child_process').exec(cmd);
});
