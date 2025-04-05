require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

const GIST_ID = process.env.GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_URL = `https://api.github.com/gists/${GIST_ID}`;
const REFRESH_INTERVAL = 30 * 1000; // 30 segundos

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

let commandConfig = {};
let usersData = {};
let lastRefresh = 0; // Guardará el tiempo del último refresco

// Cargar configuración y usuarios desde el Gist
async function loadConfigAndUsers() {
    try {
        const response = await axios.get(GIST_URL, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });

        // Cargar configuración de comandos
        const configFile = response.data.files["commands.json"];
        if (!configFile) throw new Error("No se encontró el archivo commands.json en el Gist.");
        commandConfig = JSON.parse(configFile.content);

        // Cargar usuarios para cada comando
        for (const [cmd, { file }] of Object.entries(commandConfig)) {
            usersData[cmd] = response.data.files[file] ? new Set(JSON.parse(response.data.files[file].content)) : new Set();
        }

        lastRefresh = Date.now();
        console.log("Configuración y usuarios recargados desde Gist.");
    } catch (error) {
        console.error("Error cargando configuración y usuarios:", error);
    }
}

// Guardar usuarios en el Gist
async function saveUsers(command) {
    try {
        await axios.patch(GIST_URL, {
            files: {
                [commandConfig[command].file]: { content: JSON.stringify([...usersData[command]], null, 2) }
            }
        }, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });
        console.log(`Usuarios guardados en Gist para ${command}`);
    } catch (error) {
        console.error(`Error guardando usuarios para ${command}:`, error);
    }
}

client.once('ready', async () => {
    await loadConfigAndUsers();
    console.log(`Bot conectado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const args = message.content.split(' ');
    const command = args[0].substring(1);

    // Si el comando no está en la configuración, ignorar
    if (!Object.keys(commandConfig).includes(command)) return;

    // Verificar si es necesario refrescar los datos
    if (Date.now() - lastRefresh > REFRESH_INTERVAL) {
        await loadConfigAndUsers();
    }

    if (args[1] === 'add' && message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => usersData[command].add(user.id));
        await saveUsers(command);
        message.channel.send(`Usuarios agregados correctamente a ${command}.`);
        return;
    }

    if (args[1] === 'remove' && message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => usersData[command].delete(user.id));
        await saveUsers(command);
        message.channel.send(`Usuarios eliminados correctamente de ${command}.`);
        return;
    }

    if (args[1] === 'list') {
        if (usersData[command].size === 0) {
            message.channel.send(`No hay usuarios guardados en ${command}.`);
        } else {
            const mentions = [...usersData[command]].map(id => `<@${id}>`).join(', ');
            message.channel.send(`Usuarios guardados en ${command}: ${mentions}`);
        }
        return;
    }

    if (args.length === 1) {
        if (usersData[command].size === 0) {
            message.channel.send(`No hay usuarios guardados para mencionar en ${command}.`);
        } else {
            const mentions = [...usersData[command]].map(id => `<@${id}>`).join(' ');
            const imageUrl = commandConfig[command].image || 'https://i.imgur.com/default.png';
            message.channel.send({ content: `Mencionando en ${command}: ${mentions}`, files: [imageUrl] });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);