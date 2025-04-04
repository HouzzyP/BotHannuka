require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
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

const commandFiles = {
    ff: 'ff_users.json',
    cs: 'cs_users.json',
    lol: 'lol_users.json'
};

const commandImages = {
    ff: 'https://i.imgur.com/UUyr53J.png',
    cs: 'https://i.imgur.com/pZxRnKM.png',
    lol: 'https://i.imgur.com/hyPzq4U.png'
};

let usersData = {};

// Cargar usuarios desde el Gist para todos los comandos
async function loadUsers() {
    try {
        const response = await axios.get(GIST_URL, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });
        for (const [cmd, file] of Object.entries(commandFiles)) {
            usersData[cmd] = response.data.files[file] ? new Set(JSON.parse(response.data.files[file].content)) : new Set();
        }
        console.log("Usuarios cargados desde Gist");
    } catch (error) {
        console.error("Error cargando usuarios:", error);
    }
}

// Guardar usuarios en el Gist para un comando específic
async function saveUsers(command) {
    try {
        await axios.patch(GIST_URL, {
            files: { [commandFiles[command]]: { content: JSON.stringify([...usersData[command]], null, 2) } }
        }, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });
        console.log(`Usuarios guardados en Gist para ${command}`);
    } catch (error) {
        console.error(`Error guardando usuarios para ${command}:`, error);
    }
}

client.once('ready', async () => {
    await loadUsers();
    console.log(`Bot conectado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const args = message.content.split(' ');
    const command = args[0].substring(1);

    if (!Object.keys(commandFiles).includes(command)) return;

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

    if (args.length === 1) {
        if (usersData[command].size === 0) {
            message.channel.send(`No hay usuarios guardados para mencionar en ${command}.`);
        } else {
            const mentions = [...usersData[command]].map(id => `<@${id}>`).join(' ');
            const imageUrl = commandImages[command] || 'https://i.imgur.com/XYRsVRC_d.webp?maxwidth=760&fidelity=grand';
            message.channel.send({ content: `Mencionando en ${command}: ${mentions}`, files: [imageUrl] });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);