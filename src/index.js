//inisiasi watsapp web js
const { Client, LocalAuth } = require("whatsapp-web.js");

const qrcode = require("qrcode-terminal");

const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { runDialogFlow } = require("./dialog_flow");
const { cekSpreadsheetMessage } = require("./message_spreadsheet");

const client = new Client({
  authStrategy: new LocalAuth(),
});

// inisial API KEY Spreadsheet
const dotenv = require("dotenv");
const { runDialogFlowSusenas } = require("./dialog_flow_susenas");
dotenv.config();
const API = process.env.APIKEY;
const noChatbot = process.env.APIKEY;

client.on("qr", (qr) => {
  qrcode.generate(qr, {
    small: true,
  });
});

client.on("ready", async () => {
  console.log("Client is ready!");

  // Menandai waktu saat bot siap dengan tingkat jam
  const now = new Date();
  // Membuat string dengan format YYYY-MM-DDTHH:00:00.000Z
  const hourOnly = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    0,
    0,
    0
  );
  client.readyTimestamp = hourOnly;
});

client.on("authenticated", () => {
  console.log("AUTHENTICATED");
});

client.on("auth_failure", (msg) => {
  console.error("AUTHENTICATION FAILURE", msg);
});

client.on("message", async (message) => {
  // Memeriksa apakah pesan diterima setelah bot siap
  if (
    new Date(message.timestamp * 1000).getTime() >
    client.readyTimestamp.getTime()
  ) {
    // Proses pesan di sini
    // update status bot menjadi aktif
    client.sendPresenceAvailable();

    // Memanggil fungsi menyimpan dan menjalankan
    await saveMessage(message);

    // update status bot menjadi tidak aktif
    client.sendPresenceUnavailable();
  } else {
    console.log("Pesan lama diabaikan.");
  }
});

async function saveMessage(message) {
  try {
    // ambil data contact
    const contact = await message.getContact();

    // cek status apa sudah masuk function
    console.log("masuk save message");

    // mengkondisikan jika pesan nya secara personal maka akan di proses oleh bot
    if (message.id.remote.includes("@c.us") && message.type === "chat") {
      // Memeriksa apakah pesan berisi kata "SUSENAS"
      if (message.body && message.body.toUpperCase().includes("ADMIN")) {
        // Jika pesan mengandung "SUSENAS", jalankan fungsi ini
        // await useTemplateMessageKawanSusenas(message, contact);
      } else {
        // Jika tidak, jalankan fungsi ini
        await useTemplateMessageKawan(message, contact);
      }
    }
  } catch (error) {
    console.log(error);
  }
}

async function useTemplateMessageKawan(message, contact) {
  try {
    // tanda sudah masuk fungsi useTemplateMessage()
    console.log("masuk fungsi proses pesan");

    // mengambil pesan untuk bisa menjalankan method khusus dari bot
    const chat = await message.getChat();

    // mengubah status pesan menjadi centang biru
    await chat.sendSeen();

    // mengubah status bot menjadi sedang mengetik....
    await chat.sendStateTyping();

    // memeriksa pesan opsional di spreadsheet
    const response = await cekSpreadsheetMessage(message.body);

    // inisiasi pesan kosong
    let asnwer = "";

    // cek pesan di spreadsheet
    console.log(`hasil cek local message = ${response}`);

    if (response) {
      asnwer = response;
    } else {
      // cek pesan otomatis dan validasi dengan bot ai
      asnwer = await runDialogFlow(message.body);
    }

    // hitung waktu pengetikkan
    const typingTime = Math.min((asnwer["message"].length / 200) * 60000, 2000);

    // fungsi waktu tunggu ketik
    await new Promise((resolve) => setTimeout(resolve, typingTime));

    // mengirim pesan yang sudah disesuaikan ke user
    client.sendMessage(
      contact.id._serialized,
      `${asnwer["message"].toString()}`
    );

    // save record pesan dari user
    await axios.get(
      `${API}?id=${uuidv4()}&no=${contact.id.user}&name=${
        contact.name
      }&message=${message.body}&action=save-record-message&status=receive`
    );

    // save record pesan dari bot
    await axios.get(
      `${API}?id=${uuidv4()}&no=${noChatbot}&name=BotKawan&message=${
        asnwer["message"]
      }&action=save-record-message&status=send`
    );
  } catch (error) {
    console.log(`error kirim pesan: ${error}`);
  }
}

async function useTemplateMessageKawanSusenas(message, contact) {
  try {
    // tanda sudah masuk fungsi useTemplateMessage()
    console.log("masuk fungsi proses pesan");

    // mengambil pesan untuk bisa menjalankan method khusus dari bot
    const chat = await message.getChat();

    // mengubah status pesan menjadi centang biru
    await chat.sendSeen();

    // mengubah status bot menjadi sedang mengetik....
    await chat.sendStateTyping();

    let asnwer = "";

    asnwer = await runDialogFlowSusenas(message.body);

    // hitung waktu pengetikkan
    const typingTime = Math.min((asnwer["message"].length / 200) * 60000, 2000);

    // fungsi waktu tunggu ketik
    await new Promise((resolve) => setTimeout(resolve, typingTime));

    // mengirim pesan yang sudah disesuaikan ke user
    client.sendMessage(
      contact.id._serialized,
      `${asnwer["message"].toString()}`
    );

    // save record pesan dari user
    // await axios.get(
    //   `${API}?id=${uuidv4()}&no=${contact.id.user}&name=${
    //     contact.name
    //   }&message=${message.body}&action=save-record-message&status=receive`
    // );

    // save record pesan dari bot
    // await axios.get(
    //   `${API}?id=${uuidv4()}&no=6285176957005&name=BotKawan&message=${
    //     asnwer["message"]
    //   }&action=save-record-message&status=send`
    // );
  } catch (error) {
    console.log(`error kirim pesan: ${error}`);
  }
}
client.initialize();
