const WebSocket = require('ws');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG = {
    // Se configura en el panel de Railway como DISCORD_WEBHOOK
    WEBHOOK_URL: process.env.DISCORD_WEBHOOK,
    PLACE_ID: "109983668079237",
    IMAGE_URL: "https://cdn.discordapp.com/attachments/1475916194803355673/1488480385594560543/copilot_image_1774732544833.jpg?ex=69cceee2&is=69cb9d62&hm=86d8bbefa902219c187d543b41f88846e453b70486e17c77aa17d62e0eba02e8&",
    SOURCES: [
        "wss://worker2.goalforest.workers.dev/ws",
        "wss://jw-auto-joiner-production-bda0.up.railway.app/"
    ],
    RECONNECT_INTERVAL: 5000
};

app.get('/', (req, res) => res.send('Sakura Highlights 24/7 Online 🌸'));
app.listen(PORT, () => console.log(`🚀 Sakura API activa en puerto ${PORT}`));

async function notifyDiscord(logData) {
    if (!CONFIG.WEBHOOK_URL) return;
    try {
        // Generar link de unión con el jobid del log
        const joinLink = `https://www.roblox.com/games/start?placeId=${CONFIG.PLACE_ID}&gameInstanceId=${logData.jobid}`;
        
        const payload = {
            username: "Sakura Highlights", // Nombre del bot actualizado
            embeds: [{
                title: "🌸 Sakura Highlights | New Found", // Título actualizado
                description: `**Best**\n**${logData.name}** \`[${logData.generation}]\`\n\n**🔗 [¡Unete al servidor!](${joinLink})**`,
                color: 16751052, // Color Rosa Pastel
                image: {
                    url: CONFIG.IMAGE_URL // Imagen proporcionada añadida a todos los logs
                },
                footer: { text: "discord.gg/sakurahighlights | v1" }, // Footer actualizado
                timestamp: new Date()
            }]
        };

        await axios.post(CONFIG.WEBHOOK_URL, payload);
        console.log(`🌸 Log enviado: ${logData.name}`);
    } catch (err) {
        console.error("❌ Error enviando a Discord");
    }
}

function connect(url) {
    const ws = new WebSocket(url);

    ws.on('open', () => console.log(`🔗 Conectado a fuente Sakura: ${url}`));

    ws.on('message', (raw) => {
        try {
            const parsed = JSON.parse(raw);
            
            // Procesar logs basados en la estructura proporcionada
            if (parsed.type === "new" && parsed.data) {
                notifyDiscord({
                    name: parsed.data.name || "Unknown Sakura",
                    generation: parsed.data.generation || "$0M/s",
                    jobid: parsed.data.jobid || "0"
                });
            }
        } catch (e) {
            // Ignorar mensajes corruptos
        }
    });

    ws.on('close', () => {
        setTimeout(() => connect(url), CONFIG.RECONNECT_INTERVAL);
    });

    ws.on('error', () => {});
}

CONFIG.SOURCES.forEach(url => connect(url));
