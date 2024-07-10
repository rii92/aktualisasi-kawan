const nlp = require('compromise');

function extractKeywords(sentence) {
  const doc = nlp(sentence);
  const keywords = doc.nouns().out('array'); // Mengambil kata benda sebagai kata kunci

  return keywords;
}

// Contoh penggunaan
const sentence = "Node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine";
const keywords = extractKeywords(sentence);

console.log('Keywords:', keywords);