const WebSocket = require('ws');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG = {
    WEBHOOK_URL: process.env.DISCORD_WEBHOOK,
    PLACE_ID: "109983668079237",
    SOURCES: [
        "wss://worker2.goalforest.workers.dev/ws",
        "wss://jw-auto-joiner-production-bda0.up.railway.app/"
    ],
    RECONNECT_INTERVAL: 5000
};

app.get('/', (req, res) => res.send('🚀 Noctis Notifier 24/7 Online'));
app.listen(PORT, () => console.log(`📡 Puerto: ${PORT}`));

async function notifyDiscord(data) {
    if (!CONFIG.WEBHOOK_URL) return;

    try {
        const joinLink = `https://www.roblox.com/games/start?placeId=${CONFIG.PLACE_ID}&gameInstanceId=${data.jobId}`;
        
        [span_1](start_span)// Formateamos el mensaje para que muestre el Brainrot y el Dinero[span_1](end_span)
        const embedDescription = `**Best**\n**${data.name}** \`[$${data.value}M/s]\`\n\n**🔗 [¡Unete al servidor!](${joinLink})**`;

        const payload = {
            username: "Noctis Notifier",
            embeds: [{
                [span_2](start_span)title: "Noctis Notify | Highlights", //[span_2](end_span)
                description: embedDescription,
                [span_3](start_span)color: 10181046, //[span_3](end_span)
                [span_4](start_span)footer: { text: "discord.gg/noctisnotify | v1" }, //[span_4](end_span)
                timestamp: new Date()
            }]
        };

        await axios.post(CONFIG.WEBHOOK_URL, payload);
    } catch (error) {
        console.error("❌ Error Discord:", error.message);
    }
}

function connect(url) {
    const ws = new WebSocket(url);

    ws.on('message', (raw) => {
        try {
            const parsed = JSON.parse(raw);
            
            // Intentamos extraer los datos del JSON del WebSocket
            // Ajustado para detectar: name, value/money y jobId
            notifyDiscord({
                name: parsed.name || parsed.brainrot || "Desconocido",
                value: parsed.value || parsed.money || "0.00",
                jobId: parsed.jobId || parsed.gameId || "0"
            });
        } catch {
            // Si el mensaje no es JSON, enviamos el texto plano como nombre
            notifyDiscord({ name: raw.toString(), value: "???", jobId: "0" });
        }
    });

    ws.on('close', () => setTimeout(() => connect(url), CONFIG.RECONNECT_INTERVAL));
    ws.on('error', () => {});
}

CONFIG.SOURCES.forEach(url => connect(url));
