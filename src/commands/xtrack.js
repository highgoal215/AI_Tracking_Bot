const { checkIfGroupAdmin, formatNumber } = require('../utils.js');
const {
    sendXAddtrack,
    sendXtrackHashtag,
    addLog,
    checkIfXUserTrackable,
    checkIfXCashtagTrackable,
    checkIfXHashtagTrackable,
    getXTrackUser,
    deleteXTrackUser,
    getXTrackPost,
    deleteXTrackPost,
    getXTrackCashtag,
    deleteXTrackCashtag,
    getXTrackHashtag,
    deleteXTrackHashtag,
    getXTrackUserLeaderboard,
    getXTrackCashtagLeaderboard,
    getXTrackHashtagLeaderboard,
} = require('../api.js');
const store = require('../store.js');

const xtrackPrefix = 'xtrack_type_';
const xtrackStates = {};

const xtrackCashtagExtraFilterPrefix = 'xtract_ctag_efilter_';
const xtrackHashtagPrefix = 'xtrack_hashtag_';
const xtrackHashtags = {};

const xtrackManagePrefix = 'xtrack_manage';

const xTrack = async (bot, userId, chatId, chatType) => {
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
    const buttonsText = ['User Account', '$CASHTAG', '#Hashtag'];
    const buttons = buttonsText.map(text => [
        {
            text,
            callback_data: `${xtrackPrefix}${text}`,
        },
    ]);
    await bot.sendMessage(
        chatId,
        'What or who would you like to track on X/Twitter?',
        {
            reply_markup: {
                inline_keyboard: buttons,
            },
        },
    );
};

const handleXTrackCallbacks = bot => {
    bot.on('callback_query', async query => {
        try {
            const { message, data, from } = query;
            if (!data.includes(xtrackPrefix)) {
                return;
            }
            const chatId = message.chat.id;
            const userId = from.id;
            const xtrackType = data.replace(xtrackPrefix, '');
            const tagname = xtrackType.slice(1).toLowerCase();

            await bot.editMessageReplyMarkup(
                { inline_keyboard: [] },
                { chat_id: chatId, message_id: message.message_id },
            );
            switch (xtrackType) {
                case 'User Account':
                    xtrackStates[userId] = xtrackType;
                    await bot.sendMessage(
                        chatId,
                        `Please enter the username of the account you want to track. It should be in this format: @username`,
                    );
                    store.setCurrentPrompt('XTrackPrompt', {});
                    break;
                case '$CASHTAG':
                case '#Hashtag':
                    xtrackStates[userId] = xtrackType;
                    if (tagname === 'hashtag') {
                        await bot.sendMessage(
                            chatId,
                            'Please enter the hashtag you’d like to track. It should be in this format: #MyHashTag',
                        );
                    } else {
                        await bot.sendMessage(
                            chatId,
                            'Please enter the cashtag you’d like to track. It should be in this format: $ETH',
                        );
                    }
                    store.setCurrentPrompt('XTrackPrompt', {});
                    break;
                default:
                    break;
            }
        } catch (err) {
            // console.error(err);
        }
    });
};

const handleXTrackUserMessages = bot => {
    bot.on('message', async msg => {
        const username = msg.text;
        const userId = msg.from.id;
        const chatId = msg.chat.id;

        const currentPrompt = store.getCurrentPrompt();

        if (currentPrompt.prompt !== 'XTrackPrompt') {
            return;
        }
        if (xtrackStates[userId] !== 'User Account') {
            return;
        }
        if (!username.startsWith('@')) {
            return;
        }
        if (username.includes(' ')) {
            await bot.sendMessage(
                chatId,
                `Invalid username. Please try again. To end these prompts, type /end.`,
            );
            return;
        }
        await sendXAddtrack(chatId, username, 'UserFollowings');
        await bot.sendMessage(
            chatId,
            `You are now tracking ${username}. You will be notified whenever they follow any account`,
        );
        addLog(chatId, 'xTrackUser', '', '');

        delete xtrackStates[userId];
        store.clearCurrentPrompt();
    });
};

