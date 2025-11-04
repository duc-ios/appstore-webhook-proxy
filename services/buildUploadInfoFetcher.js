const axios = require("axios");
const jwt = require("jsonwebtoken");
const fs = require("fs");

const APPSTORE_CONNECT_JWT_TOKEN = process.env.APPSTORE_CONNECT_JWT_TOKEN;

// App Store Connect JWT Configuration
const APPSTORE_CONNECT_PRIVATE_KEY_BASE64 =
  process.env.APPSTORE_CONNECT_PRIVATE_KEY_BASE64;
const APPSTORE_CONNECT_KEY_ID = process.env.APPSTORE_CONNECT_KEY_ID;
const APPSTORE_CONNECT_ISSUER_ID = process.env.APPSTORE_CONNECT_ISSUER_ID;

// JWT Token generation from private key (supports both file and base64)
function generateJWT() {
  if (!APPSTORE_CONNECT_KEY_ID || !APPSTORE_CONNECT_ISSUER_ID) {
    throw new Error(
      "App Store Connect private key configuration incomplete. Please set KEY_ID and ISSUER_ID."
    );
  }

  try {
    let privateKey;

    // Priority 1: Use base64-encoded private key
    if (APPSTORE_CONNECT_PRIVATE_KEY_BASE64) {
      console.log("Using base64-encoded private key");
      privateKey = Buffer.from(
        APPSTORE_CONNECT_PRIVATE_KEY_BASE64,
        "base64"
      ).toString("utf8");
    } else {
      throw new Error(
        "No private key provided. Please set either APPSTORE_CONNECT_PRIVATE_KEY_BASE64."
      );
    }

    // JWT payload
    const payload = {
      iss: APPSTORE_CONNECT_ISSUER_ID,
      exp: Math.floor(Date.now() / 1000) + 20 * 60, // 20 minutes from now
      aud: "appstoreconnect-v1",
    };

    // JWT header
    const header = {
      alg: "ES256",
      kid: APPSTORE_CONNECT_KEY_ID,
      typ: "JWT",
    };

    // Generate JWT token
    const token = jwt.sign(payload, privateKey, {
      algorithm: "ES256",
      header: header,
    });

    console.log("✅ Generated App Store Connect JWT token");
    return token;
  } catch (error) {
    console.error("❌ Failed to generate JWT token:", error.message);
    throw error;
  }
}

// Get JWT token (either pre-generated or generate from private key)
function getJWTToken() {
  // If pre-generated token is provided, use it
  if (APPSTORE_CONNECT_JWT_TOKEN) {
    return APPSTORE_CONNECT_JWT_TOKEN;
  }

  // Otherwise, generate from private key
  return generateJWT();
}

async function getBuildUploadInfo(buildUploadId) {
  try {
    const token = getJWTToken();
    const response = await axios.get(
      `https://api.appstoreconnect.apple.com/v1/buildUploads/${buildUploadId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(
      `✅ Fetched build upload info ${JSON.stringify(response.data, null, 2)}`
    );
    const attributes = response.data.data.attributes;
    return {
      version: attributes.cfBundleShortVersionString,
      build: attributes.cfBundleVersion,
    };
  } catch (error) {
    console.error(
      "❌ Failed to fetch build upload info:",
      error.response?.data || error.message
    );
    throw error;
  }
}

module.exports = { getBuildUploadInfo };
