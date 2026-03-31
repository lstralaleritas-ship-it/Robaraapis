const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;

// 1. ENCENDER EL SERVIDOR PRIMERO (Para que Railway no de error jamás)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SERVIDOR WEB ENCENDIDO EN PUERTO ${PORT}`);
});

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
        SECURITY: process.env.ALERTS_WEBHOOK // Canal de Alertas de Robo
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

// --- PÁGINA PRINCIPAL VISUAL (Para que veas que sí funciona) ---
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Sakura API</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="background-color: #121212; color: #ffb6c1; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding-top: 20vh;">
            <img src="${CONFIG.THUMBNAIL_URL}" style="width: 120px; border-radius: 50%; box-shadow: 0 0 20px #ffb6c1;">
            <h1 style="margin-bottom: 5px;">🌸 Sakura Hub API 🌸</h1>
            <p style="color: #a0a0a0; font-size: 18px;">Estado: <span style="color: #4caf50;">ONLINE ✅</span></p>
            <div style="margin-top: 30px; padding: 15px; background: #1e1e1e; display: inline-block; border-radius: 10px; border: 1px solid #333;">
                <p style="margin: 0; color: #ff5252;"><b>Seguridad Activa 🛡️</b></p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #888;">La ruta /logs está estrictamente protegida.</p>
            </div>
        </body>
        </html>
    `);
});

// --- RUTA /LOGS (LA TRAMPA) ---
app.get('/logs', async (req, res) => {
    const userKey = req.headers['x-api-key'];
    const robloxUser = req.headers['roblox-user'] || "Navegador/Externo";
    const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || "0.0.0.0").split(',')[0];

    // SI NO TIENE LA LLAVE, SE CIERRA LA PUERTA Y SE MANDA ALERTA
    if (userKey !== CONFIG.ACCESS_KEY) {
        console.log(`🚫 ROBO DETECTADO: ${robloxUser} | IP: ${clientIp}`);

        if (CONFIG.WEBHOOKS.SECURITY) {
            axios.post(CONFIG.WEBHOOKS.SECURITY, {
                username: "Sakura Anti-Theft 🛡️",
                avatar_url: CONFIG.THUMBNAIL_URL,
                embeds: [{
                    title: "🚨 INTENTO DE EXTRACCIÓN BLOQUEADO 🚨",
                    description: `El sistema rechazó una petición sin autorización a la ruta de logs.`,
                    color: 16711680,
                    fields: [
                        { name: "👤 Usuario/Origen", value: `\`${robloxUser}\``, inline: true },
                        { name: "🌐 IP Detectada", value: `\`${clientIp}\``, inline: true },
                        { name: "🔑 Llave proporcionada", value: `\`${userKey || "Ninguna"}\``, inline: false }
                    ],
                    footer: { text: "Sakura Engine v3.0" },
                    timestamp: new Date()
                }]
            }).catch(e => console.log("Error al enviar Webhook:", e.message));
        }

        return res.status(403).send(`print("que haces pillo, no robes logs y compra tu aj 😭🤣")`);
    }

    // SI LA LLAVE ES CORRECTA, TOMA TUS LOGS
    res.json(logHistory);
});

// --- PROCESAMIENTO DE DATOS ---
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
                thumbnail: { url: CONFIG.THUMBNAIL_URL },
                footer: { text: "v3.0 Live" },
                timestamp: new Date()
            }]
        }).catch(() => {});
    }
}

// --- CONEXIÓN DE WEBSOCKETS (Súper blindada contra 404) ---
function connectWS(url) {
    try {
        const ws = new WebSocket(url);
        
        ws.on('open', () => console.log(`✅ Conectado a fuente: ${url}`));
        
        ws.on('message', (msg) => {
            try {
                const p = JSON.parse(msg);
                let d = (p.type === "new" && p.data) ? 
                    { name: p.data.name, money: p.data.generation.replace(/[^0-9.]/g, ''), jobid: p.data.jobid } : 
                    (p.name && p.money ? { name: p.name, money: p.money, jobid: p.jobid } : null);
                if (d) notifyDiscord(d);
            } catch (e) {}
        });

        // ESTO EVITA QUE EL ERROR 404 MATE EL SERVIDOR
        ws.on('unexpected-response', (req, res) => {
            console.log(`⚠️ Fuente caída (Error ${res.statusCode}): ${url}`);
        });

        ws.on('error', (e) => console.log(`⚠️ Error en WS: ${e.message}`));
        ws.on('close', () => setTimeout(() => connectWS(url), 5000));

    } catch (e) {
        console.log(`Error crítico al iniciar WS: ${e.message}`);
    }
}

// Empezar a conectar fuentes 3 segundos después de que el server encendió
setTimeout(() => {
    CONFIG.SOURCES.forEach(connectWS);
}, 3000);

process.on('uncaughtException', (err) => console.error('🚫 Ignorando error:', err.message));
