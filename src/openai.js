require('dotenv').config();
const { OpenAI } = require("openai");

const openai = new OpenAI({
    apiKey: process.env.OPEN_API_KEY,
});

const runPrompt = async (message) => {
    try {
        const systemMessage = `Saya sebagai admin BPS Sanggau. ${message}. Jawab dalam 1 paragraf dan sesingkat mungkin.`;
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            prompt: systemMessage,
            max_tokens: 60, // Menyesuaikan jumlah maksimum token untuk menjaga jawaban tetap singkat
            temperature: 0.7, // Menyesuaikan temperature untuk keseimbangan antara kreativitas dan relevansi
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
            stop: ["\n"], // Menghentikan generasi teks setelah satu paragraf
        });

        return response.choices[0].text.trim();
    } catch (error) {
        console.error('Error:', error);
        return 'Maaf, terjadi kesalahan saat memproses permintaan Anda.';
    }
};

// const answer = runPrompt("test gpt");
module.exports = { runPrompt };