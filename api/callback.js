const fetch = require("node-fetch");

module.exports = async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }

  try {
    // Ensure required environment variables exist
    if (
      !process.env.CLIENT_ID ||
      !process.env.CLIENT_SECRET ||
      !process.env.REDIRECT_URI ||
      !process.env.BOT_TOKEN
    ) {
      return res.status(500).json({ error: "Missing environment variables" });
    }

    // Make sure redirect URI is absolute
    if (!/^https?:\/\//i.test(process.env.REDIRECT_URI)) {
      return res.status(500).json({ error: "REDIRECT_URI must be an absolute URL" });
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

    // 2️⃣ Get user guilds
    const userGuildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `${tokenData.token_type} ${tokenData.access_token}` },
    });
    const userGuilds = await userGuildsRes.json();
    if (!userGuildsRes.ok) {
      console.error("Failed to fetch user guilds:", userGuilds);
      return res.status(400).json({ error: "Failed to fetch user guilds" });
    }

    // 3️⃣ Get bot guilds
    const botGuildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bot ${process.env.BOT_TOKEN}` },
    });
    const botGuilds = await botGuildsRes.json();
    if (!botGuildsRes.ok) {
      console.error("Failed to fetch bot guilds:", botGuilds);
      return res.status(400).json({ error: "Failed to fetch bot guilds" });
    }

    // 4️⃣ Find mutual servers
    const mutualServers = userGuilds.filter(userGuild =>
      botGuilds.some(botGuild => botGuild.id === userGuild.id)
    );

    // 5️⃣ Encode and redirect to GitHub Pages
    const encodedData = Buffer.from(JSON.stringify(mutualServers)).toString("base64");
    const redirectUrl = `https://brahma-tech.github.io/servers.html?data=${encodeURIComponent(encodedData)}`;

    res.writeHead(302, { Location: redirectUrl });
    res.end();

  } catch (error) {
    console.error("Callback Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
