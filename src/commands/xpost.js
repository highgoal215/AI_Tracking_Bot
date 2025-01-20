const { checkIfGroupAdmin } = require('../utils.js');
const { sendXAddtrack, checkIfXPostTrackable } = require('../api.js');
const { addLog } = require('../api.js');
const store = require('../store.js');

const xpostStates = {};

const xPost = async (bot, userId, chatId, chatType) => {
    if (chatType === 'group' || chatType === 'supergroup') {
        const adminIf = await checkIfGroupAdmin(bot, chatId, userId);
        if (!adminIf) {
            await bot.sendMessage(
                chatId,
                'Only Group admins are allowed to use this command',
            );
            return;
        }
    }

    const trackable = await checkIfXPostTrackable(chatId);
    if (!trackable.data.trackable) {
        if (trackable.data.premium?.tokenExpired) {
            bot.sendMessage(
                chatId,
                'It appears that your wallet no longer meets the required holding threshold for premium membership 😭. You have lost your premium status. We hope to welcome you back soon as a premium member. 🤗',
            );
        } else if (trackable.data.premium?.premiumExpired) {
            bot.sendMessage(
                chatId,
                'Your premium membership has expired. To regain access, please use the /premium command.',
            );
        }

        if (trackable.data.premium?.premium) {
            bot.sendMessage(
                chatId,
                `You’ve reached the maximum number of posts.`,
            );
        } else {
            bot.sendMessage(
                chatId,
                `As a basic user, you’ve reached the maximum number of posts. To track more posts, kindly subscribe for /premium.`,
            );
        }

        return;
    }

    xpostStates[userId] = 'User Account';
    await bot.sendMessage(
        chatId,
        'Please enter the username of the X account you’d like to receive post notifications from in this format: @username.',
    );
    store.setCurrentPrompt('XTrackPrompt', {});
};

const handleXPostUserMessages = bot => {
    bot.on('message', async msg => {
        const username = msg.text;
        const userId = msg.from.id;
        const chatId = msg.chat.id;

        const currentPrompt = store.getCurrentPrompt();

        if (currentPrompt.prompt !== 'XTrackPrompt') {
            return;
        }
        if (xpostStates[userId] !== 'User Account') {
            return;
        }
        if (!username.startsWith('@')) {
            await bot.sendMessage(
                chatId,
                `Invalid username. Please try again. To end these prompts, type /end.`,
            );
            return;
        }
        if (username.includes(' ')) {
            await bot.sendMessage(
                chatId,
                `Invalid username. Please try again. To end these prompts, type /end.`,
            );
            return;
        }
        await sendXAddtrack(chatId, username, 'Tweets');
        await bot.sendMessage(
            chatId,
            `You are now tracking ${username}. You will be notified whenever they make a new post`,
        );
        addLog(chatId, 'xTrackPost', '', '');

        delete xpostStates[userId];
        store.clearCurrentPrompt();
    });
};

const xPostUser = async (bot, userId, chatId, chatType, username) => {
    if (chatType === 'group' || chatType === 'supergroup') {
        const adminIf = await checkIfGroupAdmin(bot, chatId, userId);
        if (!adminIf) {
            await bot.sendMessage(
                chatId,
                'Only Group admins are allowed to use this command',
            );
            return;
        }
    }

    const trackable = await checkIfXPostTrackable(chatId);
    if (!trackable.data.trackable) {
        if (trackable.data.premium?.tokenExpired) {
            bot.sendMessage(
                chatId,
                'It appears that your wallet no longer meets the required holding threshold for premium membership 😭. You have lost your premium status. We hope to welcome you back soon as a premium member. 🤗',
            );
        } else if (trackable.data.premium?.premiumExpired) {
            bot.sendMessage(
                chatId,
                'Your premium membership has expired. To regain access, please use the /premium command.',
            );
        }

        if (trackable.data.premium?.premium) {
            bot.sendMessage(
                chatId,
                `You’ve reached the maximum number of posts.`,
            );
        } else {
            bot.sendMessage(
                chatId,
                `As a basic user, you’ve reached the maximum number of posts. To track more posts, kindly subscribe for /premium.`,
            );
        }

        return;
    }

    if (username.includes(' ')) {
        await bot.sendMessage(chatId, `Invalid username. Please try again.`);
        return;
    }
    await sendXAddtrack(chatId, username, 'Tweets');

    await bot.sendMessage(
        chatId,
        `You are now tracking ${username}. You will be notified whenever they make a new post`,
    );
    addLog(chatId, 'xTrackPost', '', chatType);

    delete xpostStates[userId];
};

module.exports = {
    xPost,
    handleXPostUserMessages,
    xPostUser,
};