const xTrackHashtag = async (bot, userId, chatId, chatType, hashtag) => {
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

    const tagStart = hashtag[0];
    let tagname = '';

    if (tagStart === '$') {
        tagname = 'cashtag';
    } else if (tagStart === '#') {
        tagname = 'hashtag';
    }

    const trackable =
        tagStart === '$'
            ? await checkIfXCashtagTrackable(chatId)
            : await checkIfXHashtagTrackable(chatId);
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
                `You’ve reached the maximum number of ${tagname} to track.`,
            );
        } else {
            bot.sendMessage(
                chatId,
                `As a basic user, you’ve reached the maximum number of ${tagname} to track. To track more, kindly subscribe for /premium.`,
            );
        }

        return;
    }

    xtrackHashtags[userId] = hashtag;
    const buttonsText = [
        '0+',
        '50+',
        '100+',
        '200+',
        '500+',
        '1,000+',
        '2,000+',
        '5,000+',
        '10,000+',
        '20,000+',
        '50,000+',
        '100,000+',
        '200,000+',
        '500,000+',
        '1,000,000+',
    ];
    const threshold = [
        0, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000,
        200_000, 500_000, 1000_000,
    ];

    const buttons = [];
    for (let i = 0; i < buttonsText.length; i += 4) {
        const row = buttonsText.slice(i, i + 4).map((text, index) => ({
            text,
            callback_data: `${xtrackHashtagPrefix}${threshold[i + index]}`,
        }));
        buttons.push(row);
    }

    await bot.sendMessage(
        chatId,
        `Establish a minimum threshold of followers that users mentioning the ${tagname} must have in order for you to receive notifications.`,
        {
            reply_markup: {
                inline_keyboard: buttons,
            },
        },
    );
};

const handleXTrackTagMessages = bot => {
    bot.on('message', async msg => {
        const userId = msg.from.id;
        const chatId = msg.chat.id;
        const tag = msg.text;

        const currentPrompt = store.getCurrentPrompt();

        if (currentPrompt.prompt !== 'XTrackPrompt') {
            return;
        }

        if (
            xtrackStates[userId] !== '#Hashtag' &&
            xtrackStates[userId] !== '$CASHTAG'
        ) {
            return;
        }

        if (!tag) return;
        const tagname = xtrackStates[userId].slice(1).toLowerCase();
        if (tagname === 'cashtag' && tag.charAt(0) !== '$') {
            return;
        }
        if (tagname === 'hashtag' && tag.charAt(0) !== '#') {
            return;
        }
        xtrackHashtags[userId] = tag;
        const buttonsText = [
            '0+',
            '50+',
            '100+',
            '200+',
            '500+',
            '1,000+',
            '2,000+',
            '5,000+',
            '10,000+',
            '20,000+',
            '50,000+',
            '100,000+',
            '200,000+',
            '500,000+',
            '1,000,000+',
        ];
        const threshold = [
            0, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000,
            100_000, 200_100, 500_000, 1000_000,
        ];

        const buttons = [];
        for (let i = 0; i < buttonsText.length; i += 4) {
            const row = buttonsText.slice(i, i + 4).map((text, index) => ({
                text,
                callback_data: `${xtrackHashtagPrefix}${threshold[i + index]}`,
            }));
            buttons.push(row);
        }

        await bot.sendMessage(
            chatId,
            `Establish a minimum threshold of followers that users mentioning the ${tagname} must have in order for you to receive notifications.`,
            {
                reply_markup: {
                    inline_keyboard: buttons,
                },
            },
        );
        delete xtrackStates[userId];
        store.clearCurrentPrompt();
    });
};

