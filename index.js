const { Client, GatewayIntentBits, ApplicationCommandOptionType, REST, PermissionsBitField } = require('discord.js');
const Groq = require('groq-sdk');
const fs = require('fs');

const apiKeys = JSON.parse(fs.readFileSync('api_keys.json', 'utf8'));
const clientId = 'DISCORD_CLIENT_ID'; 
const token = 'DISCORD_BOT_TOKEN'; 

const rest = new REST({ version: '10' }).setToken(token);
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

let conversationHistory = {}; 
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
  },
  {
    name: 'forget',
    description: 'Make the bot forget a specific message.',
    options: [{ name: 'message', description: 'The message to forget', type: ApplicationCommandOptionType.String, required: true }]
  },
  {
    name: 'clear',
    description: 'Clear the conversation history.',
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
  const { commandName, options, user } = interaction;

  if (commandName === 'talk') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'You need administrator permissions to use this command.', ephemeral: true });
    }
    targetChannels[user.id] = options.getChannel('channel').id;
    interaction.reply(`I will now talk in <#${targetChannels[user.id]}>.`);
  } else if (commandName === 'ask' || (targetChannels[user.id] && interaction.channelId === targetChannels[user.id])) {
    await handleAsk(interaction, commandName === 'ask' ? options.getString('prompt') : interaction.content, user.id);
  } else if (commandName === 'remember') {
    conversationHistory[user.id] = conversationHistory[user.id] || [];
    conversationHistory[user.id].push({ role: 'user', content: options.getString('prompt') });
    interaction.reply({ content: 'Remembered.', ephemeral: true });
  } else if (commandName === 'forget') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: 'You need Manage Messages permission to use this command.', ephemeral: true });
    }
    const messageToForget = options.getString('message');
    const history = conversationHistory[user.id];
    if (history) {
      conversationHistory[user.id] = history.filter(msg => msg.content !== messageToForget);
      interaction.reply({ content: 'Message forgotten.', ephemeral: true });
    } else {
      interaction.reply({ content: 'No conversation history found.', ephemeral: true });
    }
  } else if (commandName === 'clear') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: 'You need Manage Messages permission to use this command.', ephemeral: true });
    }
    conversationHistory[user.id] = [];
    interaction.reply({ content: 'Conversation history cleared.', ephemeral: true });
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return; 

  if (targetChannels[message.author.id] && message.channelId === targetChannels[message.author.id]) {
    await handleAsk(message, message.content, message.author.id); 
  }
});


async function handleAsk(interaction, prompt, userId) {
  conversationHistory[userId] = conversationHistory[userId] || [];
  conversationHistory[userId].push({ role: 'user', content: prompt });
  if (conversationHistory[userId].length > maxHistoryLength) conversationHistory[userId].shift();

  const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];
  const groq = new Groq({ apiKey });

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: conversationHistory[userId],
      model: "Mixtral-8x7b-32768",
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 32768,
      stream: true,
      stop: null
    });

    let response = '';
    for await (const chunk of chatCompletion) response += chunk.choices[0]?.delta?.content || '';

    conversationHistory[userId].push({ role: 'assistant', content: response });
    interaction.reply(response); 

  } catch (error) {
    console.error('Error processing Groq request:', error);
    interaction.reply('An error occurred.');
  }
}

client.login(token);
