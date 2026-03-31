const WebSocket = require('ws');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// CONFIGURACIÓN DESDE RAILWAY
const CONFIG = {
    WEBHOOK_URL: process.env.DISCORD_WEBHOOK,
    PLACE_ID: "109983668079237",
    SOURCES: [
        "wss://worker2.goalforest.workers.dev/ws",
        "wss://jw-auto-joiner-production-bda0.up.railway.app/"
    ],
    RECONNECT_INTERVAL: 5000
};

// Servidor Web para Keep-Alive (Evita que Railway lo apague)
app.get('/', (req, res) => {
    res.send('🚀 Noctis Notifier está ONLINE 24/7');
});

app.listen(PORT, () => {
    console.log(`📡 Servidor HTTP activo en puerto ${PORT}`);
});

// Validación de Webhook
if (!CONFIG.WEBHOOK_URL) {
    console.error("❌ ERROR: Configura 'DISCORD_WEBHOOK' en las variables de Railway.");
    process.exit(1);
}

/**
 * Envío de notificaciones a Discord
 */
async function notifyDiscord(data) {
    try {
        const joinLink = `https://www.roblox.com/games/start?placeId=${CONFIG.PLACE_ID}&gameInstanceId=${data.jobId}`;

        const payload = {
            username: "Noctis Notifier",
            embeds: [{
                title: "Noctis Notify | Highlights",
                description: `${data.content}\n\n**🔗 [¡Unete al servidor!](${joinLink})**`,
                color: 10181046,
                footer: { text: "discord.gg/noctisnotify | v1" },
                timestamp: new Date()
            }]
        };

        await axios.post(CONFIG.WEBHOOK_URL, payload);
        console.log("✅ Log enviado satisfactoriamente.");
    } catch (error) {
        console.error("❌ Error enviando a Discord:", error.message);
    }
}

/**
 * Conexión persistente a WebSockets
 */
function connect(url) {
    const ws = new WebSocket(url);

    ws.on('open', () => console.log(`🔗 Conectado a: ${url}`));

    ws.on('message', (raw) => {
        try {
            const parsed = JSON.parse(raw);
            notifyDiscord({ 
                content: parsed.message || parsed.description || "Nueva actividad detectada", 
                jobId: parsed.jobId || "0" 
            });
        } catch {
            notifyDiscord({ content: raw.toString(), jobId: "0" });
        }
    });

    ws.on('close', () => {
        setTimeout(() => connect(url), CONFIG.RECONNECT_INTERVAL);
    });

    ws.on('error', () => {});
}

// Iniciar monitoreo de fuentes
CONFIG.SOURCES.forEach(url => connect(url));

// Auto-Ping cada 10 minutos para asegurar que no se duerma
setInterval(() => {
    console.log("💓 Manteniendo sistema despierto...");
    axios.get(`http://localhost:${PORT}`).catch(() => {});
}, 600000);
