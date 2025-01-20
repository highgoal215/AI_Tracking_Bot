require('dotenv').config();
const { Connection } = require('@solana/web3.js');

const connection = new Connection('https://api.mainnet-beta.solana.com');

module.exports = {
    TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    API_URL: process.env.API_URL,
    BOT_USERNAME: process.env.BOT_USERNAME,
    SOLANA_CONNECTION: connection,
};
