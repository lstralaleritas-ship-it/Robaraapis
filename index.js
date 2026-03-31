const WebSocket = require('ws');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

let logHistory = [];
const antiSpamMap = new Map();

// Configuración con protecciones
const CONFIG = {
    WEBHOOKS: {
        NORMAL: process.env.WEBHOOK_NORMAL,
        ULTRA: process.env.WEBHOOK_ULTRA,
        SUPER: process.env.WEBHOOK_SUPER,
        SECURITY: process.env.ALERTS_WEBHOOK
    },
    ACCESS_KEY: "SakuraLogs",
    SOURCES: [
        "wss://worker2.goalforest.workers.dev/ws",
        "wss://jw-auto-joiner-production-bda0.up.railway.app/",
        "wss://finders-port-websocket-production.up.railway.app/ws"
    ]
};

app.get('/', (req, res) => res.send('🌸 Sakura API is Live'));

app.get('/logs', (req, res) => {
    const userKey = req.headers['x-api-key'];
    const robloxUser = req.headers['roblox-user'] || "Unknown";
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (userKey !== CONFIG.ACCESS_KEY) {
        if (CONFIG.WEBHOOKS.SECURITY) {
            axios.post(CONFIG.WEBHOOKS.SECURITY, {
                username: "Sakura Security",
                embeds: [{
                    title: "⚠️ INTENTO DE ROBO",
                    description: `User: ${robloxUser}\nIP: ${clientIp}`,
                    color: 16711680
                }]
            }).catch(() => {});
        }
        return res.status(403).send('print("que haces pillo, no robes logs y compra tu aj 😭🤣")');
    }
    res.json(logHistory);
});

async function notifyDiscord(logData) {
    const lockKey = `${logData.name}-${logData.jobid}`;
    if (antiSpamMap.has(lockKey)) return;

    antiSpamMap.set(lockKey, true);
    setTimeout(() => antiSpamMap.delete(lockKey), 2000);

    const val = parseFloat(logData.money) || 0;
    const display = val >= 1000 ? `$${(val/1000).toFixed(2)}B/s` : `$${val.toFixed(2)}M/s`;

    const entry = { name: logData.name, generation: display, jobId: logData.jobid };
    logHistory.push(entry);
    setTimeout(() => { logHistory = logHistory.filter(i => i !== entry); }, 1000);

    let url = CONFIG.WEBHOOKS.NORMAL;
    if (val >= 500) url = CONFIG.WEBHOOKS.SUPER;
    else if (val >= 200) url = CONFIG.WEBHOOKS.ULTRA;

    if (url) {
        axios.post(url, {
            username: "Sakura Highlights",
            embeds: [{
                title: "🌸 Sakura Log",
                description: `## ${logData.name}\n\`[${display}]\`\n\n**ID:** ${logData.jobid}`,
                color: val >= 200 ? 16729272 : 16751052
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
    ws.on('error', () => {});
}

CONFIG.SOURCES.forEach(connect);

app.listen(PORT, () => console.log(`🚀 Puerto: ${PORT}`));
