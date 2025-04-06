require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

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
let commandDescriptions = {}; // Descripciones

// Cargar configuración dinámica desde el Gist
async function loadConfig() {
    try {
        const response = await axios.get(GIST_URL, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });
        const files = response.data.files;

        commandFiles = {};
        usersData = {};
        commandImages = {};
        commandDescriptions = {};
        commandStats = files['command_stats.json'] ? JSON.parse(files['command_stats.json'].content) : {};

        if (files['commands.json']) {
            const commandsJson = JSON.parse(files['commands.json'].content);

            for (const cmd in commandsJson) {
                const cmdData = commandsJson[cmd];
                commandFiles[cmd] = cmdData.file;
                commandImages[cmd] = cmdData.image;
                commandDescriptions[cmd] = cmdData.description || 'Sin descripción disponible';

                if (files[cmdData.file]) {
                    usersData[cmd] = new Set(JSON.parse(files[cmdData.file].content));
                } else {
                    usersData[cmd] = new Set();
                }
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

    await loadConfig(); // 🔁 Recarga la configuración del Gist en cada mensaje

    if (command === 'help') {
        const helpText = Object.keys(commandFiles).map(cmd => `**!${cmd}**: ${commandDescriptions[cmd] || 'Sin descripción.'}`).join('\n');
        const embed = new EmbedBuilder()
            .setTitle('🆘 Lista de Comandos Disponibles')
            .setDescription(helpText || 'No hay comandos disponibles.')
            .setColor(0x00AEFF);
        message.channel.send({ embeds: [embed] });
        return;
    }

    if (command === 'stats') {
        const statsMsg = Object.entries(commandStats).map(([cmd, data]) => {
            const topUser = Object.entries(data.users).sort((a, b) => b[1] - a[1])[0];
            return `**${cmd}**: ${data.count} usos${topUser ? ` | Más activo: <@${topUser[0]}> (${topUser[1]})` : ''}`;
        }).join('\n') || 'No hay estadísticas registradas.';

        const embed = new EmbedBuilder()
            .setTitle('📊 Estadísticas de comandos')
            .setDescription(statsMsg)
            .setColor(0x00AEFF);

        message.channel.send({ embeds: [embed] });
        return;
    }

    if (command === 'poll') {
        const opciones = message.content.split('|').map(s => s.trim()).slice(1);
        if (opciones.length < 2) {
            return message.channel.send('Debes proporcionar al menos 2 opciones. Ej: `!poll Opción A | Opción B`');
        }

        const emojis = ['🇦', '🇧', '🇨', '🇩', '🇪', '🇫', '🇬'];
        if (opciones.length > emojis.length) {
            return message.channel.send('Máximo 7 opciones permitidas.');
        }

        const embed = new EmbedBuilder()
            .setTitle('🗳️ Elijan gordos')
            .setDescription(opciones.map((op, i) => `${emojis[i]} ${op}`).join('\n'))
            .setColor(0x3498db);

        const pollMessage = await message.channel.send({ embeds: [embed] });
        for (let i = 0; i < opciones.length; i++) {
            await pollMessage.react(emojis[i]);
        }
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

            const embed = new EmbedBuilder()
                .setTitle(`📢 Mención de ${command}`)
                .setImage(imageUrl)
                .setColor(0x00BFFF);

            message.channel.send({
                content: mentions,
                embeds: [embed]
            });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
