const admin = require("firebase-admin");

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

// Helper: send JSON
function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

module.exports = async (req, res) => {
  try {
    const { action, guildId, userId, type } = req.query;

    // 1️⃣ User stats
    if (action === "user-stats") {
      if (!guildId || !userId)
        return send(res, 400, { error: "Missing guildId or userId" });

      const docSnap = await db.collection("users").doc(`${guildId}_${userId}`).get();
      if (!docSnap.exists) return send(res, 404, { error: "User not found" });

      const data = docSnap.data();
      return send(res, 200, {
        xp: data.xp || 0,
        vcTime: data.vcTime || 0,
        level: data.level || 0,
        streak: data.streak || 0,
        coins: data.coins || 0,
        badges: data.badges || [],
        badgeProgress: data.badgeProgress || {}
      });
    }

    // 2️⃣ Leaderboard
    if (action === "leaderboard") {
      if (!guildId || !type)
        return send(res, 400, { error: "Missing guildId or type" });

      const snap = await db.collection("users").where("guildId", "==", guildId).get();
      let leaderboard = [];

      snap.forEach(doc => {
        const d = doc.data();
        let value = 0;
        if (type === "vc") value = d.vcTime || 0;
        if (type === "msg") value = d.dailyMessageCount || 0;

        leaderboard.push({
          id: d.userId,
          username: d.username || "Unknown",
          avatar: d.avatar || `https://cdn.discordapp.com/embed/avatars/0.png`,
          value
        });
      });

      leaderboard.sort((a, b) => b.value - a.value);
      return send(res, 200, leaderboard.slice(0, 10));
    }

    // 3️⃣ User history
    if (action === "user-history") {
      if (!guildId || !userId)
        return send(res, 400, { error: "Missing guildId or userId" });

      const vcDoc = await db.collection("vc_stats").doc(`${guildId}_${userId}`).get();
      if (!vcDoc.exists) return send(res, 200, { xpHistory: {}, vcHistory: {} });

      const data = vcDoc.data();
      return send(res, 200, {
        xpHistory: data.xpHistory || {},
        vcHistory: data.history || {}
      });
    }

    // Default: API usage help
    send(res, 200, {
      message: "BrahmaTech Stats API",
      usage: [
        "/api/stats?action=user-stats&guildId=GUILD&userId=USER",
        "/api/stats?action=leaderboard&guildId=GUILD&type=vc",
        "/api/stats?action=user-history&guildId=GUILD&userId=USER"
      ]
    });

  } catch (err) {
    console.error(err);
    send(res, 500, { error: "Server error", details: err.message });
  }
};
