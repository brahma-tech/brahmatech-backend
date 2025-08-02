// api/callback.js
const fetch = require("node-fetch");

module.exports = async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }

  try {
    // 1️⃣ Exchange code for access token
    const params = new URLSearchParams();
    params.append("client_id", process.env.CLIENT_ID);
    params.append("client_secret", process.env.CLIENT_SECRET);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", process.env.REDIRECT_URI);

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      body: params,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return res.status(400).json(tokenData);
    }

    // 2️⃣ Get user guilds
    const userGuildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `${tokenData.token_type} ${tokenData.access_token}` },
    });
    const userGuilds = await userGuildsRes.json();

    // 3️⃣ Get bot guilds
    const botGuildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bot ${process.env.BOT_TOKEN}` },
    });
    const botGuilds = await botGuildsRes.json();

    // 4️⃣ Find mutual servers
    const mutualServers = userGuilds.filter(userGuild =>
      botGuilds.some(botGuild => botGuild.id === userGuild.id)
    );

    // 5️⃣ Encode and redirect to GitHub Pages
    const encodedData = Buffer.from(JSON.stringify(mutualServers)).toString("base64");
    res.writeHead(302, {
      Location: `https://brahma-tech.github.io/servers.html?data=${encodedData}`
    });
    res.end();

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
