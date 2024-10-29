const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });
const fs = require('fs');
const path = './vouchesData.json';

let vouches = {};  // { userId: { positive: number, negative: number, roles: [], positiveToday: number, positive3Days: number, positiveWeek: number } }
const resetIntervals = {
    daily: 24 * 60 * 60 * 1000, // 24 hours
    threeDays: 3 * 24 * 60 * 60 * 1000, // 3 days
    weekly: 7 * 24 * 60 * 60 * 1000 // 7 days
};

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

const authorizedUserIds = ['818116496886202381']; // IDs of users with admin privileges
const designatedRoleId = '1282338481141714995'; // ID of the role required to receive autorole
const autoRoleRequirements = [
    { count: 10, roleId: '1282959860618760295' }, // role ID when reaching 10 vouches
    { count: 20, roleId: '1284489978847428659' } // Add more roles with different vouch counts
];
const logChannelId = '1282662612319993959'; // ID of the channel to send autorole notifications

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});


// Create embed to display information
function createEmbed(title, description, color) {
    // Set default message if description is empty or undefined
    const validDescription = description && description.trim().length > 0 ? description : "No description.";

    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(validDescription)
        .setColor(color);
}

// Load vouch data from file on startup
function loadVouches() {
    if (fs.existsSync(path)) {
        const data = fs.readFileSync(path);
        vouches = JSON.parse(data);
    }
}

// Save vouch data to file
function saveVouches() {
    fs.writeFileSync(path, JSON.stringify(vouches, null, 2));
}

// Load data when bot starts
loadVouches();


// Helper function to get counts within specific timeframes
function getCountsWithinTimeframe(timestamps, timeframe) {
    const now = Date.now();
    return timestamps.filter(ts => now - ts < timeframe).length;
}

// Function to create a self-vouch embed message
function selfVouchEmbed(username) {
    return new EmbedBuilder()
        .setTitle("Vouch Error")
        .setDescription(`${username}, you cannot vouch for yourself!`)
        .setColor(0xFF0000) // Red color for error
        .setFooter({ text: "Please mention another user to vouch for them." });
}


// +profile command to display personal vouch information
client.on('messageCreate', async message => {
    if (message.content.startsWith('+profile')) {
        const user = message.mentions.users.first() || message.author;
        const data = vouches[user.id] || { positive: 0, negative: 0, positiveTimestamps: [] };

        // Calculate positive reviews for today, last 3 days, and last week
        const positiveToday = getCountsWithinTimeframe(data.positiveTimestamps, resetIntervals.daily);
        const positiveLast3Days = getCountsWithinTimeframe(data.positiveTimestamps, resetIntervals.threeDays);
        const positiveLastWeek = getCountsWithinTimeframe(data.positiveTimestamps, resetIntervals.weekly);

        // Create the embed similar to the image
        const embed = new EmbedBuilder()
            .setColor(0x2F3136)
            .setTitle(`${user.username}'s Vouches`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: "✅ Positive Reviews", value: `${data.positive}`, inline: true },
                { name: "❌ Negative Reviews", value: `${data.negative}`, inline: true },
                { name: "Positive Reviews Today", value: `${positiveToday}`, inline: false },
                { name: "Positive Reviews Last 3 Days", value: `${positiveLast3Days}`, inline: false },
                { name: "Positive Reviews Last Week", value: `${positiveLastWeek}`, inline: false }
            )
            .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL({ dynamic: true }) });

        message.channel.send({ embeds: [embed] });
    }
});

// Periodically clean up timestamps older than a week to keep data size small
setInterval(() => {
    const now = Date.now();
    for (const userId in vouches) {
        if (vouches[userId].positiveTimestamps) {
            vouches[userId].positiveTimestamps = vouches[userId].positiveTimestamps.filter(ts => now - ts < resetIntervals.weekly);
        }
    }
}, resetIntervals.daily);  // Run the cleanup every 24 hours


// +refresh command to check and grant autorole
async function sendRefreshEmbed(message) {
    console.log('sendRefreshEmbed called'); // Log để kiểm tra
    const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('✅ Refresh complete!')
        .setDescription('The refresh process has been completed successfully.')
        .setFooter({ text: 'This message was generated by ...' });

    await message.channel.send({ embeds: [embed] });
}
client.on('messageCreate', async (message) => {
    if (message.content === '+refresh') {
        await sendRefreshEmbed(message);
    }
});

// +top command to display the top users with the most vouches
async function topVouchers(message, vouches) {
    // Sort users by the number of positive reviews (vouches) in descending order
    const topVouchers = Object.entries(vouches)
        .sort(([, a], [, b]) => b.positive - a.positive)
        .slice(0, 25);

    // Create the embed
    const embed = new EmbedBuilder()
        .setTitle('Top Vouchers (Trial Staff)')
        .setColor('#1E90FF') // Blue color like the left line in the image
        .setDescription(
            topVouchers.map(([userId, data], index) => {
                const member = message.guild.members.cache.get(userId);
                const displayName = member ? member.displayName : 'Unknown';
                return `${index + 1}. **${displayName}**\nVouchers: ${data.positive}`;
            }).join('\n\n')
        );

    // Send the embed
    message.channel.send({ embeds: [embed] });
}

client.on('messageCreate', async message => {
    if (message.content === '+top') {
        topVouchers(message, vouches);
    }
});


// =pls command to guide others to vouch

