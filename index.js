const WebSocket = require('ws');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Caché para evitar duplicados
const recentLogs = new Set();

const CONFIG = {
    WEBHOOK_URL: process.env.DISCORD_WEBHOOK,
    PLACE_ID: "109983668079237",
    THUMBNAIL_URL: "https://cdn.discordapp.com/attachments/1475916194803355673/1488480971056742430/lv_0_20260328165632.png?ex=69ccef6e&is=69cb9dee&hm=b3916b927b605ce766d149938fab8e3187956fb8d68707ba29ea9e4d7a07f148&",
    SOURCES: [
        "wss://worker2.goalforest.workers.dev/ws",
        "wss://jw-auto-joiner-production-bda0.up.railway.app/",
        "wss://finders-port-websocket-production.up.railway.app/ws"
    ],
    RECONNECT_INTERVAL: 5000,
    CACHE_TIME: 10000 // 10 segundos de bloqueo para el mismo log
};

app.get('/', (req, res) => res.send('Sakura Highlights 🌸 Online 24/7'));
app.listen(PORT, () => console.log(`🚀 Sakura API lista en puerto ${PORT}`));

async function notifyDiscord(logData) {
    if (!CONFIG.WEBHOOK_URL) return;

    // Crear una huella única para el log (Nombre + JobID)
    const logFingerprint = `${logData.name}-${logData.jobid}`;

    // Si ya enviamos este log recientemente, lo ignoramos
    if (recentLogs.has(logFingerprint)) return;

    try {
        recentLogs.add(logFingerprint); // Añadir al caché
        
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
        console.log(`🌸 Sakura Log enviado: ${logData.name}`);

        // Eliminar del caché después de 10 segundos para permitir nuevas apariciones legales
        setTimeout(() => recentLogs.delete(logFingerprint), CONFIG.CACHE_TIME);

    } catch (err) {
        console.error("❌ Error en el Webhook");
        recentLogs.delete(logFingerprint); // Limpiar si falló el envío
    }
}

function connect(url) {
    const ws = new WebSocket(url);

    ws.on('open', () => console.log(`🔗 Sakura conectada a: ${url}`));

    ws.on('message', (raw) => {
        try {
            const parsed = JSON.parse(raw);
            
            // Caso 1: Goalforest/JW
            if (parsed.type === "new" && parsed.data) {
                notifyDiscord({
                    name: parsed.data.name || "Unknown Sakura",
                    generation: parsed.data.generation || "$0M/s",
                    jobid: parsed.data.jobid || "0"
                });
            } 
            // Caso 2: Finders Port
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
