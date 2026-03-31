const WebSocket = require('ws');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

let logHistory = [];
const antiSpamMap = new Map();

const CONFIG = {
    ACCESS_KEY: "SakuraLogs",
    ALERTS_WEBHOOK: process.env.ALERTS_WEBHOOK, // Variable en Railway
    SOURCES: [
        "wss://worker2.goalforest.workers.dev/ws",
        "wss://jw-auto-joiner-production-bda0.up.railway.app/",
        "wss://finders-port-websocket-production.up.railway.app/ws"
    ]
};

// --- SEGURIDAD Y /LOGS ---

app.get('/logs', (req, res) => {
    const userKey = req.headers['x-api-key'];
    const robloxUser = req.headers['roblox-user'] || "Externo/Navegador";
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Si NO tiene la key o es incorrecta
    if (userKey !== CONFIG.ACCESS_KEY) {
        console.log(`⚠️ ROBO DETECTADO: ${robloxUser} desde ${clientIp}`);

        // Enviar alerta a Discord si el Webhook existe
        if (CONFIG.ALERTS_WEBHOOK) {
            axios.post(CONFIG.ALERTS_WEBHOOK, {
                username: "Sakura Security 🛡️",
                embeds: [{
                    title: "## ⚠️ ALGUIEN INTENTO ROBAR LOGS ⚠️",
                    description: `**User:** \`${robloxUser}\`\n**IP:** \`${clientIp}\`\n\n*Acceso denegado.*`,
                    color: 16711680,
                    timestamp: new Date()
                }]
            }).catch(() => {});
        }

        // Respuesta que Roblox ejecutará como PRINT
        return res.status(403).send(`print("que haces pillo, no robes logs y compra tu aj 😭🤣")`);
    }

    // Si la key es correcta, enviamos los logs
    res.json(logHistory);
});

app.get('/', (req, res) => res.send('🌸 Sakura API Activa. Usa /logs con la Key.'));

// --- LÓGICA DE DATOS ---

function notifyDiscord(logData) {
    const val = parseFloat(logData.money) || 0;
    const display = val >= 1000 ? `$${(val/1000).toFixed(2)}B/s` : `$${val.toFixed(2)}M/s`;

    // Guardar en el historial (se borra en 1 segundo)
    const entry = { name: logData.name, generation: display, jobId: logData.jobid };
    logHistory.push(entry);
    setTimeout(() => { logHistory = logHistory.filter(i => i !== entry); }, 1000);
}

function connect(url) {
    const ws = new WebSocket(url);
    ws.on('open', () => console.log(`✅ Fuente conectada: ${url}`));
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
        } catch (e) {}
    });
    ws.on('close', () => setTimeout(() => connect(url), 5000));
    ws.on('error', () => {});
}

CONFIG.SOURCES.forEach(connect);

app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));
