const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');

const app = express();
// Railway detecta el puerto automáticamente, pero forzamos 8080 como respaldo
const PORT = process.env.PORT || 8080;

/**
 * CONFIGURACIÓN MAESTRA SAKURA HIGHLIGHTS
 * Todas las líneas de integración recuperadas y expandidas.
 */
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
    SOURCES: [
        "wss://worker2.goalforest.workers.dev/ws",
        "wss://jw-auto-joiner-production-bda0.up.railway.app/",
        "wss://finders-port-websocket-production.up.railway.app/ws"
    ],
    LIMITS: {
        MAX_DIGITS: 9,
        ULTRA_VALUE: 200,
        SUPER_VALUE: 500,
        COOLDOWN: 2000,
        RECONNECT: 5000
    }
};

// Estados globales
let logHistory = [];
const antiSpamMap = new Map();

console.log("🌸 INICIANDO SAKURA HIGHLIGHTS ENGINE v2.0...");

/**
 * MIDDLEWARE DE SEGURIDAD AUTOMÁTICO
 * Bloquea cualquier intento a /logs sin la Key.
 */
app.use('/logs', async (req, res, next) => {
    const providedKey = req.headers['x-api-key'];
    const robloxUser = req.headers['roblox-user'] || "Desconocido/Navegador";
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (providedKey !== CONFIG.ACCESS_KEY) {
        console.log(`\n🚫 [BLOQUEO SEGURIDAD] Intento de acceso denegado.`);
        console.log(`👤 Usuario: ${robloxUser} | IP: ${clientIp}`);

        if (CONFIG.WEBHOOKS.SECURITY) {
            try {
                await axios.post(CONFIG.WEBHOOKS.SECURITY, {
                    username: "Sakura Security 🛡️",
                    embeds: [{
                        title: "## ⚠️ ALGUIEN INTENTO ROBAR LOGS ⚠️",
                        description: `**Detalles del Intento:**\n**User:** \`${robloxUser}\`\n**IP:** \`${clientIp}\`\n\n*El sistema ha rechazado la petición y enviado el print de respuesta.*`,
                        color: 16711680,
                        footer: { text: "Sakura Anti-Theft Protection" },
                        timestamp: new Date()
                    }]
                });
                console.log("✅ Alerta de robo enviada a Discord.");
            } catch (err) {
                console.error("❌ Error enviando alerta de seguridad:", err.message);
            }
        }
        // Respuesta que el script de Roblox ejecutará automáticamente
        return res.status(403).send(`print("que haces pillo, no robes logs y compra tu aj 😭🤣")`);
    }
    next();
});

/**
 * RUTAS HTTP PRINCIPALES
 */
app.get('/logs', (req, res) => {
    console.log(`✅ ACCESO CONCEDIDO A /LOGS - Enviando ${logHistory.length} registros.`);
    res.json(logHistory);
});

app.get('/', (req, res) => {
    res.send(`
        <body style="background:#111;color:pink;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;">
            <h1>🌸 Sakura API Online</h1>
            <p>Estado: Protegida | Rutas: /logs (Auth Required)</p>
        </body>
    `);
});

/**
 * LÓGICA DE PROCESAMIENTO DE BRAINROTS
 */
function formatValue(val) {
    const num = parseFloat(val) || 0;
    return num >= 1000 ? `$${(num / 1000).toFixed(2)}B/s` : `$${num.toFixed(2)}M/s`;
}

function cleanId(id) {
    if (!id) return "invalid-id";
    // Limpieza de IDs gigantes de fuentes externas
    return id.length > 45 ? id.substring(0, 36) : id;
}

