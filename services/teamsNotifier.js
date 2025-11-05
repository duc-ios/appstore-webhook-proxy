const axios = require("axios");
const { buildTeamsMessage } = require("../utils/eventTemplates");

async function sendToTeams(payload, webhookUrl) {
  const adaptiveCard = await buildTeamsMessage(payload);
  if (!adaptiveCard) return;

  // Wrap AdaptiveCard in Teams message format with attachments
  const message = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: adaptiveCard,
      },
    ],
  };
  console.log(`Sending Teams message: ${JSON.stringify(message, null, 2)}`);

  try {
    await axios.post(webhookUrl, message);
    console.log("✅ Teams message sent successfully.");
  } catch (error) {
    console.error(
      "❌ Failed to send Teams message:",
      error.response?.data || error.message
    );
  }
}

module.exports = { sendToTeams };
