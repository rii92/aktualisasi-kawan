//inisiasi watsapp web js
const {
  Client,
  LocalAuth
} = require("whatsapp-web.js");

const qrcode = require("qrcode-terminal");

const axios = require("axios");
const {
  v4: uuidv4
} = require("uuid");
const {
  runDialogFlow
} = require("./dialog_flow");
const { cekSpreadsheetMessage } = require("./message_spreadsheet");

const client = new Client({
  authStrategy: new LocalAuth()
});

// inisial API KEY Spreadsheet
const dotenv = require('dotenv');
dotenv.config();
const API = process.env.APIKEY;

client.on("qr", (qr) => {
  qrcode.generate(qr, {
    small: true
  });
});

client.on("ready", async () => {
  console.log("Client is ready!");
});

client.on('authenticated', () => {
  console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {
  console.error('AUTHENTICATION FAILURE', msg);
});

client.on("message", async (message) => {
  await saveMessage(message);
});

async function saveMessage(message) {
  try {
    const contact = await message.getContact();
    // const chat = await message.getChat();
    console.log("masuk save message");

    if (message.id.remote.includes("@c.us") && message.type === "chat") {
      await useTemplateMessage(message, contact);
    }
  } catch (error) {
    console.log(error);
  }
}

async function useTemplateMessage(message, contact) {
    try {
      // with dialogFlow
      console.log("mau inisiasi pesan?");
      // const asnwer = await runDialogFlow(message.body.toLowerCase());
      client.sendPresenceAvailable();

      const response = await cekSpreadsheetMessage(message.body);
      let asnwer = '';
      console.log(`hasil cek local message = ${response}`)

      if(response){
        asnwer = response;
      } else{
        asnwer = await runDialogFlow(message.body);
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
      client.sendPresenceUnavailable();

      client.sendMessage(contact.id._serialized, `${asnwer["message"].toString()}`);
      await axios.get(`${API}?id=${uuidv4()}&no=${contact.id.user}&name=${contact.name}&message=${message.body}&action=save-record-message&status=receive`);
      await axios.get(`${API}?id=${uuidv4()}&no=6285176957005&name=BotKawan&message=${asnwer["message"]}&action=save-record-message&status=send`); 
    } catch (error) {
      console.log(`error kirim pesan: ${error}`);
    }
}
client.initialize();