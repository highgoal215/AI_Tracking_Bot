const { getOTP, addLog } = require('../api.js');

async function requestOTP(bot, userId, chatId, username, chatType) {
    if (chatType === 'group' || chatType === 'supergroup') {
        bot.sendMessage(
            chatId,
            'This command can only be used in a private message with the bot.',
        );
        return;
    }

    const otp = await getOTP(userId, username);
    bot.sendMessage(
        chatId,
        `<b>Here is your OTP:</b> \n\n<code>${otp.data.otp}</code>\n\n You can use this OTP to login to your account on the Tracker AI website.`,
        {
            parse_mode: 'HTML',
        },
    );
    addLog(chatId, 'otp', '', chatType);
}

module.exports = {
    requestOTP,
};
