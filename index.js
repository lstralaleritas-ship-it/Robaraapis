const WebSocket = require('ws');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const antiSpamMap = new Map();

const CONFIG = {
    WEBHOOK_URL: process.env.DISCORD_WEBHOOK,
    PLACE_ID: "109983668079237",
    THUMBNAIL_URL: "https://cdn.discordapp.com/attachments/1475916194803355673/1488480971056742430/lv_0_20260328165632.png",
    SOURCES: [
        "wss://worker2.goalforest.workers.dev/ws",
        "wss://jw-auto-joiner-production-bda0.up.railway.app/",
        "wss://finders-port-websocket-production.up.railway.app/ws"
    ],
    RECONNECT_INTERVAL: 5000,
    COOLDOWN_MS: 2000,
    // Aumentamos a 9 para permitir billones reales, pero bloqueamos si es exagerado
    MAX_DIGITS_BEFORE_DOT: 9, 
    ULTRA_THRESHOLD: 200, 
    SUPER_THRESHOLD: 500,
    ROLE_ULTRA: "<@&1488489658416500917>",
    ROLE_SUPER: "<@&1488489581421531278>"
};

app.get('/', (req, res) => res.send('Sakura Highlights 🌸 Smart Shield Active'));
app.listen(PORT, () => console.log(`🚀 Sakura API lista y filtrando`));

function formatDynamic(value) {
    let num = parseFloat(value) || 0;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}B/s`;
    return `$${num.toFixed(2)}M/s`;
}

async function notifyDiscord(logData) {
    if (!CONFIG.WEBHOOK_URL) return;

    // ESCUDO INTELIGENTE: Solo cuenta dígitos antes del punto decimal
    const cleanNumber = logData.money.toString().split('.')[0].replace(/[^0-9]/g, '');
    
    if (cleanNumber.length > CONFIG.MAX_DIGITS_BEFORE_DOT) {
        console.log(`⚠️ Log inflado ignorado: ${logData.name} (${cleanNumber})`);
        return; 
    }

    const lockKey = `${logData.name}-${logData.jobid}`;
    if (antiSpamMap.has(lockKey)) return;

    try {
        antiSpamMap.set(lockKey, true);
        const numValue = parseFloat(logData.money) || 0;
        const joinLink = `https://www.roblox.com/games/start?placeId=${CONFIG.PLACE_ID}&gameInstanceId=${logData.jobid}`;
        const displayMoney = formatDynamic(logData.money);
        
        let embedTitle = "🌸 Sakura Highlights";
        let embedColor = 16751052; 
        let mention = "";

        if (numValue >= CONFIG.SUPER_THRESHOLD) {
            embedTitle = "🌸 Sakura Highlights | SuperLight";
            embedColor = 16711858; 
            mention = CONFIG.ROLE_SUPER;
        }
        else if (numValue >= CONFIG.ULTRA_THRESHOLD) {
            embedTitle = "🌸 Sakura Highlights | UltraLight";
            embedColor = 16729272; 
            mention = CONFIG.ROLE_ULTRA;
        }

        const payload = {
            username: "Sakura Highlights",
            content: mention, 
            embeds: [{
                title: embedTitle,
                description: `## ${logData.name}\n\`[${displayMoney}]\`\n\n**🔗 [¡Unete al servidor!](${joinLink})**`,
                color: embedColor,
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
    ws.on('open', () => console.log(`✅ Conectado a: ${url}`));
    ws.on('message', (raw) => {
        try {
            const parsed = JSON.parse(raw);
            let data = null;
            if (parsed.type === "new" && parsed.data) {
                const cleanMoney = parsed.data.generation.replace(/[^0-9.]/g, '');
                data = { name: parsed.data.name, money: cleanMoney, jobid: parsed.data.jobid };
            } else if (parsed.name && parsed.money) {
                data = { name: parsed.name, money: parsed.money, jobid: parsed.jobid };
            }
            if (data) notifyDiscord(data);
        } catch (e) {}
    });
    ws.on('close', () => setTimeout(() => connect(url), CONFIG.RECONNECT_INTERVAL));
    ws.on('error', () => {});
}

CONFIG.SOURCES.forEach(url => connect(url));