const handleXTrackHashtagCallbacks = bot => {
    bot.on('callback_query', async query => {
        try {
            const { message, data, from } = query;
            if (!data.includes(xtrackHashtagPrefix)) {
                return;
            }

            const chatId = message.chat.id;
            const userId = from.id;
            const threshold = data.replace(xtrackHashtagPrefix, '');
            const hashtag = xtrackHashtags[userId];
            if (hashtag === undefined) {
                throw new Error('Hashtag is undefined');
            }

            if (hashtag.charAt(0) === '$') {
                const buttons = ['Yes', 'No'].map(el => ({
                    text: el,
                    callback_data: `${xtrackCashtagExtraFilterPrefix}${el}@${threshold}`,
                }));
                await bot.sendMessage(
                    chatId,
                    `Want to add an extra filter?\n\nIf there are more than 3 cashtags in a post, the bot will not send a notification.`,
                    {
                        reply_markup: {
                            inline_keyboard: [buttons],
                        },
                    },
                );
                return;
            }

            
            await bot.editMessageReplyMarkup(
                { inline_keyboard: [] },
                { chat_id: chatId, message_id: message.message_id },
            );
            await sendXtrackHashtag(chatId, threshold, hashtag);

            await bot.sendMessage(
                chatId,
                `You have now successfully started tracking ${hashtag} on X/Twitter.`,
            );

            addLog(
                chatId,
                hashtag.startsWith('$') ? 'xTrackCashtag' : 'xTrackHashtag',
                '',
                '',
            );
        } catch (err) {
            // console.error(err);
        }
    });
    bot.on('callback_query', async query => {
        try {
            const { message, data, from } = query;
            if (!data.includes(xtrackCashtagExtraFilterPrefix)) {
                return;
            }

            const chatId = message.chat.id;
            const userId = from.id;
            const threshold = data.split('@')[1];
            const withExtraFilter =
                data
                    .split('@')[0]
                    .replace(xtrackCashtagExtraFilterPrefix, '')
                    .toLowerCase() === 'yes';
            const hashtag = xtrackHashtags[userId];
            await bot.editMessageReplyMarkup(
                { inline_keyboard: [] },
                { chat_id: chatId, message_id: message.message_id },
            );
            await sendXtrackHashtag(
                chatId,
                threshold,
                hashtag,
                withExtraFilter,
            );

            await bot.sendMessage(
                chatId,
                `You have now successfully started tracking ${hashtag} on X/Twitter. ${withExtraFilter ? '\nExtra filter is on.' : 'Extra filter is off.'}`,
            );

            addLog(
                chatId,
                hashtag.startsWith('$') ? 'xTrackCashtag' : 'xTrackHashtag',
                '',
                '',
            );
        } catch (e) {
            // console.err(e);
        }
    });
};

const xTrackUser = async (bot, userId, chatId, chatType, username) => {
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

    const trackable = await checkIfXUserTrackable(chatId);
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
                `You’ve reached the maximum number of accounts to stalk.`,
            );
        } else {
            bot.sendMessage(
                chatId,
                `As a basic user, you’ve reached the maximum number of accounts to stalk. To track more accounts, kindly subscribe for /premium.`,
            );
        }

        return;
    }

    if (username.includes(' ')) {
        await bot.sendMessage(chatId, `Invalid username. Please try again.`);
        return;
    }
    // await sendXtrackUser(chatId, username);
    // appendTrackingUser({
    //     tracking_option: 'Followings',
    //     username: username,
    //     chatId: chatId,
    // });
    await sendXAddtrack(chatId, username, 'UserFollowings');
    await bot.sendMessage(
        chatId,
        `You are now tracking ${username}. You will be notified whenever they follow any account`,
    );
    addLog(chatId, 'xTrackUser', '', chatType);
};

const manageXTracking = async (bot, chatId) => {
    const buttons = [
        { text: 'View Trackings', callback_data: `${xtrackManagePrefix}_view` },
        {
            text: 'Delete Tracking',
            callback_data: `${xtrackManagePrefix}_delete`,
        },
    ];
    await bot.sendMessage(chatId, 'Manage your X tracking', {
        reply_markup: {
            inline_keyboard: [buttons],
        },
    });
};

const handleMostTracked = async (bot, chatId) => {
    const buttons = [
        { text: 'Accounts', callback_data: `${xtrackManagePrefix}_account` },
        { text: 'Cashtags', callback_data: `${xtrackManagePrefix}_cashtag` },
        { text: 'Hashtags', callback_data: `${xtrackManagePrefix}_hashtag` },
    ];
    await bot.sendMessage(chatId, 'Most Tracked #️⃣ 💲 🔥', {
        reply_markup: {
            inline_keyboard: [buttons],
        },
    });
};

