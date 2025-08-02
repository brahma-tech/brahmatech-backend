const fetch = require("node-fetch");

module.exports = async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }

  try {
    // Check env vars
    if (
      !process.env.CLIENT_ID ||
      !process.env.CLIENT_SECRET ||
      !process.env.REDIRECT_URI ||
      !process.env.BOT_TOKEN
    ) {
      return res.status(500).json({ error: "Missing environment variables" });
    }

    // 1️⃣ Exchange code for access token
    const params = new URLSearchParams({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.REDIRECT_URI,
    });

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      body: params,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error) {
      console.error("Token exchange failed:", tokenData);
      return res.status(400).json({ error: "Failed to exchange code", details: tokenData });
    }

    // 2️⃣ Get user info
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `${tokenData.token_type} ${tokenData.access_token}` },
    });
    const userInfo = await userRes.json();
    if (!userRes.ok || !userInfo.id) {
      console.error("Failed to fetch user info:", userInfo);
      return res.status(400).json({ error: "Failed to fetch user info" });
    }

    // 3️⃣ Get user guilds
    const userGuildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `${tokenData.token_type} ${tokenData.access_token}` },
    });
    const userGuilds = await userGuildsRes.json();
    if (!userGuildsRes.ok) {
      console.error("Failed to fetch user guilds:", userGuilds);
      return res.status(400).json({ error: "Failed to fetch user guilds" });
    }

    // 4️⃣ Get bot guilds
    const botGuildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bot ${process.env.BOT_TOKEN}` },
    });
    const botGuilds = await botGuildsRes.json();
    if (!botGuildsRes.ok) {
      console.error("Failed to fetch bot guilds:", botGuilds);
      return res.status(400).json({ error: "Failed to fetch bot guilds" });
    }

    // 5️⃣ Find mutual servers
    const mutualServers = userGuilds.filter(userGuild =>
      botGuilds.some(botGuild => botGuild.id === userGuild.id)
    );

    // 6️⃣ Send everything to dashboard
    const payload = {
      token: tokenData.access_token,
      tokenType: tokenData.token_type,
      user: userInfo,
      servers: mutualServers
    };

    const encodedData = Buffer.from(JSON.stringify(payload)).toString("base64");
    const redirectUrl = `https://brahma-tech.github.io/dashboard.html?data=${encodeURIComponent(encodedData)}`;

    res.writeHead(302, { Location: redirectUrl });
    res.end();

  } catch (error) {
    console.error("Callback Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
