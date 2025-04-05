require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

const GIST_ID = process.env.GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_URL = `https://api.github.com/gists/${GIST_ID}`;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

let commandFiles = {};
let commandImages = {};
let usersData = {};
let commandStats = {}; // Estadísticas

// Cargar configuración dinámica desde el Gist
async function loadConfig() {
    try {
        const response = await axios.get(GIST_URL, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });
        const files = response.data.files;

        // Resetear
        commandFiles = {};
        usersData = {};
        commandImages = {};
        commandStats = files['command_stats.json'] ? JSON.parse(files['command_stats.json'].content) : {};

        for (const fileName in files) {
            if (fileName.endsWith('_users.json')) {
                const cmd = fileName.replace('_users.json', '');
                commandFiles[cmd] = fileName;
                usersData[cmd] = new Set(JSON.parse(files[fileName].content));
            }
            if (fileName.endsWith('_image.txt')) {
                const cmd = fileName.replace('_image.txt', '');
                commandImages[cmd] = files[fileName].content.trim();
            }
        }

        console.log("Configuración cargada desde Gist");
    } catch (error) {
        console.error("Error cargando configuración:", error);
    }
}

// Guardar usuarios en el Gist
async function saveUsers(command) {
    try {
        await axios.patch(GIST_URL, {
            files: {
                [commandFiles[command]]: {
                    content: JSON.stringify([...usersData[command]], null, 2)
                }
            }
        }, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });
        console.log(`Usuarios guardados para ${command}`);
    } catch (error) {
        console.error(`Error guardando usuarios de ${command}:`, error);
    }
}

// Guardar estadísticas en el Gist
async function saveStats() {
    try {
        await axios.patch(GIST_URL, {
            files: {
                'command_stats.json': {
                    content: JSON.stringify(commandStats, null, 2)
                }
            }
        }, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });
        console.log("Estadísticas guardadas");
    } catch (error) {
        console.error("Error guardando estadísticas:", error);
    }
}

// Incrementar estadísticas
function incrementStats(command, userId) {
    if (!commandStats[command]) {
        commandStats[command] = { count: 0, users: {} };
    }
    commandStats[command].count++;
    if (!commandStats[command].users[userId]) {
        commandStats[command].users[userId] = 0;
    }
    commandStats[command].users[userId]++;
}

client.once('ready', async () => {
    await loadConfig();
    console.log(`Bot conectado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).split(' ');
    const command = args[0];

    if (command === 'stats') {
        const embed = new EmbedBuilder()
            .setTitle('📊 Estadísticas de comandos')
            .setColor('#0099ff')
            .setTimestamp();

        if (Object.keys(commandStats).length === 0) {
            embed.setDescription('No hay estadísticas registradas.');
        } else {
            for (const [cmd, data] of Object.entries(commandStats)) {
                const topUser = Object.entries(data.users).sort((a, b) => b[1] - a[1])[0];
                embed.addFields({
                    name: `/${cmd}`,
                    value: `• Usos: **${data.count}**
    ${topUser ? `• Más activo: <@${topUser[0]}> (${topUser[1]})` : ''}`,
                    inline: false
                });
            }
        }

        message.channel.send({ embeds: [embed] });
        return;
    }

    if (!Object.keys(commandFiles).includes(command)) return;

    incrementStats(command, message.author.id);
    await saveStats();

    if (args[1] === 'add' && message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => usersData[command].add(user.id));
        await saveUsers(command);
        message.channel.send(`Usuarios agregados a ${command}.`);
        return;
    }

    if (args[1] === 'remove' && message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => usersData[command].delete(user.id));
        await saveUsers(command);
        message.channel.send(`Usuarios eliminados de ${command}.`);
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
            message.channel.send(`No hay usuarios guardados en ${command}.`);
        } else {
            const mentions = [...usersData[command]].map(id => `<@${id}>`).join(' ');
            const imageUrl = commandImages[command] || 'https://i.imgur.com/UUyr53J.png';
            message.channel.send({ content: `Mencionando en ${command}: ${mentions}`, files: [imageUrl] });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
