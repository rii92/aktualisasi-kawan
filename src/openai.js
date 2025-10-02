require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY1);

const runDeepSeek = async (message) => {
  try {
    const systemMessage = `Dengan informasi tambahan sumber pencarian google dan web bps sanggau di link (https://sanggaukab.bps.go.id/), Jawablah pesan berikut sebagai admin BPS Kawan Sanggau dengan ramah sebanyak paling banyak maksimal 30 kata:  ${message}`;
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: systemMessage,
    });
    const text = response.text;

    return `${text} \n\n*Disclaimer:*\nJawaban ini dihasilkan oleh asisten digital (DeepSeek AI). Kami sangat menghargai saran dan kritik Anda untuk pengembangan yang lebih baik. Terima kasih!😁`;
  } catch (error) {
    console.error("Error:", error);
    return "Maaf, terjadi kesalahan saat memproses permintaan Anda.";
  }
};

// async function start() {
//   const message = await runDeepSeek("Siapa Anda");
//   console.log(message);
// }

// start();
module.exports.runDeepSeek = runDeepSeek;