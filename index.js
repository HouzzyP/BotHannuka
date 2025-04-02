require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');

const FILE_PATH = 'users.json';

// Cargar usuarios desde el archivo si existe
let userIDs = new Set();
if (fs.existsSync(FILE_PATH)) {
    const data = fs.readFileSync(FILE_PATH, 'utf-8');
    userIDs = new Set(JSON.parse(data));
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`Bot conectado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(' ');

    if (args[0] === '!ff' && args[1] === 'add' && message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            userIDs.add(user.id);
        });

        // Guardar en el archivo
        fs.writeFileSync(FILE_PATH, JSON.stringify([...userIDs], null, 2));
        message.channel.send('Usuarios agregados correctamente.');
    }

    if (args[0] === '!ff' && args[1] === 'list') {
        if (userIDs.size === 0) {
            message.channel.send('No hay usuarios guardados.');
        } else {
            const mentions = Array.from(userIDs).map(id => `<@${id}>`).join(', ');
            message.channel.send(`Usuarios guardados: ${mentions}`);
        }
    }

    if (args[0] === '!ff' && args.length === 1) {
        if (userIDs.size === 0) {
            message.channel.send('No hay usuarios guardados para mencionar.');
        } else {
            const mentions = Array.from(userIDs).map(id => `<@${id}>`).join(' ');
            message.channel.send(`Mencionando: ${mentions}`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);