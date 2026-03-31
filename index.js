// --- MANEJO DE ERRORES GLOBALES (Debe ir hasta arriba) ---
process.on('uncaughtException', (err) => console.error('🚫 Error Crítico Ignorado:', err.message));
process.on('unhandledRejection', (reason) => console.error('🚫 Promesa Rechazada:', reason));

const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// --- VARIABLES Y CONFIGURACIÓN ---
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
        SECURITY: process.env.ALERTS_WEBHOOK // Webhook para alertas de robo
    },
    ROLES: {
        ULTRA: "<@&1488489658416500917>",
        SUPER: "<@&1488489581421531278>"
    },
    SOURCES: [
        "wss://worker2.goalforest.workers.dev/ws",
        "wss://jw-auto-joiner-production-bda0.up.railway.app/",
        "wss://finders-port-websocket-production.up.railway.app/ws"
    ]
};

// --- RUTAS WEB (Se definen ANTES de encender el servidor) ---

// 1. Página Visual Principal
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Sakura API</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="background-color: #0d0d0d; color: #ffb6c1; font-family: sans-serif; text-align: center; padding-top: 15vh;">
            <img src="${CONFIG.THUMBNAIL_URL}" style="width: 130px; border-radius: 50%; box-shadow: 0 0 25px #ffb6c1;">
            <h1>🌸 Sakura Hub API 🌸</h1>
            <h3 style="color: #4caf50;">ONLINE ✅</h3>
            <div style="margin-top: 20px; padding: 15px; background: #1a1a1a; display: inline-block; border-radius: 8px; border: 1px solid #333;">
                <p style="margin: 0; color: #ff5252;"><b>Escudo de Seguridad Activo 🛡️</b></p>
            </div>
        </body>
        </html>
    `);
});

// 2. Ruta de Extracción (/logs)
app.get('/logs', async (req, res) => {
    const userKey = req.headers['x-api-key'];
    const robloxUser = req.headers['roblox-user'] || "Desconocido/Navegador";
    const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || "0.0.0.0").split(',')[0];

    // BLOQUEO DE SEGURIDAD
    if (userKey !== CONFIG.ACCESS_KEY) {
        console.log(`🚫 ALERTA: Intento de robo por ${robloxUser} | IP: ${clientIp}`);

        if (CONFIG.WEBHOOKS.SECURITY) {
            axios.post(CONFIG.WEBHOOKS.SECURITY, {
                username: "Sakura Security 🛡️",
                embeds: [{
                    title: "🚨 ACCESO DENEGADO 🚨",
                    description: `Intento de acceso a \`/logs\` sin autorización.`,
                    color: 16711680,
                    fields: [
                        { name: "👤 Usuario", value: `\`${robloxUser}\``, inline: true },
                        { name: "🌐 IP", value: `\`${clientIp}\``, inline: true }
                    ],
                    footer: { text: "Sakura Engine" },
                    timestamp: new Date()
                }]
            }).catch(() => {});
        }
        return res.status(403).send(`print("que haces pillo, no robes logs y compra tu aj 😭🤣")`);
    }

    // ACCESO CONCEDIDO
    res.json(logHistory);
});

// --- LÓGICA DE PROCESAMIENTO ---
function notifyDiscord(data) {
    const val = parseFloat(data.money) || 0;
    const cleanId = data.jobid ? data.jobid.substring(0, 36) : "invalid";
    const lockKey = `${data.name}-${cleanId}`;

    if (antiSpamMap.has(lockKey)) return;
    antiSpamMap.set(lockKey, true);
    setTimeout(() => antiSpamMap.delete(lockKey), 2000);

    const display = val >= 1000 ? `$${(val / 1000).toFixed(2)}B/s` : `$${val.toFixed(2)}M/s`;

    const entry = { name: data.name, generation: display, jobId: cleanId };
    logHistory.push(entry);
    setTimeout(() => { logHistory = logHistory.filter(i => i !== entry); }, 1000);

    let url = CONFIG.WEBHOOKS.NORMAL;
    let mention = "";
    let color = 16751052;

    if (val >= 500) {
        url = CONFIG.WEBHOOKS.SUPER;
        mention = CONFIG.ROLES.SUPER;
        color = 16711858;
    } else if (val >= 200) {
        url = CONFIG.WEBHOOKS.ULTRA;
        mention = CONFIG.ROLES.ULTRA;
        color = 16729272;
    }

    if (url) {
        axios.post(url, {
            username: "Sakura Highlights",
            content: mention,
            embeds: [{
                title: val >= 200 ? "🌸 Sakura Highlight | OP" : "🌸 Sakura Highlight",
                description: `## ${data.name}\n\`[${display}]\`\n\n**🔗 [¡Unete al servidor!](https://www.roblox.com/games/start?placeId=${CONFIG.PLACE_ID}&gameInstanceId=${cleanId})**`,
                color: color,
                thumbnail: { url: CONFIG.THUMBNAIL_URL }
            }]
        }).catch(() => {});
    }
}

// --- CONEXIÓN WEBSOCKETS (Súper Blindaje) ---
function startWS(url) {
    try {
        const ws = new WebSocket(url);
        
        ws.on('open', () => console.log(`✅ Fuente WS conectada: ${url}`));
        
        ws.on('message', (msg) => {
            try {
                const p = JSON.parse(msg);
                let d = (p.type === "new" && p.data) ? 
                    { name: p.data.name, money: p.data.generation.replace(/[^0-9.]/g, ''), jobid: p.data.jobid } : 
                    (p.name && p.money ? { name: p.name, money: p.money, jobid: p.jobid } : null);
                if (d) notifyDiscord(d);
            } catch (e) {}
        });

        // Escudos contra caídas de la fuente
        ws.on('unexpected-response', () => {}); 
        ws.on('error', () => {}); 
        ws.on('close', () => setTimeout(() => startWS(url), 5000));

    } catch (e) {}
}

// --- ENCENDIDO DEL SERVIDOR ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SERVIDOR WEB ONLINE EN PUERTO ${PORT}`);
    
    // Iniciar fuentes 2 segundos DESPUÉS de encender la web para no trabar el arranque
    setTimeout(() => {
        CONFIG.SOURCES.forEach(startWS);
    }, 2000);
});
