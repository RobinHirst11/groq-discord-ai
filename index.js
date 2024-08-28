const { Client, GatewayIntentBits, ApplicationCommandOptionType, REST, PermissionsBitField } = require('discord.js');
const Groq = require('groq-sdk');
const fs = require('fs');

const apiKeys = JSON.parse(fs.readFileSync('api_keys.json', 'utf8'));
const clientId = 'DISCORD_CLIENT_ID'; 
const token = 'DISCORD_BOT_TOKEN'; 

const rest = new REST({ version: '10' }).setToken(token);
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

let conversationHistory = [];
const maxHistoryLength = 5;
const targetChannels = {};

const commands = [
  {
    name: 'talk',
    description: 'Set the channel for the bot to talk in.',
    options: [{ name: 'channel', description: 'The channel ID', type: ApplicationCommandOptionType.Channel, required: true }]
  },
  {
    name: 'ask',
    description: 'Ask the bot a question.',
    options: [{ name: 'prompt', description: 'Your question', type: ApplicationCommandOptionType.String, required: true }]
  },
  {
    name: 'remember',
    description: 'Tell the bot something to remember.',
    options: [{ name: 'prompt', description: 'What to remember', type: ApplicationCommandOptionType.String, required: true }]
  }
];

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  try {
    await rest.put(`/applications/${clientId}/commands`, { body: commands });
    console.log('Successfully registered application commands globally.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options } = interaction;

  if (commandName === 'talk') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'You need administrator permissions to use this command.', ephemeral: true });
    }
    targetChannels[interaction.user.id] = options.getChannel('channel').id;
    interaction.reply(`I will now talk in <#${targetChannels[interaction.user.id]}>.`);
  } else if (commandName === 'ask' || (targetChannels[interaction.user.id] && interaction.channelId === targetChannels[interaction.user.id])) {
    await handleAsk(interaction, commandName === 'ask' ? options.getString('prompt') : interaction.content);
  } else if (commandName === 'remember') {
    conversationHistory.push({ role: 'user', content: options.getString('prompt') });
    interaction.reply({ content: 'Remembered.', ephemeral: true });
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return; 

  if (targetChannels[message.author.id] && message.channelId === targetChannels[message.author.id]) {
    await handleAsk(message, message.content); 
  }
});


async function handleAsk(interaction, prompt) {
  try {
    conversationHistory.push({ role: 'user', content: prompt });
    if (conversationHistory.length > maxHistoryLength) conversationHistory.shift();

    const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];
    const groq = new Groq({ apiKey });

    const chatCompletion = await groq.chat.completions.create({
      messages: conversationHistory,
      model: "Mixtral-8x7b-32768",
      temperature: 0.05,
      max_tokens: 32768,
      top_p: 1,
      stream: true,
      stop: null
    });

    let response = '';
    for await (const chunk of chatCompletion) response += chunk.choices[0]?.delta?.content || '';

    conversationHistory.push({ role: 'assistant', content: response });
    interaction.reply(response); 

  } catch (error) {
    console.error('Error processing Groq request:', error);
    interaction.reply('An error occurred.');
  }
}

client.login(token);
