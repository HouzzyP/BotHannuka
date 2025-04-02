require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { Pool } = require('pg');

// Configurar la conexión a la base de datos
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Necesario si tu base de datos lo requiere
});

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
        // Agregar cada usuario a la base de datos
        for (const user of message.mentions.users.values()) {
            try {
                await pool.query(
                    "INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING",
                    [user.id]
                );
            } catch (error) {
                console.error('Error al agregar usuario:', error);
            }
        }
        message.channel.send('Usuarios agregados correctamente.');
    }

    if (args[0] === '!ff' && args[1] === 'list') {
        try {
            const res = await pool.query("SELECT id FROM users");
            if (res.rowCount === 0) {
                message.channel.send('No hay usuarios guardados.');
            } else {
                const mentions = res.rows.map(row => `<@${row.id}>`).join(', ');
                message.channel.send(`Usuarios guardados: ${mentions}`);
            }
        } catch (error) {
            console.error('Error al listar usuarios:', error);
            message.channel.send('Ocurrió un error al obtener la lista de usuarios.');
        }
    }

    if (args[0] === '!ff' && args.length === 1) {
        try {
            const res = await pool.query("SELECT id FROM users");
            if (res.rowCount === 0) {
                message.channel.send('No hay usuarios guardados para mencionar.');
            } else {
                const mentions = res.rows.map(row => `<@${row.id}>`).join(' ');
                message.channel.send(`https://imgur.com/a/aJ88hAY
                     ${mentions}`);
            }
        } catch (error) {
            console.error('Error al mencionar usuarios:', error);
            message.channel.send('Ocurrió un error al mencionar a los usuarios.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);