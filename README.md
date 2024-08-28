# Groq-Discord-ai

This is a Discord bot that leverages the power of [Groq](https://groq.com/) for advanced chat completions and interactions. 

## Features

* **Intelligent Conversations:** Uses the Mixtral-8x7b-32768 model from Groq to provide engaging and context-aware responses. 
* **Channel-Specific Talking:**  Allows administrators to designate a specific channel for the bot to participate in.
* **Direct Question Answering:** Use the `/ask` command to ask the bot questions directly.
* **Conversation Memory:**  The bot remembers a limited history of previous messages for more coherent conversations. (Use `/remember` to explicitly add something to the bot's memory.)

## Setup

1. **Get a Groq API Key:**
   - Sign up for an account at [Groq](https://groq.com/).
   - Create an API key in your Groq dashboard.
2. **Create a Discord Bot:**
   - Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a new application.
   - Create a bot user for your application.
   - Get the **Client ID** and **Bot Token** for your bot. 
3. **Install Dependencies:**
   ```bash
   npm install
   ```
4. **Configure the Bot:**
   - Rename `api_keys (copy).txt` to `api_keys.json` and paste your Groq API key(s) into it (as a JSON array).
   - Rename `index (copy).txt` to `index.js`.
   - In `index.js`, replace the following placeholders with your bot's information:
     - `DISCORD_CLIENT_ID`
     - `DISCORD_BOT_TOKEN`
5. **Invite the Bot to Your Server:**
   - Generate an invite link for your bot using your Client ID. You can use this website: [Discord Permissions Calculator](https://discordapi.com/permissions.html). Make sure to give the bot the necessary permissions (e.g., "Send Messages", "Read Message History").
6. **Run the Bot:**
   ```bash
   node index.js
   ```

## Usage

* **Set the Talk Channel (Admin Only):**
   ```
   /talk channel:<#channel-id>
   ```
* **Ask a Question:**
   ```
   /ask prompt:"Your question here" 
   ```
* **Remember Something:**
   ```
   /remember prompt:"What you want the bot to remember"
   ```

**Note:** In the designated talk channel, you can also interact with the bot by simply sending messages.

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bug reports and feature requests.

## License

This project is licensed under the MIT License.
