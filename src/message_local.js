const bodyParser = require('body-parser');
const fs = require('fs');
// Baca data dari file JSON

const cekLocalMessage = async (message) => {
    const responses = await JSON.parse(fs.readFileSync('./src/cek.json', 'utf8'));
    // console.log(responses);
    const response = responses.find(r => r.nomor === message);
    return response;
}

module.exports.cekLocalMessage = cekLocalMessage;
