const express = require('express');
const { WebSocketServer, WebSocket } = require('ws'); 
const axios = require('axios');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server }); 

const PORT = process.env.PORT || 8080;

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
    ROLES: {
        ULTRA: "<@&1488489658416500917>",
        SUPER: "<@&1488489581421531278>"
    },
    // FUENTES LIMPIAS (Adiós jw-auto-joiner)
    SOURCES: [
        "wss://worker2.goalforest.workers.dev/ws",
        "wss://finders-port-websocket-production.up.railway.app/ws"
    ]
};

// --- RUTA WEB NORMAL ---
app.get('/', (req, res) => {
    res.send('<body style="background:#111;color:pink;text-align:center;padding-top:20vh;font-family:sans-serif;"><h1>🌸 Sakura API (Modo WebSocket) 🌸</h1><p>Online y Protegida</p></body>');
});

// --- SERVIDOR WEBSOCKET PARA EJECUTORES ---
wss.on('connection', async (ws, req) => {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const userKey = urlParams.get('key');
    const robloxUser = urlParams.get('user') || "Desconocido/Navegador";
    const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || "0.0.0.0").split(',')[0];

    // SEGURIDAD: SI NO TIENE LA KEY
    if (userKey !== CONFIG.ACCESS_KEY) {
        console.log(`🚫 [WS BLOQUEO] Robo de: ${robloxUser} | IP: ${clientIp}`);

        if (CONFIG.WEBHOOKS.SECURITY) {
            axios.post(CONFIG.WEBHOOKS.SECURITY, {
                username: "Sakura Anti-Theft 🛡️",
                embeds: [{
                    title: "🚨 INTENTO DE EXTRACCIÓN (WEBSOCKET) 🚨",
                    description: `Acceso denegado a la red de transmisión en vivo.`,
                    color: 16711680,
                    fields: [
                        { name: "👤 Usuario", value: `\`${robloxUser}\``, inline: true },
                        { name: "🌐 IP", value: `\`${clientIp}\``, inline: true }
                    ],
                    footer: { text: "Sakura WS Engine" },
                    timestamp: new Date()
                }]
            }).catch(() => {});
        }

        ws.send(`print("que haces pillo, no robes logs y compra tu aj 😭🤣")`);
        ws.close();
        return;
    }

    // BIENVENIDA AL USUARIO LEGÍTIMO
    console.log(`✅ [WS] Cliente conectado: ${robloxUser}`);
    ws.send(JSON.stringify({ type: "system", msg: "✅ Conectado a Sakura API Live" }));
});

// --- LÓGICA DE PROCESAMIENTO ---
function processLog(data) {
    const val = parseFloat(data.money) || 0;
    const cleanId = data.jobid ? data.jobid.substring(0, 36) : "invalid";
    const lockKey = `${data.name}-${cleanId}`;

    if (antiSpamMap.has(lockKey)) return;
    antiSpamMap.set(lockKey, true);
    setTimeout(() => antiSpamMap.delete(lockKey), 2000);

    const display = val >= 1000 ? `$${(val / 1000).toFixed(2)}B/s` : `$${val.toFixed(2)}M/s`;
    
    // TRANSMITIR EN VIVO A ROBLOX
    const payload = JSON.stringify({
        type: "log",
        name: data.name,
        generation: display,
        jobid: cleanId
    });

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });

    // ENVIAR A DISCORD
    let url = CONFIG.WEBHOOKS.NORMAL;
    let mention = "";
    let color = 16751052;

    if (val >= 500) { url = CONFIG.WEBHOOKS.SUPER; mention = CONFIG.ROLES.SUPER; color = 16711858; } 
    else if (val >= 200) { url = CONFIG.WEBHOOKS.ULTRA; mention = CONFIG.ROLES.ULTRA; color = 16729272; }

    if (url) {
        axios.post(url, {
            username: "Sakura Highlights", content: mention,
            embeds: [{
                title: val >= 200 ? "🌸 Sakura Highlight | OP" : "🌸 Sakura Highlight",
                description: `## ${data.name}\n\`[${display}]\`\n\n**🔗 [¡Unete al servidor!](https://www.roblox.com/games/start?placeId=${CONFIG.PLACE_ID}&gameInstanceId=${cleanId})**`,
                color: color, thumbnail: { url: CONFIG.THUMBNAIL_URL }
            }]
        }).catch(() => {});
    }
}

// --- RECOLECTOR DE FUENTES ---
function connectSourceWS(url) {
    try {
        const ws = new WebSocket(url);
        ws.on('open', () => console.log(`📡 Fuente vinculada: ${url}`));
        ws.on('message', (msg) => {
            try {
                const p = JSON.parse(msg);
                let d = (p.type === "new" && p.data) ? 
                    { name: p.data.name, money: p.data.generation.replace(/[^0-9.]/g, ''), jobid: p.data.jobid } : 
                    (p.name && p.money ? { name: p.name, money: p.money, jobid: p.jobid } : null);
                if (d) processLog(d);
            } catch (e) {}
        });
        ws.on('error', () => {});
        ws.on('close', () => setTimeout(() => connectSourceWS(url), 5000));
    } catch (e) {}
}

// --- ENCENDER TODO ---
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SERVIDOR WEBSOCKET ONLINE EN PUERTO ${PORT}`);
    setTimeout(() => CONFIG.SOURCES.forEach(connectSourceWS), 2000);
});

process.on('uncaughtException', () => {});
