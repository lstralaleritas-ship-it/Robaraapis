const WebSocket = require('ws');
const axios = require('axios');
const express = require('express');

const app = express();
// Railway usa el puerto 8080 o el que asigne process.env.PORT
const PORT = process.env.PORT || 8080;

// Variables de estado global
let logHistory = [];
const antiSpamMap = new Map();

const CONFIG = {
    ACCESS_KEY: "SakuraLogs",
    PLACE_ID: "109983668079237",
    THUMBNAIL_URL: "https://cdn.discordapp.com/attachments/1475916194803355673/1488480971056742430/lv_0_20260328165632.png",
    WEBHOOKS: {
        NORMAL: process.env.WEBHOOK_NORMAL,
        ULTRA: process.env.WEBHOOK_ULTRA,
        SUPER: process.env.WEBHOOK_SUPER,
        SECURITY: process.env.ALERTS_WEBHOOK
    },
    // Fuentes de datos
    SOURCES: [
        "wss://worker2.goalforest.workers.dev/ws",
        "wss://jw-auto-joiner-production-bda0.up.railway.app/",
        "wss://finders-port-websocket-production.up.railway.app/ws"
    ],
    ROLE_ULTRA: "<@&1488489658416500917>",
    ROLE_SUPER: "<@&1488489581421531278>"
};

// --- MIDDLEWARE DE SEGURIDAD PARA /LOGS ---
app.use('/logs', async (req, res, next) => {
    const userKey = req.headers['x-api-key'];
    const robloxUser = req.headers['roblox-user'] || "Desconocido/Navegador";
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (userKey !== CONFIG.ACCESS_KEY) {
        console.log(`🚫 BLOQUEO: Intento de robo por ${robloxUser} (${clientIp})`);

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
        return res.status(403).send(`print("que haces pillo, no robes logs y compra tu aj 😭🤣")`);
    }
    next();
});

// --- RUTAS HTTP ---
app.get('/logs', (req, res) => {
    res.json(logHistory);
});

app.get('/', (req, res) => {
    res.send('🌸 Sakura API Online y Protegida contra Crasheos.');
});

// --- PROCESAMIENTO DE DATOS ---
function formatMoney(val) {
    const n = parseFloat(val) || 0;
    return n >= 1000 ? `$${(n / 1000).toFixed(2)}B/s` : `$${n.toFixed(2)}M/s`;
}

async function handleData(data) {
    const val = parseFloat(data.money) || 0;
    const jobId = data.jobid ? data.jobid.substring(0, 36) : "invalid";
    const lockKey = `${data.name}-${jobId}`;

    if (antiSpamMap.has(lockKey)) return;
    antiSpamMap.set(lockKey, true);
    setTimeout(() => antiSpamMap.delete(lockKey), 3000);

    const display = formatMoney(data.money);
    const entry = { name: data.name, generation: display, jobId: jobId };
    
    // Historial fugaz de 1 segundo
    logHistory.push(entry);
    setTimeout(() => { logHistory = logHistory.filter(i => i !== entry); }, 1000);

    // Lógica de Discord
    let webhook = CONFIG.WEBHOOKS.NORMAL;
    let color = 16751052;
    let mention = "";
    let title = "🌸 Sakura Highlights";

    if (val >= 500) {
        webhook = CONFIG.WEBHOOKS.SUPER;
        color = 16711858;
        mention = CONFIG.ROLE_SUPER;
        title = "🌸 Sakura Highlights | SuperLight";
    } else if (val >= 200) {
        webhook = CONFIG.WEBHOOKS.ULTRA;
        color = 16729272;
        mention = CONFIG.ROLE_ULTRA;
        title = "🌸 Sakura Highlights | UltraLight";
    }

    if (webhook) {
        const joinLink = `https://www.roblox.com/games/start?placeId=${CONFIG.PLACE_ID}&gameInstanceId=${jobId}`;
        axios.post(webhook, {
            username: "Sakura Highlights",
            content: mention,
            embeds: [{
                title: title,
                description: `## ${data.name}\n\`[${display}]\`\n\n**🔗 [¡Unete al servidor!](${joinLink})**`,
                color: color,
                thumbnail: { url: CONFIG.THUMBNAIL_URL },
                footer: { text: "v1.5 Protected" },
                timestamp: new Date()
            }]
        }).catch(() => {});
    }
}

// --- CONEXIÓN WEBOSOCKET (CON ANTICRASHEO) ---
function startConnection(url) {
    const ws = new WebSocket(url);

    ws.on('open', () => console.log(`✅ Conectado a: ${url}`));

    ws.on('message', (msg) => {
        try {
            const raw = JSON.parse(msg);
            let extracted = null;
            if (raw.type === "new" && raw.data) {
                extracted = { 
                    name: raw.data.name, 
                    money: raw.data.generation.replace(/[^0-9.]/g, ''), 
                    jobid: raw.data.jobid 
                };
            } else if (raw.name && raw.money) {
                extracted = { name: raw.name, money: raw.money, jobid: raw.jobid };
            }
            if (extracted) handleData(extracted);
        } catch (e) {}
    });

    // Manejador de errores para evitar que el 404 mate la app
    ws.on('error', (err) => {
        console.log(`⚠️ Error en fuente ${url}: ${err.message}`);
    });

    ws.on('close', () => {
        console.log(`🔄 Reconectando a fuente: ${url}`);
        setTimeout(() => startConnection(url), 5000);
    });
}

// Iniciar todas las fuentes
CONFIG.SOURCES.forEach(startConnection);

// Evitar crasheos por errores no capturados
process.on('uncaughtException', (err) => console.log('❌ Error no capturado:', err));
process.on('unhandledRejection', (reason) => console.log('❌ Promesa rechazada:', reason));

app.listen(PORT, () => {
    console.log(`🚀 Sakura API Protegida corriendo en puerto ${PORT}`);
    console.log(`🔗 Link activo: /logs`);
});
