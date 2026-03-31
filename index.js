const WebSocket = require('ws');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Almacén para bloquear duplicados por ráfagas
const antiSpamMap = new Map();

const CONFIG = {
    // Variable DISCORD_WEBHOOK en Railway
    WEBHOOK_URL: process.env.DISCORD_WEBHOOK,
    PLACE_ID: "109983668079237",
    THUMBNAIL_URL: "https://cdn.discordapp.com/attachments/1475916194803355673/1488480971056742430/lv_0_20260328165632.png?ex=69ccef6e&is=69cb9dee&hm=b3916b927b605ce766d149938fab8e3187956fb8d68707ba29ea9e4d7a07f148&",
    SOURCES: [
        "wss://worker2.goalforest.workers.dev/ws",
        "wss://jw-auto-joiner-production-bda0.up.railway.app/",
        "wss://finders-port-websocket-production.up.railway.app/ws"
    ],
    RECONNECT_INTERVAL: 5000,
    COOLDOWN_MS: 2000 // Bloqueo de duplicados ajustado a 2 segundos
};

app.get('/', (req, res) => res.send('Sakura Highlights 🌸 2s Filter Active'));
app.listen(PORT, () => console.log(`🚀 Sakura API Protegida (2s) en puerto ${PORT}`));

async function notifyDiscord(logData) {
    if (!CONFIG.WEBHOOK_URL) return;

    // Llave única: Nombre + JobID para identificar el log exacto
    const lockKey = `${logData.name}-${logData.jobid}`;

    // Si recibimos el mismo log en menos de 2 segundos, se ignora
    if (antiSpamMap.has(lockKey)) {
        return; 
    }

    try {
        // Bloqueamos la llave inmediatamente
        antiSpamMap.set(lockKey, true);
        
        const joinLink = `https://www.roblox.com/games/start?placeId=${CONFIG.PLACE_ID}&gameInstanceId=${logData.jobid}`;
        
        const payload = {
            username: "Sakura Highlights",
            embeds: [{
                title: "🌸 Sakura Highlights",
                description: `## ${logData.name}\n\`[${logData.generation}]\`\n\n**🔗 [¡Unete al servidor!](${joinLink})**`,
                color: 16751052,
                thumbnail: { url: CONFIG.THUMBNAIL_URL },
                footer: { text: "discord.gg/sakurahighlights | v1" },
                timestamp: new Date()
            }]
        };

        await axios.post(CONFIG.WEBHOOK_URL, payload);
        console.log(`🌸 Log enviado: ${logData.name} (${logData.generation})`);

        // Liberar el bloqueo tras 2 segundos
        setTimeout(() => antiSpamMap.delete(lockKey), CONFIG.COOLDOWN_MS);

    } catch (err) {
        console.error("❌ Error Webhook");
        antiSpamMap.delete(lockKey);
    }
}

function connect(url) {
    const ws = new WebSocket(url);

    ws.on('open', () => console.log(`🔗 Conectada a: ${url}`));

    ws.on('message', (raw) => {
        try {
            const parsed = JSON.parse(raw);
            
            // Goalforest/JW
            if (parsed.type === "new" && parsed.data) {
                notifyDiscord({
                    name: parsed.data.name || "Unknown Sakura",
                    generation: parsed.data.generation || "$0M/s",
                    jobid: parsed.data.jobid || "0"
                });
            } 
            // Finders Port
            else if (parsed.name && parsed.money) {
                notifyDiscord({
                    name: parsed.name,
                    generation: `$${parsed.money}M/s`,
                    jobid: parsed.jobid || "0"
                });
            }
        } catch (e) {}
    });

    ws.on('close', () => setTimeout(() => connect(url), CONFIG.RECONNECT_INTERVAL));
    ws.on('error', () => {});
}

CONFIG.SOURCES.forEach(url => connect(url));