const handleManageXTrackingCallbacks = bot => {
    bot.on('callback_query', async query => {
        try {
            const { message, data } = query;

            const chatId = message.chat.id;
            // const userId = from.id;
            const command = data.replace(`${xtrackManagePrefix}_`, '');

            if (command === 'view') {
                const buttons = [
                    {
                        text: 'Stalked Accounts',
                        callback_data: `${xtrackManagePrefix}_trackAccounts_view`,
                    },
                    {
                        text: 'Post Notification Subscription',
                        callback_data: `${xtrackManagePrefix}_trackPost_view`,
                    },
                    {
                        text: 'Tracked Cashtag',
                        callback_data: `${xtrackManagePrefix}_trackCashtag_view`,
                    },
                    {
                        text: 'Tracked Hashtag',
                        callback_data: `${xtrackManagePrefix}_trackHashtag_view`,
                    },
                ];

                await bot.sendMessage(chatId, 'View your tracking.', {
                    reply_markup: {
                        inline_keyboard: [buttons],
                    },
                });
            } else if (command === 'delete') {
                const buttons = [
                    {
                        text: 'Stalked Accounts',
                        callback_data: `${xtrackManagePrefix}_trackAccounts_delete`,
                    },
                    {
                        text: 'Post Notification Subscription',
                        callback_data: `${xtrackManagePrefix}_trackPost_delete`,
                    },
                    {
                        text: 'Tracked Cashtag',
                        callback_data: `${xtrackManagePrefix}_trackCashtag_delete`,
                    },
                    {
                        text: 'Tracked Hashtag',
                        callback_data: `${xtrackManagePrefix}_trackHashtag_delete`,
                    },
                ];

                await bot.sendMessage(chatId, 'Delete your tracking.', {
                    reply_markup: {
                        inline_keyboard: [buttons],
                    },
                });
            } else if (command === 'account') {
                const res = await getXTrackUserLeaderboard();
                const Trackers = res.data?.Trackers || [];

                let message = '';
                if (Trackers.length > 0) {
                    message += `🏅 <b>Most Tracked Accounts</b> 🏅\n\n<b>S/N</b>      <b>Accounts</b> - <b>Number of Trackers</b>\n\n`;
                    // eslint-disable-next-line array-callback-return
                    Trackers.map((tracker, index) => {
                        message += ` ${index + 1}.        <a href="https://x.com/${tracker.Username}">@${tracker.Username || ''}</a> - ${formatNumber(tracker.Counts)}\n`;
                    });
                } else {
                    message += 'There are currently no tracked accounts.';
                }
                bot.sendMessage(chatId, message, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true,
                });
            } else if (command === 'cashtag') {
                const res = await getXTrackCashtagLeaderboard();
                const Trackers = res.data?.Trackers || [];

                let message = '';
                if (Trackers.length > 0) {
                    message += `🏅 <b>Most Tracked Cashtags</b> 🏅\n\n<b>S/N</b>      <b>Cashtags</b> - <b>Number of Trackers</b>\n\n`;
                    // eslint-disable-next-line array-callback-return
                    Trackers.map((tracker, index) => {
                        message += ` ${index + 1}.        $${tracker.Tag || ''} - ${formatNumber(tracker.Counts)}\n`;
                    });
                } else {
                    message += 'There are currently no tracked Cashtags.';
                }
                bot.sendMessage(chatId, message, {
                    parse_mode: 'HTML',
                });
            } else if (command === 'hashtag') {
                const res = await getXTrackHashtagLeaderboard();
                const Trackers = res.data?.Trackers || [];

                let message = '';
                if (Trackers.length > 0) {
                    message += `🏅 <b>Most Tracked Hashtags</b> 🏅\n\n<b>S/N</b>      <b>Hashtags</b> - <b>Number of Trackers</b>\n\n`;
                    // eslint-disable-next-line array-callback-return
                    Trackers.map((tracker, index) => {
                        message += ` ${index + 1}.        #${tracker.Tag || ''} - ${formatNumber(tracker.Counts)}\n`;
                    });
                } else {
                    message += 'There are currently no tracked Hashtags.';
                }
                bot.sendMessage(chatId, message, {
                    parse_mode: 'HTML',
                });
            } else if (command.includes('trackAccounts')) {
                const commandType = command.replace(`trackAccounts_`, '');

                const res = await getXTrackUser(chatId);

                if (res.data?.trackingData?.length <= 0) {
                    bot.sendMessage(
                        chatId,
                        'You’re not stalking any X accounts.',
                    );
                    return;
                }

                const trackingData = res.data?.trackingData || [];

                if (commandType === 'view') {
                    let message = 'You’re stalking the following X accounts.';
                    for (let i = 0; i < trackingData.length; i += 1) {
                        message += `\n${i + 1}. @${trackingData[i]?.Username || ''}`;
                    }

                    bot.sendMessage(chatId, message);
                    return;
                }
                if (commandType === 'delete') {
                    const buttons = [];
                    for (let i = 0; i < trackingData.length; i += 4) {
                        const row = trackingData.slice(i, i + 4).map(user => ({
                            text: `@${user?.Username || ''}`,
                            callback_data: `${xtrackManagePrefix}_trackAccounts_${user?.Id}_${user?.Username}`,
                        }));
                        buttons.push(row);
                    }

                    bot.sendMessage(chatId, 'Stalked Accounts', {
                        reply_markup: {
                            inline_keyboard: buttons,
                        },
                    });
                    return;
                }

                if (commandType.includes('yes')) {
                    const info = commandType.replace('yes_', '');
                    const [id, username] = info.split('_');
                    await deleteXTrackUser(id);

                    bot.sendMessage(
                        chatId,
                        `You stopped tracking @${username}.`,
                    );
                    return;
                }

                const [id, username] = commandType.split('_');

                bot.sendMessage(
                    chatId,
                    `Are you sure you want to stop tracking @${username}`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: 'Yes',
                                        callback_data: `${xtrackManagePrefix}_trackAccounts_yes_${id}_${username}`,
                                    },
                                    { text: 'No', callback_data: 'undefined' },
                                ],
                            ],
                        },
                    },
                );
            } else if (command.includes('trackPost')) {
                const commandType = command.replace(`trackPost_`, '');

                const res = await getXTrackPost(chatId);

                if (res.data?.trackingData?.length <= 0) {
                    bot.sendMessage(
                        chatId,
                        'You didn’t subscribe for any post notification.',
                    );
                    return;
                }

                const trackingData = res.data?.trackingData || [];

                if (commandType === 'view') {
                    let message =
                        'You subscribed to get post notifications from the following accounts.';
                    for (let i = 0; i < trackingData.length; i += 1) {
                        message += `\n${i + 1}. @${trackingData[i]?.Username || ''}`;
                    }

                    bot.sendMessage(chatId, message);
                    return;
                }
                if (commandType === 'delete') {
                    const buttons = [];
                    for (let i = 0; i < trackingData.length; i += 4) {
                        const row = trackingData.slice(i, i + 4).map(user => ({
                            text: `@${user?.Username || ''}`,
                            callback_data: `${xtrackManagePrefix}_trackPost_${user?.Id}_${user?.Username}`,
                        }));
                        buttons.push(row);
                    }

                    bot.sendMessage(chatId, 'Post notification Subscription', {
                        reply_markup: {
                            inline_keyboard: buttons,
                        },
                    });
                    return;
                }

                if (commandType.includes('yes')) {
                    const info = commandType.replace('yes_', '');
                    const [id, username] = info.split('_');
                    await deleteXTrackPost(id);

                    bot.sendMessage(
                        chatId,
                        `You stopped tracking @${username}.`,
                    );
                    return;
                }

                const [id, username] = commandType.split('_');

                bot.sendMessage(
                    chatId,
                    `Are you sure you want to stop tracking @${username}`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: 'Yes',
                                        callback_data: `${xtrackManagePrefix}_trackPost_yes_${id}_${username}`,
                                    },
                                    { text: 'No', callback_data: 'undefined' },
                                ],
                            ],
                        },
                    },
                );
            } else if (command.includes('trackCashtag')) {
                const commandType = command.replace(`trackCashtag_`, '');

                const res = await getXTrackCashtag(chatId);

                if (res.data?.trackingData?.length <= 0) {
                    bot.sendMessage(
                        chatId,
                        'You’re currently not tracking any cashtag.',
                    );
                    return;
                }

                const trackingData = res.data?.trackingData || [];

                if (commandType === 'view') {
                    let message =
                        'You subscribed to get notification whenever the following cashtags are being used in a post.';
                    for (let i = 0; i < trackingData.length; i += 1) {
                        message += `\n${i + 1}. $${trackingData[i]?.Tag || ''} - ${trackingData[i]?.Threshold || 0}+`;
                    }

                    bot.sendMessage(chatId, message);
                    return;
                }
                if (commandType === 'delete') {
                    const buttons = [];
                    for (let i = 0; i < trackingData.length; i += 4) {
                        const row = trackingData.slice(i, i + 4).map(tag => ({
                            text: `$${tag?.Tag || ''}`,
                            callback_data: `${xtrackManagePrefix}_trackCashtag_${tag?.Id}_${tag?.Tag}`,
                        }));
                        buttons.push(row);
                    }

                    bot.sendMessage(chatId, 'Tracked Cashtags', {
                        reply_markup: {
                            inline_keyboard: buttons,
                        },
                    });
                    return;
                }

                if (commandType.includes('yes')) {
                    const info = commandType.replace('yes_', '');
                    const [id, tag] = info.split('_');
                    await deleteXTrackCashtag(id);

                    bot.sendMessage(chatId, `You stopped tracking $${tag}.`);
                    return;
                }

                const [id, tag] = commandType.split('_');

                bot.sendMessage(
                    chatId,
                    `Are you sure you want to stop tracking $${tag}`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: 'Yes',
                                        callback_data: `${xtrackManagePrefix}_trackCashtag_yes_${id}_${tag}`,
                                    },
                                    { text: 'No', callback_data: 'undefined' },
                                ],
                            ],
                        },
                    },
                );
            } else if (command.includes('trackHashtag')) {
                const commandType = command.replace(`trackHashtag_`, '');

                const res = await getXTrackHashtag(chatId);

                if (res.data?.trackingData?.length <= 0) {
                    bot.sendMessage(
                        chatId,
                        'You’re currently not tracking any hashtag.',
                    );
                    return;
                }

                const trackingData = res.data?.trackingData || [];

                if (commandType === 'view') {
                    let message =
                        'You subscribed to get notification whenever the following hashtags are being used in a post.';
                    for (let i = 0; i < trackingData.length; i += 1) {
                        message += `\n${i + 1}. #${trackingData[i]?.Tag || ''} - ${trackingData[i]?.Threshold || 0}+`;
                    }

                    bot.sendMessage(chatId, message);
                    return;
                }
                if (commandType === 'delete') {
                    const buttons = [];
                    for (let i = 0; i < trackingData.length; i += 4) {
                        const row = trackingData.slice(i, i + 4).map(tag => ({
                            text: `#${tag?.Tag || ''}`,
                            callback_data: `${xtrackManagePrefix}_trackHashtag_${tag?.Id}_${tag?.Tag}`,
                        }));
                        buttons.push(row);
                    }

                    bot.sendMessage(chatId, 'Tracked Hashtags', {
                        reply_markup: {
                            inline_keyboard: buttons,
                        },
                    });
                    return;
                }

                if (commandType.includes('yes')) {
                    const info = commandType.replace('yes_', '');
                    const [id, tag] = info.split('_');
                    await deleteXTrackHashtag(id);

                    bot.sendMessage(chatId, `You stopped tracking #${tag}.`);
                    return;
                }

                const [id, tag] = commandType.split('_');

                bot.sendMessage(
                    chatId,
                    `Are you sure you want to stop tracking #${tag}`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: 'Yes',
                                        callback_data: `${xtrackManagePrefix}_trackHashtag_yes_${id}_${tag}`,
                                    },
                                    { text: 'No', callback_data: 'undefined' },
                                ],
                            ],
                        },
                    },
                );
            }
        } catch (err) {
            // console.error(err);
        }
    });
};

module.exports = {
    handleXTrackHashtagCallbacks,
    xTrack,
    handleXTrackCallbacks,
    handleXTrackUserMessages,
    handleXTrackTagMessages,
    handleMostTracked,
    xTrackUser,
    xTrackHashtag,
    manageXTracking,
    handleManageXTrackingCallbacks,
};
