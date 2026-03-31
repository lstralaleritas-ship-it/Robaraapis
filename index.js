const WebSocket = require('ws');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG = {
    // Se configura en el panel de Railway como DISCORD_WEBHOOK
    WEBHOOK_URL: process.env.DISCORD_WEBHOOK,
    PLACE_ID: "109983668079237",
    SOURCES: [
        "wss://worker2.goalforest.workers.dev/ws",
        "wss://jw-auto-joiner-production-bda0.up.railway.app/"
    ],
    RECONNECT_INTERVAL: 5000
};

app.get('/', (req, res) => res.send('Noctis Notifier 24/7 Online'));
app.listen(PORT, () => console.log(`🚀 API activa en puerto ${PORT}`));

async function notifyDiscord(logData) {
    if (!CONFIG.WEBHOOK_URL) return;
    try {
        // Generar link de unión con el jobid del log
        const joinLink = `https://www.roblox.com/games/start?placeId=${CONFIG.PLACE_ID}&gameInstanceId=${logData.jobid}`;
        
        const payload = {
            username: "Noctis Notifier",
            embeds: [{
                title: "Noctis Notify | Highlights",
                description: `**Best**\n**${logData.name}** \`[${logData.generation}]\`\n\n**🔗 [¡Unete al servidor!](${joinLink})**`,
                color: 10181046,
                footer: { text: "discord.gg/noctisnotify | v1" },
                timestamp: new Date()
            }]
        };

        await axios.post(CONFIG.WEBHOOK_URL, payload);
        console.log(`✅ Log enviado: ${logData.name}`);
    } catch (err) {
        console.error("❌ Error enviando a Discord");
    }
}

function connect(url) {
    const ws = new WebSocket(url);

    ws.on('open', () => console.log(`🔗 Conectado a: ${url}`));

    ws.on('message', (raw) => {
        try {
            const parsed = JSON.parse(raw);
            
            // Accedemos a la estructura: parsed.data.name, parsed.data.generation, etc.
            if (parsed.type === "new" && parsed.data) {
                notifyDiscord({
                    name: parsed.data.name || "Unknown",
                    generation: parsed.data.generation || "$0M/s",
                    jobid: parsed.data.jobid || "0"
                });
            }
        } catch (e) {
            // Ignorar mensajes que no sean JSON válido
        }
    });

    ws.on('close', () => {
        setTimeout(() => connect(url), CONFIG.RECONNECT_INTERVAL);
    });

    ws.on('error', () => {});
}

CONFIG.SOURCES.forEach(url => connect(url));
