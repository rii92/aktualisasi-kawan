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

const runPrompt = async (message) => {
  try {
    const systemMessage = `Saya sebagai admin BPS Sanggau. ${message}. Jawab dalam 1 paragraf dan sesingkat mungkin.`;
    const response = await openai.chat.completions.create({
      model: "deepseek/deepseek-r1:free",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: message },
      ],
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error:", error);
    return "Maaf, terjadi kesalahan saat memproses permintaan Anda.";
  }
};

async function start() {
  const message = await runPrompt("Siapa Anda");
  console.log(message);
}

start();