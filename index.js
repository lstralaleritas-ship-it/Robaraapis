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
        SECURITY: process.env.ALERTS_WEBHOOK // <--- ESTE ES EL QUE MANDA A DISCORD
    },
    ACCESS_KEY: "SakuraLogs",
    PLACE_ID: "109983668079237",
    THUMBNAIL_URL: "https://cdn.discordapp.com/attachments/1475916194803355673/1488480971056742430/lv_0_20260328165632.png",
    SOURCES: [
        "wss://worker2.goalforest.workers.dev/ws",
        "wss://jw-auto-joiner-production-bda0.up.railway.app/",
        "wss://finders-port-websocket-production.up.railway.app/ws"
    ],
    COOLDOWN_MS: 2000,
    ROLE_ULTRA: "<@&1488489658416500917>",
    ROLE_SUPER: "<@&1488489581421531278>"
};

// --- MIDDLEWARE DE SEGURIDAD (EL FILTRO AUTOMÁTICO) ---
// Esto revisa TODAS las peticiones a /logs antes de que lleguen a la data
app.use('/logs', async (req, res, next) => {
    const userKey = req.headers['x-api-key'];
    const robloxUser = req.headers['roblox-user'] || "Desconocido/Navegador";
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // SI NO TIENE LA KEY O ES INCORRECTA:
    if (userKey !== CONFIG.ACCESS_KEY) {
        console.log(`🚫 BLOQUEO: Intento de robo por ${robloxUser} (${clientIp})`);

        // 1. Mandar a Discord (Si existe el Webhook)
        if (CONFIG.WEBHOOKS.SECURITY) {
            axios.post(CONFIG.WEBHOOKS.SECURITY, {
                username: "Sakura Security 🛡️",
                embeds: [{
                    title: "## ⚠️ ALGUIEN INTENTO ROBAR LOGS ⚠️",
                    description: `**User:** \`${robloxUser}\`\n**IP:** \`${clientIp}\`\n\n*Acceso denegado automáticamente.*`,
                    color: 16711680,
                    timestamp: new Date()
                }]
            }).catch(() => {});
        }

        // 2. Responder con el PRINT de Roblox y código 403 (Prohibido)
        return res.status(403).send(`print("que haces pillo, no robes logs y compra tu aj 😭🤣")`);
    }

    // Si tiene la key, pasa a la función de logs normal
    next();
});

// --- RUTA DE LOGS (SOLO ACCESIBLE CON KEY) ---
app.get('/logs', (req, res) => {
    res.json(logHistory);
});

app.get('/', (req, res) => res.send('🌸 Sakura API Activa'));

// --- LÓGICA DE PROCESAMIENTO (IGUAL QUE ANTES) ---

function formatDynamic(value) {
    let num = parseFloat(value) || 0;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}B/s`;
    return `$${num.toFixed(2)}M/s`;
}

async function notifyDiscord(logData) {
    const val = parseFloat(logData.money) || 0;
    const lockKey = `${logData.name}-${logData.jobid}`;
    if (antiSpamMap.has(lockKey)) return;

    antiSpamMap.set(lockKey, true);
    setTimeout(() => antiSpamMap.delete(lockKey), CONFIG.COOLDOWN_MS);

    const display = formatDynamic(logData.money);
    
    // Log fugaz
    const entry = { name: logData.name, generation: display, jobId: logData.jobid };
    logHistory.push(entry);
    setTimeout(() => { logHistory = logHistory.filter(i => i !== entry); }, 1000);

    let targetWebhook = CONFIG.WEBHOOKS.NORMAL;
    let embedColor = 16751052;
    let mention = "";

    if (val >= 500) {
        targetWebhook = CONFIG.WEBHOOKS.SUPER;
        embedColor = 16711858;
        mention = CONFIG.ROLE_SUPER;
    } else if (val >= 200) {
        targetWebhook = CONFIG.WEBHOOKS.ULTRA;
        embedColor = 16729272;
        mention = CONFIG.ROLE_ULTRA;
    }

    if (targetWebhook) {
        axios.post(targetWebhook, {
            username: "Sakura Highlights",
            content: mention,
            embeds: [{
                title: "🌸 Sakura Log",
                description: `## ${logData.name}\n\`[${display}]\`\n\n**ID:** ${logData.jobid.substring(0, 36)}`,
                color: embedColor,
                thumbnail: { url: CONFIG.THUMBNAIL_URL },
                footer: { text: "discord.gg/sakurahighlights" },
                timestamp: new Date()
            }]
        }).catch(() => {});
    }
}

function connect(url) {
    const ws = new WebSocket(url);
    ws.on('message', (raw) => {
        try {
            const p = JSON.parse(raw);
            let d = null;
            if (p.type === "new" && p.data) {
                d = { name: p.data.name, money: p.data.generation.replace(/[^0-9.]/g, ''), jobid: p.data.jobid };
            } else if (p.name && p.money) {
                d = { name: p.name, money: p.money, jobid: p.jobid };
            }
            if (d) notifyDiscord(d);
        } catch {}
    });
    ws.on('close', () => setTimeout(() => connect(url), 5000));
}

CONFIG.SOURCES.forEach(connect);
app.listen(PORT, () => console.log(`🚀 Sakura API Protegida en puerto ${PORT}`));
