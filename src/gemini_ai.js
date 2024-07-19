const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const runGeminiAi = async (message) => {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `Dengan informasi tambahan sumber pencarian google dan web bps sanggau di link (https://sanggaukab.bps.go.id/), Jawablah pesan berikut sebagai admin BPS Kawan Sanggau dengan ramah sebanyak paling banyak maksimal 30 kata: ${message}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = `${response.text()} \n\n*Disclaimer:*\nJawaban ini dihasilkan oleh asisten digital. Kami sangat menghargai saran dan kritik Anda untuk pengembangan yang lebih baik. Terima kasih!😁`;
    console.log(text);
    return text;
}

module.exports.runGeminiAi = runGeminiAi;