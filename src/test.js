
const dotenv = require('dotenv');
dotenv.config();
const API = process.env.APIKEY;

const cekSpreadsheetMessage = async (message) => {
    const response = API;
    return response;
}

async function start(){
  const message = await cekSpreadsheetMessage("3.1");
  console.log(message);
}

start();

// module.exports.cekSpreadsheetMessage = cekSpreadsheetMessage;
