require("dotenv").config();
const OpenAI = require("openai");

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.APIKEY_DEEPSEK,
  defaultHeaders: {
    "HTTP-Referer": "https://bps-sanggau.example.com", // Ganti dengan URL situs Anda
    "X-Title": "BPS Sanggau Chatbot", // Ganti dengan nama situs Anda
  },
});

const runDeepSeek = async (message) => {
  try {
    const systemMessage = `Dengan informasi tambahan sumber pencarian google dan web bps sanggau di link (https://sanggaukab.bps.go.id/), Jawablah pesan berikut sebagai admin BPS Kawan Sanggau dengan ramah sebanyak paling banyak maksimal 30 kata:  ${message}`;
    const response = await openai.chat.completions.create({
      model: "deepseek/deepseek-r1:free",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: message },
      ],
    });

    const text = response.choices[0].message.content;
    `${text} \n\n*Disclaimer:*\nJawaban ini dihasilkan oleh asisten digital (DeepSeek AI). Kami sangat menghargai saran dan kritik Anda untuk pengembangan yang lebih baik. Terima kasih!😁`;
  } catch (error) {
    console.error("Error:", error);
    return "Maaf, terjadi kesalahan saat memproses permintaan Anda.";
  }
};

module.exports.runDeepSeek = runDeepSeek;