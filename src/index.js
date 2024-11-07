//inisiasi watsapp web js
const { Client, LocalAuth } = require("whatsapp-web.js");

const qrcode = require("qrcode-terminal");

const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { runDialogFlow } = require("./dialog_flow");
const { cekSpreadsheetMessage } = require("./message_spreadsheet");
const { replaceMultipleStringsAll } = require("./replace-string.js");

const client = new Client({
  authStrategy: new LocalAuth(),
});

// Dictionary to store user states
const userState = {};

// inisial API KEY Spreadsheet
const dotenv = require("dotenv");
const { runDialogFlowSusenas } = require("./dialog_flow_susenas");
dotenv.config();
const API = process.env.APIKEY;
const API2 = process.env.APIKEY2;
const noChatbot = process.env.APIKEY;
const noAdmin1 = process.env.NOADMIN1;
const noAdmin2 = process.env.NOADMIN2;
const noAdmin3 = process.env.NOADMIN3;
const noAdmin4 = process.env.NOADMIN4;

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

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

async function saveMessage(message) {
  try {
    // ambil data contact
    const contact = await message.getContact();
    const contactId = contact.id._serialized; // Unique ID for the contact

    // Process message with bot if user is in "bot mode"
    if (message.id.remote.includes("@c.us") && message.type === "chat") {
      if (message.body.toLowerCase().includes("kirim-pesan-umum")) {
        const idMessage = message.body.toLowerCase().split("::")[1];
        const category = message.body.toLowerCase().split("::")[2];
        const messageText = message.body.split("::")[3];
        const nomorPengguna = contactId.replace("@c.us", "");
        if (
          nomorPengguna === noAdmin1 ||
          nomorPengguna === noAdmin2 ||
          nomorPengguna === noAdmin3 ||
          nomorPengguna === noAdmin4
        ) {
          await getData(idMessage, messageText);
        }
      }

      //check apakah dalam mode bot atau admin
      // if (!userState[contactId] || userState[contactId] == null) {
      //   // pilih apakah ingin mode pelayanan publik atau rekrutmen? buat condition

      //   await modeTyping(message, `Halo berhubung lagi proses rekrutmen mitra 2025 fitur apa yang anda inginkan? pilih dibawah ini ya\n1. Rekrutmen mitra 2025 (fitur jawab otomatis di nonaktifkan dan akan dijawab langsung oleh admin)\n2. Chatbot Pelayanan Publik (fitur jawab otomatis aktif)\nKirim "1" untuk Rekrutmen dan "2" untuk Chatbot Pelayanan Publik. Untuk kembali ke fitur awal maka kirim "00"`, contactId);

      //   if (message.body.toLowerCase() === "1") {
      //     userState[contactId] = "admin"; // Set state to admin mode
      //     await modeTyping(message, `Anda akan dihubungkan dengan admin, mohon tunggu. Chatbot akan berhenti merespon. Ketik '00' untuk kembali ke menu awal.`, contactId);
      //     console.log(`User ${contactId} is in admin mode`);

      //     // Notify the admin
      //     const adminNumber = `${noAdmin1}@c.us`; // Replace with admin's number
      //     const adminNumber2 = `${noAdmin2}@c.us`; // Replace with admin's number

      //     // hapus karakter @c.us dari contactId
      //     const nomorPengguna = contactId.replace("@c.us", "");

      //     await client.sendMessage(
      //       adminNumber,
      //       `User https://wa.me/${nomorPengguna} ingin menghubungi admin. Pesan: ${message.body}`
      //     );
      //     await client.sendMessage(
      //       adminNumber2,
      //       `User https://wa.me/${nomorPengguna} ingin menghubungi admin. Pesan: ${message.body}`
      //     );
      //     return; // Stop further processing by the bot
      //   } else if (message.body.toLowerCase() === "2") {
      //     userState[contactId] = "bot";
      //     await modeTyping(message, `Anda sekarang berinteraksi dengan chatbot. Ada yang bisa saya bantu?`, contactId);
      //   } else if (message.body.toLowerCase() === "00") {
      //     userState[contactId] = null;
      //     await modeTyping(message, `Anda sekarang kembali ke fitur awal. Ada yang bisa saya bantu?\n1. Rekrutmen mitra 2025 (fitur jawab otomatis di nonaktifkan dan akan dijawab langsung oleh admin)\n2. Chatbot Pelayanan Publik (fitur jawab otomatis aktif)\nKirim "1" untuk Rekrutmen dan "2" untuk Chatbot Pelayanan Publik. Untuk kembali ke fitur awal maka kirim |"00"`, contactId);
      //   }
      // } else if (userState[contactId] === "admin") {
      //   // Reactivate bot only if user types 'finish'
      //   if (message.body.toLowerCase() === "00") {
      //     userState[contactId] = null; // Switch back to bot mode
      //     await modeTyping(message, `Anda sekarang kembali berinteraksi dengan chatbot. Ada yang bisa saya bantu?`, contactId);
      //   }
      //   return; // Do not process further messages by bot
      // } else if (userState[contactId] === "bot") {
      //   if (message.body.toLowerCase() === "00") {
      //     userState[contactId] = null; // Switch back to bot mode
      //     await modeTyping(message, `Anda sekarang kembali berinteraksi dengan chatbot. Ada yang bisa saya bantu?`, contactId);
      //   }
      //   await useTemplateMessageKawan(message, contact);
      // }  
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

async function getData(idMessage, messageText) {
  try {
    await axios.get(`${API2}?action=read`).then(async function (response) {
      const data = response.data["records"];

      console.log(data);
      //for each
      for (const element of data) {
        if (
          element["idMessage"].toString() === idMessage.toString() &&
          element["status"].toString() === "true"
        ) {
          try {
            console.log("masuk fungsi looping spam");
            // await client.sendMessage(`${element["no"]}@c.us`, `Test wa bot ${element["panggilan"]} ${element["nama"]}`);

            const no = element["no"];
            const panggilan = element["panggilan"];
            const nama = element["nama"];
            const status = element["status"];
            const catatan = element["catatan"];
            const cp = element["cp"];
            const idMessage = element["idMessage"];
            const Tanggal = element["Tanggal"];
            const Waktu = element["Waktu"];
            const Username = element["Username"];
            const Password = element["Password"];
            const Email = element["Email"];
            const Grup = element["Grup"];
            const NamaSurvei = element["Nama_Survei"];
            const Role = element["Role"];
            const Link = element["Link"];
            const replacement = [
              [no, "[[no]]"],
              [panggilan, "[[panggilan]]"],
              [nama, "[[nama]]"],
              [status, "[[status]]"],
              [catatan, "[[catatan]]"],
              [cp, "[[cp]]"],
              [idMessage, "[[idMessage]]"],
              [Tanggal, "[[Tanggal]]"],
              [Waktu, "[[Waktu]]"],
              [Username, "[[Username]]"],
              [Password, "[[Password]]"],
              [Email, "[[Email]]"],
              [Grup, "[[Grup]]"],
              [NamaSurvei, "[[Nama Survei]]"],
              [Role, "[[Role]]"],
              [Link, "[[Link]]"],
            ];

            const newString = await replaceMultipleStringsAll(
              messageText,
              replacement
            );
            console.log(newString);
            //***pesan untuk konfirmasi***
            await client.sendMessage(`${no}@c.us`, newString);

            console.log(`sukses kirim data untuk no: ${element["no"]}`);
            const date = new Date();
            await axios.get(
              `${API2}?action=update&id=${
                element["no"]
              }&status=false${date.getTime()}`
            );
          } catch (error) {
            console.log(`gagal kirim data untuk no: ${element["nama"]}`);
            console.log(error);
          }

          await delay(1000);
        }
      }
      //end for each
    });
  } catch (error) {
    console.log(error);
  }
}

async function modeTyping(message, replyMessage, contactId) {
  // tanda sudah masuk fungsi useTemplateMessage()
  console.log("masuk fungsi proses pesan");

  // mengambil pesan untuk bisa menjalankan method khusus dari bot
  const chat = await message.getChat();

  // mengubah status pesan menjadi centang biru
  await chat.sendSeen();

  // mengubah status bot menjadi sedang mengetik....
  await chat.sendStateTyping();

  // hitung waktu pengetikkan
  const typingTime = Math.min((replyMessage.length / 200) * 60000, 2000);

  // fungsi waktu tunggu ketik
  await new Promise((resolve) => setTimeout(resolve, typingTime));

  // mengirim pesan yang sudah disesuaikan ke user
  client.sendMessage(
    contactId,
    `${replyMessage.toString()}`
  );
}

client.initialize();
