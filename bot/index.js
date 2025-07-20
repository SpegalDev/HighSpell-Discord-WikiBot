const { Client, GatewayIntentBits, REST, Routes, ApplicationCommandOptionType } = require('discord.js');

const DISCORD_BOT_TOKEN = '';
const CLIENT_ID = ''; 
const GUILD_ID = ''; 

const NEW_MEDIAWIKI_BASE_URL = 'https://highspell.wiki/w/';
const FANDOM_WIKI_BASE_URL = 'https://highspell.fandom.com/wiki/';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

function formatPageNameForMediaWikiUrl(rawPageName) {
    if (!rawPageName) return '';

    const capitalizedAndUnderscored = rawPageName
        .split(' ')
        .map(word => {
            if (word.length === 0) return '';

            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join('_');

    return encodeURIComponent(capitalizedAndUnderscored);
}

function formatPageNameForDisplay(rawPageName) {
    if (!rawPageName) return '';

    return rawPageName.toLowerCase().replace(/\b(\w)/g, char => char.toUpperCase());
}

async function checkWikiPageExists(pageName) {
    const apiEndpoint = `${NEW_MEDIAWIKI_BASE_URL}api.php`;

    const queryTitle = pageName.replace(/ /g, '_'); 
    const encodedQueryTitle = encodeURIComponent(queryTitle); 

    const params = new URLSearchParams({
        action: 'query',
        prop: 'info',
        titles: encodedQueryTitle, 
        format: 'json',
        redirects: 1 
    });

    try {

        const response = await fetch(`${apiEndpoint}?${params.toString()}`);
        const data = await response.json();

        const pageId = Object.keys(data.query.pages)[0];
        return pageId !== '-1'; 
    } catch (error) {
        console.error(`Error checking wiki page existence for "${pageName}":`, error);

        return false;
    }
}

const commands = [
    {
        name: 'wiki',
        description: 'Links to a page on the HighSpell Wiki.',
        options: [
            {
                name: 'page',
                description: 'The name of the wiki page.',
                type: ApplicationCommandOptionType.String, 
                required: true, 
            },
        ],
    },
];

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log('Bot is online and ready.');

    const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Failed to reload application (/) commands:', error);
    }
});

client.on('interactionCreate', async interaction => {

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'wiki') {
        const pageName = interaction.options.getString('page'); 

        if (!pageName) {

            await interaction.reply({ content: 'Please provide a page name!', ephemeral: true });
            return;
        }

        console.log(`Received /wiki command for page: "${pageName}"`);

        await interaction.deferReply({ ephemeral: true });

        const pageExists = await checkWikiPageExists(pageName); 
        const urlFormattedPageName = formatPageNameForMediaWikiUrl(pageName);
        const displayFormattedPageName = formatPageNameForDisplay(pageName);
        const fullUrl = `${NEW_MEDIAWIKI_BASE_URL}${urlFormattedPageName}`;

        if (pageExists) {

            await interaction.editReply({
                content: `Here's a link to the wiki page for **${displayFormattedPageName}**: <${fullUrl}>`,
            });
        } else {

            await interaction.editReply({
                content: `Sorry, I couldn't find a wiki page for **${displayFormattedPageName}** on HighSpell Wiki.`,
            });
        }
    }
});

client.on('messageCreate', async message => {

    if (message.author.bot) return;

    console.log(`Received message from ${message.author.tag}: "${message.content}"`);

    let messagesToSend = []; 

    const internalLinkRegex = /\[\[(.*?)\]\]/g;
    let internalMatch;
    while ((internalMatch = internalLinkRegex.exec(message.content)) !== null) {
        const rawPageName = internalMatch[1].trim();
        if (rawPageName) {
            console.log(`Found internal link raw page name: "${rawPageName}"`);

            const pageExists = await checkWikiPageExists(rawPageName); 
            const urlFormattedPageName = formatPageNameForMediaWikiUrl(rawPageName);
            const displayFormattedPageName = formatPageNameForDisplay(rawPageName);
            const fullUrl = `${NEW_MEDIAWIKI_BASE_URL}${urlFormattedPageName}`;

            if (pageExists) {
                messagesToSend.push(`Here's a link to the wiki page for **${displayFormattedPageName}**: <${fullUrl}>`);
            } else {
                messagesToSend.push(`Sorry, I couldn't find a wiki page for **${displayFormattedPageName}** on HighSpell Wiki.`);
            }
        }
    }

    const fandomLinkRegex = new RegExp(`${FANDOM_WIKI_BASE_URL.replace(/\./g, '\\.').replace(/\
    let fandomMatch;
    while ((fandomMatch = fandomLinkRegex.exec(message.content)) !== null) {

        const fandomPageNameEncoded = fandomMatch[1];
        console.log(`Found Fandom link page name (encoded): "${fandomPageNameEncoded}"`);

        const fandomPageNameDecoded = decodeURIComponent(fandomPageNameEncoded.replace(/_/g, ' '));

        const newWikiUrlFormattedPageName = formatPageNameForMediaWikiUrl(fandomPageNameDecoded);
        const newWikiDisplayFormattedPageName = formatPageNameForDisplay(fandomPageNameDecoded);
        const newWikiFullUrl = `${NEW_MEDIAWIKI_BASE_URL}${newWikiUrlFormattedPageName}`;

        const newWikiPageExists = await checkWikiPageExists(fandomPageNameDecoded); 

        let responseText = `Heads up! The Fandom wiki is outdated. You're looking for **${newWikiDisplayFormattedPageName}**? `;

        if (newWikiPageExists) {
            responseText += `You can find the most current information on our new wiki here: <${newWikiFullUrl}>`;
        } else {

            responseText += `While the Fandom link is old, I couldn't find a direct match for **${newWikiDisplayFormattedPageName}** on our new wiki. You might need to search for it: <${NEW_MEDIAWIKI_BASE_URL}Special:Search?search=${encodeURIComponent(newWikiDisplayFormattedPageName)}>`;
        }
        messagesToSend.push(responseText);
    }

    if (messagesToSend.length > 0) {
        try {
            await message.channel.send(messagesToSend.join('\n'));
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }
});

client.login(DISCORD_BOT_TOKEN)
    .catch(error => {
        console.error('Failed to log in to Discord:', error);
        console.error('Please ensure your DISCORD_BOT_TOKEN is correct and has the necessary intents enabled.');
    });