async function processIncomingLog(data) {
    const rawValue = data.money.toString().split('.')[0].replace(/[^0-9]/g, '');
    const numValue = parseFloat(data.money) || 0;
    const safeJobId = cleanId(data.jobid);

    // 1. Escudo de seguridad (Dígitos inflados)
    if (rawValue.length > CONFIG.LIMITS.MAX_DIGITS) {
        console.log(`⚠️ Log inflado ignorado: ${data.name} (${rawValue} digits)`);
        return;
    }

    // 2. Filtro Anti-Duplicados
    const uniqueKey = `${data.name}-${safeJobId}`;
    if (antiSpamMap.has(uniqueKey)) return;

    antiSpamMap.set(uniqueKey, true);
    setTimeout(() => antiSpamMap.delete(uniqueKey), CONFIG.LIMITS.COOLDOWN);

    const displayMoney = formatValue(data.money);

    // 3. Integración con Historial Fugaz (1 segundo)
    const logEntry = { 
        name: data.name, 
        generation: displayMoney, 
        jobId: safeJobId,
        timestamp: new Date().toLocaleTimeString()
    };
    logHistory.push(logEntry);
    setTimeout(() => {
        logHistory = logHistory.filter(item => item !== logEntry);
    }, 1000);

    // 4. Lógica de Webhooks y Roles
    try {
        const joinLink = `https://www.roblox.com/games/start?placeId=${CONFIG.PLACE_ID}&gameInstanceId=${safeJobId}`;
        let webhookUrl = CONFIG.WEBHOOKS.NORMAL;
        let embedTitle = "🌸 Sakura Highlights";
        let embedColor = 16751052;
        let roleMention = "";

        if (numValue >= CONFIG.LIMITS.SUPER_VALUE) {
            webhookUrl = CONFIG.WEBHOOKS.SUPER;
            embedTitle = "🌸 Sakura Highlights | SuperLight";
            embedColor = 16711858;
            roleMention = CONFIG.ROLES.SUPER;
        } else if (numValue >= CONFIG.LIMITS.ULTRA_VALUE) {
            webhookUrl = CONFIG.WEBHOOKS.ULTRA;
            embedTitle = "🌸 Sakura Highlights | UltraLight";
            embedColor = 16729272;
            roleMention = CONFIG.ROLES.ULTRA;
        }

        if (webhookUrl) {
            await axios.post(webhookUrl, {
                username: "Sakura Highlights",
                content: roleMention,
                embeds: [{
                    title: embedTitle,
                    description: `## ${data.name}\n\`[${displayMoney}]\`\n\n**🔗 [¡Unete al servidor!](${joinLink})**`,
                    color: embedColor,
                    thumbnail: { url: CONFIG.THUMBNAIL_URL },
                    footer: { text: "sakura-highlights.v2 | Protect Mode" },
                    timestamp: new Date()
                }]
            });
        }
    } catch (err) {
        console.error("❌ Error enviando a Discord:", err.message);
    }
}

/**
 * GESTIÓN DE FUENTES WEBSOCKET
 */
function initSource(url) {
    const ws = new WebSocket(url);

    ws.on('open', () => console.log(`🔗 Fuente vinculada con éxito: ${url}`));

    ws.on('message', (message) => {
        try {
            const parsed = JSON.parse(message);
            let finalData = null;

            if (parsed.type === "new" && parsed.data) {
                finalData = {
                    name: parsed.data.name,
                    money: parsed.data.generation.replace(/[^0-9.]/g, ''),
                    jobid: parsed.data.jobid
                };
            } else if (parsed.name && parsed.money) {
                finalData = { name: parsed.name, money: parsed.money, jobid: parsed.jobid };
            }

            if (finalData) processIncomingLog(finalData);
        } catch (e) {
            // Ignorar errores de parsing
        }
    });

    ws.on('error', (err) => {
        console.log(`⚠️ Error de conexión en ${url}: ${err.message}`);
    });

    ws.on('close', () => {
        console.log(`🔄 Reintentando conexión con fuente: ${url}`);
        setTimeout(() => initSource(url), CONFIG.LIMITS.RECONNECT);
    });
}

// Iniciar Motor de Fuentes
CONFIG.SOURCES.forEach(initSource);

// Error Global Handler para evitar caídas
process.on('uncaughtException', (err) => console.error('🚫 EXCEPCIÓN NO CONTROLADA:', err));
process.on('unhandledRejection', (reason) => console.error('🚫 PROMESA RECHAZADA:', reason));

// LANZAMIENTO
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SAKURA FULL API LISTA`);
    console.log(`📡 Escuchando en puerto: ${PORT}`);
    console.log(`🛡️ Seguridad activa: Solo peticiones con Key podrán ver /logs`);
});
                      
