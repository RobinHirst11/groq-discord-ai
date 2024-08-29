const { Client, GatewayIntentBits, ApplicationCommandOptionType, REST, PermissionsBitField } = require('discord.js');
const Groq = require('groq-sdk');
const fs = require('fs');

const apiKeys = JSON.parse(fs.readFileSync('api_keys.json', 'utf8'));
const clientId = 'blah blah'; 
const token = 'kitty'; 

const rest = new REST({ version: '10' }).setToken(token);
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const maxHistoryLength = 5;
let conversationHistory = []; 
const targetChannels = {};

const commands = [
  {
    name: 'talk',
    description: 'Set the channel for the bot to respond in (Admin only).',
    options: [{ 
      name: 'channel', 
      description: 'The channel to respond in.', 
      type: ApplicationCommandOptionType.Channel, 
      required: true 
    }],
  },
  {
    name: 'ask',
    description: 'Ask the bot a question.',
    options: [{ 
      name: 'question', 
      description: 'Your question for the bot.', 
      type: ApplicationCommandOptionType.String, 
      required: true 
    }],
  },
  {
    name: 'remember',
    description: 'Tell the bot something to remember.',
    options: [{ 
      name: 'information', 
      description: 'The information to remember.', 
      type: ApplicationCommandOptionType.String, 
      required: true 
    }],
  },
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

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options } = interaction;

  if (commandName === 'talk') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'You need administrator permissions to use this command.', ephemeral: true });
    }
    const channelId = options.getChannel('channel').id;
    targetChannels[interaction.guild.id] = channelId;
    interaction.reply(`I will now respond in <#${channelId}>.`);
  } else if (commandName === 'ask') {
    await handleQuestion(interaction, options.getString('question'));
  } else if (commandName === 'remember') {
    const info = options.getString('information');
    conversationHistory.push({ role: 'user', content: `Remember: ${info}` });
    if (conversationHistory.length > maxHistoryLength) {
      conversationHistory.shift(); 
    }
    interaction.reply(`I will remember: ${info}`);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const targetChannelId = targetChannels[message.guild.id]; 

  if (targetChannelId && message.channelId === targetChannelId) {
    await handleQuestion(message, message.content);
  }
});

async function handleQuestion(interactionOrMessage, prompt) {
  try {
    conversationHistory.push({ role: 'user', content: prompt });
    if (conversationHistory.length > maxHistoryLength) {
      conversationHistory.shift(); 
    }

    const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];
    const groq = new Groq({ apiKey });

    const chatCompletion = await groq.chat.completions.create({
  messages: [
    { role: "system", content: "You are Jecki Lon, a friendly and human-like AI. Respond to questions and engage in conversation naturally, as if you were talking to a friend. Keep your answers concise and avoid sounding robotic or overly formal. Don't feel the need to constantly state that you are human; let your responses demonstrate that." },
    ...conversationHistory,
  ],
  model: "Mixtral-8x7b-32768",
  temperature: 0.05,
  max_tokens: 32768,
  top_p: 1,
  stream: true,
  stop: null,
});

    let response = '';
    for await (const chunk of chatCompletion) {
      response += chunk.choices[0]?.delta?.content || ''; 
    }

    conversationHistory.push({ role: 'assistant', content: response });

    if (interactionOrMessage.reply) { 
      interactionOrMessage.reply(response);
    } else {
      interactionOrMessage.channel.send(response);
    }

  } catch (error) {
    console.error('Error processing Groq request:', error);
    const errorMessage = 'An error occurred while processing your request.';
    if (interactionOrMessage.reply) {
      interactionOrMessage.reply(errorMessage);
    } else {
      interactionOrMessage.channel.send(errorMessage);
    }
  }
}

client.login(token);