const vouchChannelId = '1295352156538540074';

// Function to send the vouch embed
async function sendVouchEmbed(message, vouchChannelId) {
    const embed = new EmbedBuilder()
        .setColor('#2ECC71') // Green color similar to the border in the image
        .setTitle('Cheers for our staff!')
        .setDescription(
            `🌟 **Share the love with +vouch @user in the vouching channel <#${vouchChannelId}>.**\nYour appreciation brightens our day!\n\n` +
            `If you're not satisfied, type -vouch @user to provide feedback. 🎉\n\n` +
            `*This ticket will be deleted in 16 hours!*`
        );

    // Send the embed to the channel where the command was issued
    await message.channel.send({ embeds: [embed] });
}

// Listen for messages to trigger the command
client.on('messageCreate', async (message) => {
    // Check if the message content is "=pls" (adjust this to your actual command trigger)
    if (message.content === '=pls') {
        sendVouchEmbed(message, vouchChannelId);
    }
});

const cooldowns = {};  // { userId: timestamp }

// Check cooldown
function isOnCooldown(userId, cooldown) {
    const lastUsed = cooldowns[userId] || 0;
    const now = Date.now();
    return now - lastUsed < cooldown;
}

// Set cooldown
function setCooldown(userId) {
    cooldowns[userId] = Date.now();
}

// Function to create countdown embed
function createCountdownEmbed(username, remainingTime) {
    const minutes = Math.floor(remainingTime / 60000);
    const seconds = Math.floor((remainingTime % 60000) / 1000);
    return new EmbedBuilder()
        .setTitle("Cooldown Active")
        .setDescription(`${username}, you need to wait ${minutes}m ${seconds}s before using this command again.`)
        .setColor(0xFFA500);
}

client.on('messageCreate', async message => {
    if (message.content.startsWith('+vouch') || message.content.startsWith('-vouch')) {
        const userId = message.author.id;
        const cooldownTime = 30 * 60 * 1000;  // 30 minutes in milliseconds

        if (isOnCooldown(userId, cooldownTime)) {
            const remainingTime = cooldownTime - (Date.now() - cooldowns[userId]);
            const embed = createCountdownEmbed(message.author.username, remainingTime);
            return message.reply({ embeds: [embed] });
        }

        // Run the command logic
        const args = message.content.split(' ');
        const user = message.mentions.users.first();
        const reason = args.slice(2).join(' ') || "No message provided.";

        if (!user || user.id === message.author.id) {
            const embed = selfVouchEmbed(message.author.username);
            return message.reply({ embeds: [embed] });
        }

        // Initialize vouch data for the user if not existing
        if (!vouches[user.id]) {
            vouches[user.id] = { positive: 0, negative: 0, positiveTimestamps: [] };
        }

        if (message.content.startsWith('+vouch')) {
            vouches[user.id].positive++;
            vouches[user.id].positiveTimestamps.push(Date.now());  // Record the timestamp
            saveVouches(); // Save data

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle("✅ Positive review added for " + user.username)
                .addFields(
                    { name: "Review:", value: reason },
                    { name: "Vouched by", value: message.author.username, inline: true }
                )
                .setThumbnail(user.displayAvatarURL({ dynamic: true }));
            message.channel.send({ embeds: [embed] });

        } else if (message.content.startsWith('-vouch')) {
            vouches[user.id].negative++;
            saveVouches(); // Save data

            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle("❌ Negative review added for " + user.username)
                .addFields(
                    { name: "Review:", value: reason },
                    { name: "Vouched by", value: message.author.username, inline: true }
                )
                .setThumbnail(user.displayAvatarURL({ dynamic: true }));
            message.channel.send({ embeds: [embed] });
        }

        // Set cooldown after command is used successfully
        setCooldown(userId);
    }
});


// Admin command to add/remove vouches
client.on('messageCreate', async message => {
    const [command, mention, count] = message.content.split(' ');
    if ((command === '.addvouch' || command === '.removevouch') && authorizedUserIds.includes(message.author.id)) {
        const user = message.mentions.users.first();
        if (!user || isNaN(count)) return;

        if (!vouches[user.id]) {
            vouches[user.id] = { positive: 0, negative: 0, roles: [] };
        }

        if (command === '.addvouch') {
            vouches[user.id].positive += parseInt(count);
            message.reply(`Added ${count} positive vouches to ${user.username}`);
        } else if (command === '.removevouch') {
            // Adjusted to decrease positive vouches
            vouches[user.id].positive -= parseInt(count);
            if (vouches[user.id].positive < 0) vouches[user.id].positive = 0; // Ensures no negative values
            message.reply(`Removed ${count} positive vouches from ${user.username}`);
        }
    }
});

client.on('messageCreate', async message => {
    const [command, userId] = message.content.split(' ');

    // Ensure only authorized users can run this command
    if (command === '.removeuser' && authorizedUserIds.includes(message.author.id)) {
        if (!userId || !vouches[userId]) {
            return message.reply("User not found in the vouches list or invalid user ID.");
        }

        // Remove user from vouches data
        delete vouches[userId];
        saveVouches(); // Save changes to file

        message.reply(`Removed user with ID ${userId} from the vouches list.`);
    }
});


client.login("MTMwMDcyNzc2Njg2NTQxMjE0Nw.GbmJyy.MVeRWIJjjUL0iUNbukB2sOIWMIfOk-LK9eFPu0");
