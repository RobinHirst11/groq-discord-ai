const { Client, GatewayIntentBits, ApplicationCommandOptionType, REST, PermissionsBitField, SlashCommandBuilder, Routes } = require('discord.js');
const Groq = require('groq-sdk');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Load APIs
const apiKeys = JSON.parse(fs.readFileSync('api_keys.json', 'utf8'));
const discordToken = process.env.DISCORD_TOKEN;
const googleApiKey = process.env.GEMINI_API_KEY;
const clientId = process.env.CLIENT_ID;

// Initialize APIs
const genAI = new GoogleGenerativeAI(googleApiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
const rest = new REST({ version: '10' }).setToken(discordToken);

const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMembers
] });

const maxHistoryLength = 5;
let conversationHistory = [];
const targetChannels = {};
const guildSeverityThresholds = new Map();

const commands = [
  new SlashCommandBuilder()
    .setName('setseverity')
    .setDescription('Sets the nickname severity threshold for this server (1-5)')
    .addIntegerOption(option =>
      option.setName('severity')
        .setDescription('The severity threshold (1-5)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(5)
    ),
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
].map(command => command.toJSON());

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  try {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('Successfully registered application commands globally.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'setseverity') {
    const newSeverity = options.getInteger('severity');
    guildSeverityThresholds.set(interaction.guild.id, newSeverity);
    await interaction.reply(`Nickname severity threshold set to ${newSeverity} for this server.`);
  } else if (commandName === 'talk') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'You need administrator permissions to use this command.', ephemeral: true });
    }
    const channelId = options.getChannel('channel').id;
    targetChannels[interaction.guild.id] = channelId;
    await interaction.reply(`I will now respond in <#${channelId}>.`);
  } else if (commandName === 'ask') {
    await handleQuestion(interaction, options.getString('question'));
  } else if (commandName === 'remember') {
    const info = options.getString('information');
    conversationHistory.push({ role: 'user', content: `Remember: ${info}` });
    if (conversationHistory.length > maxHistoryLength) {
      conversationHistory.shift();
    }
    await interaction.reply(`I will remember: ${info}`);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const targetChannelId = targetChannels[message.guild.id];

  if (targetChannelId && message.channelId === targetChannelId) {
    await handleQuestion(message, message.content);
  }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (oldMember.nickname === newMember.nickname) return;

  const newNickname = newMember.nickname;
  const guildId = newMember.guild.id;

  const severityThreshold = guildSeverityThresholds.get(guildId) || 3;

  const severity = await getNicknameSeverity(newNickname);

  if (severity >= severityThreshold && !newNickname.startsWith('User-')) {
    console.log(`Potentially inappropriate nickname detected (severity: ${severity}): ${newNickname}`);
    const randomUsername = generateRandomUsername();
    try {
      await newMember.setNickname(randomUsername);
    } catch (error) {
      console.error('Error setting random nickname:', error);
    }
  }
});

async function getNicknameSeverity(nickname) {
  const prompt = `On a scale of 1 to 5, with 1 being completely harmless and 5 being extremely inappropriate, rate the following nickname ONLY with the corresponding number. Nickname: "${nickname}"`;
  try {
    const chatSession = model.startChat({ generationConfig: { temperature: 0.5, topP: 0.95, topK: 64, maxOutputTokens: 128, responseMimeType: 'text/plain' } });
    const result = await chatSession.sendMessage(prompt);
    const severityString = result.response.text().trim();
    const severityMatch = severityString.match(/\d/);
    const severity = severityMatch ? parseInt(severityMatch[0]) : 3;
    return Math.max(1, Math.min(5, severity));
  } catch (error) {
    console.error('Error getting nickname severity:', error);
    return 3;
  }
}

function generateRandomUsername(length = 8) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return 'User-' + result;
}

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
        { role: 'system', content: 'You are Jecki Lon, a friendly and human-like AI. Respond to questions and engage in conversation naturally, as if you were talking to a friend. Keep your answers concise and avoid sounding robotic or overly formal. Don\'t feel the need to constantly state that you are human; let your responses demonstrate that.' },
        ...conversationHistory,
      ],
      model: 'Mixtral-8x7b-32768',
      temperature: 0.05,
      max_tokens: 32768,
      top_p: 1,
      stream: true,
    });

    let response = '';
    for await (const chunk of chatCompletion) {
      response += chunk.choices[0]?.delta?.content || '';
    }

    conversationHistory.push({ role: 'assistant', content: response });

    if (interactionOrMessage.reply) {
      await interactionOrMessage.reply(response);
    } else {
      await interactionOrMessage.channel.send(response);
    }

  } catch (error) {
    console.error('Error processing Groq request:', error);
    const errorMessage = 'An error occurred while processing your request.';
    if (interactionOrMessage.reply) {
      await interactionOrMessage.reply(errorMessage);
    } else {
      await interactionOrMessage.channel.send(errorMessage);
    }
  }
}

client.login(discordToken);
      
