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
        SECURITY: process.env.ALERTS_WEBHOOK // <--- Asegúrate que en Railway se llame ALERTS_WEBHOOK
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

// --- RUTA PRINCIPAL ---
app.get('/', (req, res) => res.send('🌸 Sakura API Online | Alerts & Logs Active'));

// --- RUTA /LOGS CON SISTEMA ANTIRROBO ---
app.get('/logs', async (req, res) => {
    const userKey = req.headers['x-api-key'];
    const robloxUser = req.headers['roblox-user'] || "Desconocido/Navegador";
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // VALIDACIÓN DE SEGURIDAD
    if (userKey !== CONFIG.ACCESS_KEY) {
        console.log(`⚠️ ALERTA: Intento de acceso no autorizado por ${robloxUser} (${clientIp})`);

        if (CONFIG.WEBHOOKS.SECURITY) {
            try {
                await axios.post(CONFIG.WEBHOOKS.SECURITY, {
                    username: "Sakura Security 🛡️",
                    embeds: [{
                        title: "## ⚠️ ALGUIEN INTENTO ROBAR LOGS ⚠️",
                        description: `**User de Roblox:** \`${robloxUser}\`\n**IP:** \`${clientIp}\`\n\n*Acceso bloqueado: API Key inválida o ausente.*`,
                        color: 16711680,
                        footer: { text: "Sakura Anti-Theft System" },
                        timestamp: new Date()
                    }]
                });
            } catch (err) {
                console.error("❌ Error enviando alerta a Discord:", err.message);
            }
        }
        return res.status(403).send(`print("que haces pillo, no robes logs y compra tu aj 😭🤣")`);
    }

    // SI LA KEY ES CORRECTA, ENVÍA LOS LOGS
    res.json(logHistory);
});

app.listen(PORT, () => console.log(`🚀 Sakura API Protegida en puerto ${PORT}`));

// --- LÓGICA DE PROCESAMIENTO DE DATOS ---

function formatDynamic(value) {
    let num = parseFloat(value) || 0;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}B/s`;
    return `$${num.toFixed(2)}M/s`;
}

async function notifyDiscord(logData) {
    const numValue = parseFloat(logData.money) || 0;
    const cleanNumber = logData.money.toString().split('.')[0].replace(/[^0-9]/g, '');
    
    // Filtro de seguridad contra números inflados por error
    if (cleanNumber.length > CONFIG.MAX_DIGITS_BEFORE_DOT) return; 

    // Filtro Anti-Duplicados
    const lockKey = `${logData.name}-${logData.jobid}`;
    if (antiSpamMap.has(lockKey)) return;

    antiSpamMap.set(lockKey, true);
    setTimeout(() => antiSpamMap.delete(lockKey), CONFIG.COOLDOWN_MS);

    const displayMoney = formatDynamic(logData.money);
    
    // Historial temporal de 1 segundo
    const tempEntry = { name: logData.name, generation: displayMoney, jobId: logData.jobid };
    logHistory.push(tempEntry);
    setTimeout(() => {
        logHistory = logHistory.filter(item => item !== tempEntry);
    }, 1000);

    // Selección de Webhook, Color y Mención
    try {
        const joinLink = `https://www.roblox.com/games/start?placeId=${CONFIG.PLACE_ID}&gameInstanceId=${logData.jobid}`;
        let targetWebhook = CONFIG.WEBHOOKS.NORMAL;
        let embedColor = 16751052; 
        let mention = "";
        let title = "🌸 Sakura Highlights";

        if (numValue >= CONFIG.SUPER_THRESHOLD) {
            targetWebhook = CONFIG.WEBHOOKS.SUPER;
            embedColor = 16711858; // Rosa Neón
            mention = CONFIG.ROLE_SUPER;
            title = "🌸 Sakura Highlights | SuperLight";
        } else if (numValue >= CONFIG.ULTRA_THRESHOLD) {
            targetWebhook = CONFIG.WEBHOOKS.ULTRA;
            embedColor = 16729272; // Rosa Fucsia
            mention = CONFIG.ROLE_ULTRA;
            title = "🌸 Sakura Highlights | UltraLight";
        }

        if (targetWebhook) {
            await axios.post(targetWebhook, {
                username: "Sakura Highlights",
                content: mention,
                embeds: [{
                    title: title,
                    description: `## ${logData.name}\n\`[${displayMoney}]\`\n\n**🔗 [¡Unete al servidor!](${joinLink})**`,
                    color: embedColor,
                    thumbnail: { url: CONFIG.THUMBNAIL_URL },
                    footer: { text: "discord.gg/sakurahighlights | v1" },
                    timestamp: new Date()
                }]
            });
        }
    } catch (err) {}
}

// --- CONEXIÓN A LAS FUENTES (WEBSOCKETS) ---

function connect(url) {
    const ws = new WebSocket(url);
    ws.on('open', () => console.log(`✅ Fuente conectada: ${url}`));
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
