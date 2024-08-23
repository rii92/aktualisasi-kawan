const dialogflow = require("@google-cloud/dialogflow");
const uuid = require("uuid");
const { runGeminiAi } = require("./gemini_ai");
require("dotenv").config();
/**
 * Send a query to the dialogflow agent, and return the query result.
 * @param {string} projectId The project to be used
 */
const runDialogFlowSusenas = async (message) => {
  // A unique identifier for the given session
  const projectId = process.env.PROJECT_ID_SUSENAS;
  const sessionId = uuid.v4();

  // Create a new session
  const sessionClient = new dialogflow.SessionsClient({
    keyFilename: "susenas-uayv-cb611dda5b7b.json",
  });
  const sessionPath = sessionClient.projectAgentSessionPath(
    projectId,
    sessionId
  );

  // The text query request.
  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        // The query to send to the dialogflow agent
        text: message,
        // The language used by the client (en-US)
        languageCode: "id-ID",
      },
    },
  };

  // Send request and log result
  const responses = await sessionClient.detectIntent(request);
  console.log("Detected intent");
  const result = responses[0].queryResult;
  console.log(`  Query: ${result.queryText}`);
  console.log(`  Response: ${result.fulfillmentText}`);
  if (result.intent) {
    console.log(`  Intent: ${result.intent.displayName}`);
      const jsonMessage = {
        "message": `${result.fulfillmentText}\n\n*Disclaimer:*\nJawaban ini dihasilkan oleh sistem otomatis. Kami sangat menghargai saran dan kritik Anda untuk pengembangan yang lebih baik. Terima kasih!😁`,
        "intent": result.intent.displayName
      }
      return jsonMessage;
  } else {
    const jsonMessage = {
      "message": "Pesan tidak teridentifikasi, mohon coba pesan lainnya",
      "intent": "tidak teridentifikasi"
    }
    return jsonMessage;
  }
};

module.exports.runDialogFlowSusenas = runDialogFlowSusenas;
