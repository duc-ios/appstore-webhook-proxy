// utils/eventTemplates.js

const {
  getAppStoreStatusLabel,
  getStatusEmoji,
  getBuildUploadStateLabel,
  getBuildUploadStateEmoji,
  getExternalBuildStateLabel,
  getExternalBuildStateEmoji,
} = require("./stateDescriptions");

const { getBuildUploadInfo } = require("../services/buildUploadInfoFetcher");
const { DateTime } = require("luxon");

function formatTimestamp(iso) {
  const timezone = process.env.TIMEZONE || "UTC";
  const date = DateTime.fromISO(iso, { zone: "utc" }).setZone(timezone);
  return date.toFormat("ccc, dd LLL yyyy HH:mm:ss ZZZZ");
}

async function buildTeamsMessage(payload) {
  console.log(`Received payload: ${JSON.stringify(payload, null, 2)}`);

  const type = payload.data?.type || "unknown";
  const rawTimestamp =
    payload.data?.attributes?.timestamp || new Date().toISOString();
  const timestamp = formatTimestamp(rawTimestamp);

  const APP_STORE_URL = process.env.APP_STORE_URL || null;

  const events = {
    appStoreVersionAppVersionStateUpdated: () => {
      const newValue = payload.data.attributes.newValue;
      const oldValue = payload.data.attributes.oldValue;

      const facts = [
        {
          name: `${getStatusEmoji(newValue)} Current Status`,
          value: `**${getAppStoreStatusLabel(newValue)}**`,
        },
        {
          name: "Previous Status",
          value: `${getAppStoreStatusLabel(oldValue)}`,
        },
      ];

      if (APP_STORE_URL) {
        facts.push({
          name: "App Store",
          value: `[View on App Store](${APP_STORE_URL})`,
        });
      }

      facts.push(
        { name: "⏱️ Timestamp", value: timestamp },
        {
          name: "Version ID",
          value: payload.data.relationships.instance.data.id,
        }
      );

      return {
        title: "🚀 App Version Status Updated",
        facts,
      };
    },

    webhookPingCreated: () => ({
      title: "🔄 Webhook Test Ping",
      facts: [
        { name: "📨 Ping ID", value: payload.data.id },
        { name: "⏱️ Timestamp", value: timestamp },
      ],
    }),

    webhookPings: () => null,

    betaFeedbackScreenshotSubmissionCreated: () => {
      const feedbackId = payload.data.relationships?.instance?.data?.id;
      const timestamp = formatTimestamp(payload.data.attributes.timestamp);

      const adamId = process.env.APP_ADAM_ID;
      const bundleId = process.env.APP_BUNDLE_ID;
      const platformId = process.env.APP_PLATFORM_ID;

      const facts = [
        {
          name: "🆔 Screenshot ID",
          value: `\`${feedbackId}\``,
        },
        {
          name: "⏱️ Timestamp",
          value: timestamp,
        },
      ];

      const isValidFeedbackId =
        typeof feedbackId === "string" && feedbackId.trim() !== "";

      if (isValidFeedbackId && adamId) {
        const webLink = `https://appstoreconnect.apple.com/apps/${adamId}/testflight/screenshots/${feedbackId}`;
        facts.push({
          name: "🌐 View in App Store Connect",
          value: `[Open Link](${webLink})`,
        });
      }

      if (isValidFeedbackId && adamId && bundleId && platformId) {
        const xcodeLink = `xcode://organizer/feedback/downloadFeedback?adamId=${adamId}&feedbackId=${feedbackId}&bundleId=${bundleId}&platformId=${platformId}&userAgent=appStoreConnect`;
        facts.push({
          name: "💻 Open in Xcode Organizer",
          value: `[Open in Xcode](${xcodeLink})`,
        });
      }

      return {
        title: "🧪 TestFlight Feedback Screenshot Submitted",
        facts,
      };
    },

    betaFeedbackCrashSubmissionCreated: () => {
      const crashId = payload.data.relationships?.instance?.data?.id;
      const timestamp = formatTimestamp(payload.data.attributes.timestamp);

      const adamId = process.env.APP_ADAM_ID;

      const facts = [
        {
          name: "🆔 Crash ID",
          value: `\`${crashId}\``,
        },
        {
          name: "⏱️ Timestamp",
          value: timestamp,
        },
      ];

      const isValidCrashId =
        typeof crashId === "string" && crashId.trim() !== "";

      if (isValidCrashId && adamId) {
        const webLink = `https://appstoreconnect.apple.com/apps/${adamId}/testflight/crashes/${crashId}`;
        facts.push({
          name: "🌐 View in App Store Connect",
          value: `[Open Link](${webLink})`,
        });
      }

      return {
        title: "🐞 TestFlight Crash Feedback Submitted",
        facts,
      };
    },

    buildUploadStateUpdated: async () => {
      const newState = payload.data.attributes?.newState;
      const oldState = payload.data.attributes?.oldState;
      const uploadId = payload.data.relationships?.instance?.data?.id;
      const uploadInfo = await getBuildUploadInfo(uploadId);

      const facts = [
        {
          name: `${getBuildUploadStateEmoji(newState)} Current State`,
          value: `**${getBuildUploadStateLabel(newState)}**`,
        },
        {
          name: "Previous State",
          value: `${getBuildUploadStateLabel(oldState)}`,
        },
        {
          name: "🆔 Upload ID",
          value: `\`${uploadId}\``,
        },
        {
          name: "⏱️ Timestamp",
          value: timestamp,
        },
      ];

      return {
        title: "⬆️ App Store Build Upload Processed",
        subTitle: `📱 ${uploadInfo.appName} ${uploadInfo.version} (${uploadInfo.build})`,
        facts,
      };
    },

    buildBetaDetailExternalBuildStateUpdated: () => {
      const externalState = payload.data.attributes?.newExternalBuildState;
      const buildBetaDetailsId = payload.data.relationships?.instance?.data?.id;

      const eventTimestampIso = payload.data.attributes?.timestamp;
      const readableTs = formatTimestamp(eventTimestampIso || rawTimestamp);

      const facts = [
        {
          name: `${getExternalBuildStateEmoji(externalState)} External Status`,
          value: `**${getExternalBuildStateLabel(externalState)}**`,
        },
        {
          name: "🆔 Build Detail ID",
          value: `\`${buildBetaDetailsId}\``,
        },
        {
          name: "⏱️ Timestamp",
          value: readableTs,
        },
      ];

      return {
        title: "📣 TestFlight External Availability Updated",
        facts,
      };
    },
  };

  const template = (await events[type]?.()) ?? {
    title: `📬 Unhandled App Store Event: \`${type}\``,
    facts: [
      { name: "⏱️ Timestamp", value: timestamp },
      {
        name: "🧾 Raw Payload",
        value: "```json\n" + JSON.stringify(payload, null, 2) + "\n```",
      },
    ],
  };

  if (!template) return null;

  // Convert facts from MessageCard format to AdaptiveCard format
  const factSetFacts = template.facts.map((fact) => ({
    title: fact.name,
    value: fact.value,
  }));

  const body = [
    {
      type: "Image",
      url: "https://developer.apple.com/assets/elements/icons/app-store/app-store-128x128_2x.png",
      size: "Medium",
      horizontalAlignment: "Left",
    },
    {
      type: "TextBlock",
      text: template.title,
      weight: "Bolder",
      size: "Large",
      wrap: true,
      spacing: "Medium",
    },
  ];

  // Add subtitle if present
  if (template.subTitle) {
    body.push({
      type: "TextBlock",
      text: template.subTitle,
      weight: "Default",
      size: "Medium",
      isSubtle: true,
      wrap: true,
      spacing: "Small",
    });
  } else {
    body.push({
      type: "TextBlock",
      text: "App Store Connect via Proxy",
      weight: "Default",
      size: "Medium",
      isSubtle: true,
      wrap: true,
      spacing: "Small",
    });
  }

  // Add FactSet
  if (factSetFacts.length > 0) {
    body.push({
      type: "FactSet",
      facts: factSetFacts,
      spacing: "Medium",
    });
  }

  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body: body,
  };
}

module.exports = { buildTeamsMessage };
