const axios = require("axios");
// inisial API KEY Spreadsheet
const dotenv = require('dotenv');
dotenv.config();
const API = process.env.APIKEY;

const cekSpreadsheetMessage = async (message) => {
    const responses = await await axios.get(`${API}?action=read`);;
    // console.log(responses);
    const response = responses["data"]["records"].find(r => r.nomor === message);
    return response;
}

// async function start(){
//   const message = await cekSpreadsheetMessage("3.1");
//   console.log(message);
// }

// start();

module.exports.cekSpreadsheetMessage = cekSpreadsheetMessage;
