const WebSocket = require('ws');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const antiSpamMap = new Map();
let logHistory = []; 

const CONFIG = {
    WEBHOOKS: {
        NORMAL: process.env.WEBHOOK_NORMAL,
        ULTRA: process.env.WEBHOOK_ULTRA,
        SUPER: process.env.WEBHOOK_SUPER,
        SECURITY: process.env.ALERTS_WEBHOOK // <--- Vinculado a tu variable Alerts_webhook
    },
    ACCESS_KEY: "SakuraLogs",
    PLACE_ID: "109983668079237",
    THUMBNAIL_URL: "https://cdn.discordapp.com/attachments/1475916194803355673/1488480971056742430/lv_0_20260328165632.png",
    SOURCES: [
        "wss://worker2.goalforest.workers.dev/ws",
        "wss://jw-auto-joiner-production-bda0.up.railway.app/",
        "wss://finders-port-websocket-production.up.railway.app/ws"
    ],
    RECONNECT_INTERVAL: 5000,
    COOLDOWN_MS: 2000,
    MAX_DIGITS_BEFORE_DOT: 9, 
    ULTRA_THRESHOLD: 200, 
    SUPER_THRESHOLD: 500,
    ROLE_ULTRA: "<@&1488489658416500917>",
    ROLE_SUPER: "<@&1488489581421531278>"
};

app.get('/', (req, res) => res.send('🌸 Sakura API Protegida | Alerts System Online'));

// --- RUTA DE LOGS CON PROTECCIÓN ---
app.get('/logs', async (req, res) => {
    const userKey = req.headers['x-api-key'];
    const robloxUser = req.headers['roblox-user'] || "Desconocido/Navegador";
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (userKey !== CONFIG.ACCESS_KEY) {
        // Enviar alerta al Webhook de Seguridad
        if (CONFIG.WEBHOOKS.SECURITY) {
            const securityPayload = {
                username: "Sakura Security",
                embeds: [{
                    title: "## ⚠️ ALGUIEN INTENTO ROBAR LOGS ⚠️",
                    description: `**User de Roblox:** \`${robloxUser}\`\n**IP:** \`${clientIp}\`\n\n*Acceso denegado por falta de API Key.*`,
                    color: 16711680,
                    footer: { text: "Sakura Anti-Theft System" },
                    timestamp: new Date()
                }]
            };
            axios.post(CONFIG.WEBHOOKS.SECURITY, securityPayload).catch(() => {});
        }

        // Respuesta que el script de Roblox ejecutará como print
        return res.status(403).send(`print("que haces pillo, no robes logs y compra tu aj 😭🤣")`);
    }

    res.json(logHistory);
});

app.listen(PORT, () => console.log(`🚀 Sakura API lista con Alerts_webhook configurado`));

// --- PROCESAMIENTO DE WEBSOCKETS ---

function formatDynamic(value) {
    let num = parseFloat(value) || 0;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}B/s`;
    return `$${num.toFixed(2)}M/s`;
}

async function notifyDiscord(logData) {
    const numValue = parseFloat(logData.money) || 0;
    const cleanNumber = logData.money.toString().split('.')[0].replace(/[^0-9]/g, '');
    if (cleanNumber.length > CONFIG.MAX_DIGITS_BEFORE_DOT) return; 

    const lockKey = `${logData.name}-${logData.jobid}`;
    if (antiSpamMap.has(lockKey)) return;

    antiSpamMap.set(lockKey, true);
    setTimeout(() => antiSpamMap.delete(lockKey), CONFIG.COOLDOWN_MS);

    const displayMoney = formatDynamic(logData.money);
    
    // Log fugaz de 1 segundo
    const tempEntry = { name: logData.name, generation: displayMoney, jobId: logData.jobid };
    logHistory.push(tempEntry);
    setTimeout(() => {
        logHistory = logHistory.filter(item => item !== tempEntry);
    }, 1000);

    try {
        const joinLink = `https://www.roblox.com/games/start?placeId=${CONFIG.PLACE_ID}&gameInstanceId=${logData.jobid}`;
        let targetWebhook = CONFIG.WEBHOOKS.NORMAL;
        let embedColor = 16751052;
        let mention = "";
        let title = "🌸 Sakura Highlights";

        if (numValue >= CONFIG.SUPER_THRESHOLD) {
            targetWebhook = CONFIG.WEBHOOKS.SUPER;
            embedColor = 16711858;
            mention = CONFIG.ROLE_SUPER;
            title = "🌸 Sakura Highlights | SuperLight";
        } else if (numValue >= CONFIG.ULTRA_THRESHOLD) {
            targetWebhook = CONFIG.WEBHOOKS.ULTRA;
            embedColor = 16729272;
            mention = CONFIG.ROLE_ULTRA;
            title = "🌸 Sakura Highlights | UltraLight";
        }

        if (targetWebhook) {
            axios.post(targetWebhook, {
                username: "Sakura Highlights",
                content: mention,
                embeds: [{
                    title: title,
                    description: `## ${logData.name}\n\`[${displayMoney}]\`\n\n**🔗 [¡Unete al servidor!](${joinLink})**`,
                    color: embedColor,
                    thumbnail: { url: CONFIG.THUMBNAIL_URL },
                    footer: { text: "discord.gg/sakurahighlights" },
                    timestamp: new Date()
                }]
            }).catch(() => {});
        }
    } catch (err) {}
}

function connect(url) {
    const ws = new WebSocket(url);
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
