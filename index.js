const WebSocket = require('ws');
const axios = require('axios');

// CONFIGURACIÓN BASADA ÚNICAMENTE EN RAILWAY
const CONFIG = {
    // Se extrae de la variable 'DISCORD_WEBHOOK' en el panel de Railway
    WEBHOOK_URL: process.env.DISCORD_WEBHOOK, 
    PLACE_ID: "109983668079237",
    SOURCES: [
        "wss://worker2.goalforest.workers.dev/ws",
        "wss://jw-auto-joiner-production-bda0.up.railway.app/"
    ],
    RECONNECT_INTERVAL: 5000
};

// Validación de seguridad
if (!CONFIG.WEBHOOK_URL) {
    console.error("❌ ERROR: No se encontró la variable 'DISCORD_WEBHOOK' en Railway.");
    process.exit(1); // Detiene la ejecución si no hay webhook
}

async function notifyDiscord(data) {
    try {
        const joinLink = `https://www.roblox.com/games/start?placeId=${CONFIG.PLACE_ID}&gameInstanceId=${data.jobId}`;

        const payload = {
            username: "Noctis Notifier",
            embeds: [{
                title: "Noctis Notify | Highlights",
                description: `${data.content}\n\n**🔗 [¡Unete al servidor!](${joinLink})**`,
                color: 10181046,
                footer: { 
                    text: "discord.gg/noctisnotify | v1" 
                },
                timestamp: new Date()
            }]
        };

        await axios.post(CONFIG.WEBHOOK_URL, payload);
        console.log("✅ Log enviado a Discord correctamente.");
    } catch (error) {
        console.error("❌ Error enviando a Discord:", error.message);
    }
}

function connect(url) {
    const ws = new WebSocket(url);

    ws.on('open', () => console.log(`🚀 Conectado a fuente: ${url}`));

    ws.on('message', (raw) => {
        try {
            const parsed = JSON.parse(raw);
            notifyDiscord({ 
                content: parsed.message || parsed.description || "Brainrot Detectado", 
                jobId: parsed.jobId || "0" 
            });
        } catch {
            notifyDiscord({ content: raw.toString(), jobId: "0" });
        }
    });

    ws.on('close', () => {
        setTimeout(() => connect(url), CONFIG.RECONNECT_INTERVAL);
    });

    ws.on('error', () => {});
}

// Iniciar monitoreo
console.log("--- Noctis Notifier Bridge Activo ---");
CONFIG.SOURCES.forEach(url => connect(url));
