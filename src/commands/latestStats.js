const { getUserTagStats, handleTagRefresh } = require('../api.js');
const { checkIfGroupAdmin } = require('../utils.js');
const store = require('../store.js');

const tagStates = {};

const askForTag = async (bot, chatId, userId, command) => {
    const promptMessage =
        command === '/hashtagstats'
            ? 'Please enter the hashtag you want to get the stats for. It should be in this format: #ETH.'
            : 'Please enter the cashtag you want to get the stats for. It should be in this format: $ETH.';

    tagStates[userId] = 'awaitingTag';
    store.setCurrentPrompt('TagPrompt', { userId, chatId, command });
    await bot.sendMessage(chatId, promptMessage);
};

const sendInvalidTagMessage = async (bot, chatId, userId, type) => {
    const typeMessage =
        type === 'hashtag'
            ? 'Invalid hashtag. Please make sure it starts with #'
            : 'Invalid cashtag. Please make sure it starts with $.';
    await bot.sendMessage(chatId, typeMessage);
    await askForTag(
        bot,
        chatId,
        userId,
        type === 'hashtag' ? '/hashtagstats' : '/cashtagstats',
    );
};

const processTag = async (bot, chatId, tag) => {
    const data = {
        tag,
        chatId,
        isHashTag: tag.startsWith('#'),
        isCashTag: tag.startsWith('$'),
        isNotificationSend: false,
    };

    try {
        await getUserTagStats(data);
    } catch (error) {
        let errorMessage =
            'An unexpected error occurred. Please try again later.';
        if (
            error.response &&
            error.response.data &&
            error.response.data.error
        ) {
            errorMessage = error.response.data.error;
        }
        await bot.sendMessage(chatId, errorMessage);
    }
};

const getTagStats = async (bot, msg, chatType) => {
    if (
        !msg ||
        typeof msg !== 'object' ||
        !msg.from ||
        !msg.chat ||
        !msg.text
    ) {
        return;
    }

    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (
        (chatType === 'group' || chatType === 'supergroup') &&
        !(await checkIfGroupAdmin(bot, chatId, userId))
    ) {
        await bot.sendMessage(
            chatId,
            'You must be a group admin to use this command in a group chat.',
        );
        return;
    }

    if (text.startsWith('/hashtagstats') || text.startsWith('/cashtagstats')) {
        const [command, tag] = text.split(' ');

        if (!tag) {
            await askForTag(bot, chatId, userId, command);
            return;
        }

        if (
            (command === '/hashtagstats' && !tag.startsWith('#')) ||
            (command === '/cashtagstats' && !tag.startsWith('$'))
        ) {
            const type = command === '/hashtagstats' ? 'hashtag' : 'cashtag';
            await sendInvalidTagMessage(bot, chatId, userId, type);
            return;
        }

        await processTag(bot, chatId, tag);
    } else if (tagStates[userId] === 'awaitingTag') {
        const tag = text;

        if (!tag.startsWith('#') && !tag.startsWith('$')) {
            await bot.sendMessage(chatId, 'Invalid tag. Please try again.');
            return;
        }

        await processTag(bot, chatId, tag);

        delete tagStates[userId];
        store.clearCurrentPrompt();
    }
};

const handleTagPrompt = bot => {
    bot.on('message', async msg => {
        const userId = msg.from.id;
        const currentPrompt = store.getCurrentPrompt();

        if (currentPrompt.prompt !== 'TagPrompt') {
            return;
        }

        if (tagStates[userId] !== 'awaitingTag') {
            return;
        }

        await getTagStats(bot, msg, msg.chat.type);
    });
};

const handleCallbackQuery = async bot => {
    bot.on('callback_query', async callbackQuery => {
        const { data, message } = callbackQuery;
        // eslint-disable-next-line camelcase
        const { message_id } = message;
        const chatType = message.chat.type;
        const userId = callbackQuery.from.id;
        const [action, tag, chatId] = data.split('|');

        const isGroup = chatType === 'group' || chatType === 'supergroup';

        if (isGroup) {
            const adminIf = await checkIfGroupAdmin(bot, chatId, userId);
            if (!adminIf) {
                bot.sendMessage(
                    chatId,
                    'Only Group admins are allowed to use this command',
                );
                return;
            }
        }
        
        try {
            const refreshData = {
                chatId,
                tag,
                // eslint-disable-next-line camelcase
                message_id,
            };

            if (action === '30D') {
                const currentDate = new Date();
                const thirtyDaysBack = new Date();
                thirtyDaysBack.setDate(currentDate.getDate() - 30);
                refreshData.filterDate = thirtyDaysBack;

                await handleTagRefresh(refreshData);
            } else if (action === 'refresh') {
                await handleTagRefresh(refreshData);
            } else if (action === '7D') {
                const currentDate = new Date();
                const sevenDaysBack = new Date();
                sevenDaysBack.setDate(currentDate.getDate() - 7);
                refreshData.filterDate = sevenDaysBack;

                await handleTagRefresh(refreshData);
            } else if (action === '24H') {
                const currentDate = new Date();
                const twentyFourHoursBack = new Date();
                twentyFourHoursBack.setHours(currentDate.getHours() - 24);
                refreshData.filterDate = twentyFourHoursBack;

                await handleTagRefresh(refreshData);
            }

            await bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error handling callback query:', error);

            await bot.answerCallbackQuery(callbackQuery.id, {
                text: 'An error occurred. Please try again later.',
                show_alert: true,
            });
        }
    });
};

module.exports = {
    getTagStats,
    handleTagPrompt,
    handleCallbackQuery,
};
