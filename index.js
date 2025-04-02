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

let userIDs = new Set();

// Cargar usuarios desde el Gist
async function loadUsers() {
    try {
        const response = await axios.get(GIST_URL, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });
        const data = JSON.parse(response.data.files['users.json'].content);
        userIDs = new Set(data);
        console.log("Usuarios cargados desde Gist");
    } catch (error) {
        console.error("Error cargando usuarios:", error);
    }
}

// Guardar usuarios en el Gist
async function saveUsers() {
    try {
        await axios.patch(GIST_URL, {
            files: { 'users.json': { content: JSON.stringify([...userIDs], null, 2) } }
        }, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });
        console.log("Usuarios guardados en Gist");
    } catch (error) {
        console.error("Error guardando usuarios:", error);
    }
}

client.once('ready', async () => {
    await loadUsers();
    console.log(`Bot conectado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const args = message.content.split(' ');

    if (args[0] === '!ff' && args[1] === 'add' && message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => userIDs.add(user.id));
        await saveUsers();
        message.channel.send('Usuarios agregados correctamente.');
    }

    if (args[0] === '!ff' && args[1] === 'list') {
        if (userIDs.size === 0) {
            message.channel.send('No hay usuarios guardados.');
        } else {
            const mentions = [...userIDs].map(id => `<@${id}>`).join(', ');
            message.channel.send(`Usuarios guardados: ${mentions}`);
        }
    }

    if (args[0] === '!ff') {
        if (userIDs.size === 0) {
            message.channel.send('No hay usuarios guardados para mencionar.');
        } else {
            const mentions = [...userIDs].map(id => `<@${id}>`).join(' ');
            const imageUrl = 'https://i.imgur.com/UUyr53J.png';
            message.channel.send({ content: `Mencionando: ${mentions}`, files: [imageUrl] });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
