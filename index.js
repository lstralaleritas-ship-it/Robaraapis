const WebSocket = require('ws');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const antiSpamMap = new Map();

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
    COOLDOWN_MS: 2000,
    MAX_LIMIT_BILLIONS: 15 // Límite estricto de 15 Billones
};

app.get('/', (req, res) => res.send('Sakura Highlights 🌸 Dynamic M/B Active'));
app.listen(PORT, () => console.log(`🚀 Sakura API (M/B) en puerto ${PORT}`));

// Función para formatear el dinero dinámicamente
function formatCurrency(value) {
    const num = parseFloat(value) || 0;
    if (num >= 1000) {
        return `$${(num / 1000).toFixed(2)}B/s`; // Convierte a Billones si es >= 1000M
    }
    return `$${num.toFixed(2)}M/s`; // Mantiene Millones
}

async function notifyDiscord(logData) {
    if (!CONFIG.WEBHOOK_URL) return;

    const rawValue = parseFloat(logData.money) || 0;
    
    // Filtro de Seguridad: Si supera los 15,000M (15B), se ignora
    if (rawValue > (CONFIG.MAX_LIMIT_BILLIONS * 1000)) {
        console.log(`⚠️ Bloqueado: ${logData.name} por valor excesivo (${rawValue}M)`);
        return;
    }

    const lockKey = `${logData.name}-${logData.jobid}`;
    if (antiSpamMap.has(lockKey)) return;

    try {
        antiSpamMap.set(lockKey, true);
        const joinLink = `https://www.roblox.com/games/start?placeId=${CONFIG.PLACE_ID}&gameInstanceId=${logData.jobid}`;
        const displayMoney = formatCurrency(rawValue);
        
        const payload = {
            username: "Sakura Highlights",
            embeds: [{
                title: "🌸 Sakura Highlights",
                description: `## ${logData.name}\n\`[${displayMoney}]\`\n\n**🔗 [¡Unete al servidor!](${joinLink})**`,
                color: 16751052,
                thumbnail: { url: CONFIG.THUMBNAIL_URL },
                footer: { text: "discord.gg/sakurahighlights | v1" },
                timestamp: new Date()
            }]
        };

        await axios.post(CONFIG.WEBHOOK_URL, payload);
        setTimeout(() => antiSpamMap.delete(lockKey), CONFIG.COOLDOWN_MS);
    } catch (err) {
        antiSpamMap.delete(lockKey);
    }
}

function connect(url) {
    const ws = new WebSocket(url);
    ws.on('message', (raw) => {
        try {
            const parsed = JSON.parse(raw);
            let extractedData = null;

            if (parsed.type === "new" && parsed.data) {
                // Limpiamos el texto "$30M/s" para quedarnos solo con el número
                const cleanMoney = parsed.data.generation.replace(/[^0-9.]/g, '');
                extractedData = {
                    name: parsed.data.name,
                    money: cleanMoney,
                    jobid: parsed.data.jobid
                };
            } else if (parsed.name && parsed.money) {
                extractedData = {
                    name: parsed.name,
                    money: parsed.money,
                    jobid: parsed.jobid
                };
            }

            if (extractedData) notifyDiscord(extractedData);
        } catch (e) {}
    });
    ws.on('close', () => setTimeout(() => connect(url), CONFIG.RECONNECT_INTERVAL));
    ws.on('error', () => {});
}

CONFIG.SOURCES.forEach(url => connect(url));
