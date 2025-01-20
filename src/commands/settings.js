const {
    getAccountByUserId,
    addAccount,
    updateChains,
    updateMinimumAmount,
    getReferralLeaderboard,
    getReferralCountByUsername,
    getMyWalletsByUserId,
    getBlockedTokensByUserId,
    updateBlockedTokens,
    getMyStalkedWalletsByUserId,
    addLog,
    getUserActivityLeaderboard,
    getGroupActivityLeaderboard,
} = require('../api.js');

const { BOT_USERNAME } = require('../config.js');
const store = require('../store.js');
const { fetchToken, checkIfGroupAdmin, formatNumber } = require('../utils.js');

const settingPrefix = 'setting';
const selectedChains = {};
const unwantedTokens = {};
const userTokens = {};
let currentPage = 1;
const chains = [
    { symbol: 'eth', name: 'ETH' },
    { symbol: 'bsc', name: 'BSC' },
    { symbol: 'arb', name: 'ARB' },
    { symbol: 'matic', name: 'MATIC' },
    { symbol: 'ftm', name: 'FANTOM' },
    { symbol: 'base', name: 'BASE' },
    { symbol: 'cro', name: 'CRO' },
    { symbol: 'sol', name: 'SOL' },
];
let lastUserActivityLeaderboardDate = 'All';
let lastGroupActivityLeaderboardDate = 'All';

const checkDate = date => {
    const datelist = date.split('-');
    const today = new Date();
    if (
        today.getFullYear() < datelist[0] &&
        today.getMonth() < datelist[1] &&
        today.getDay() < datelist[2]
    ) {
        return false;
    }
    if (datelist[1] <= '12' && datelist[2] <= '31') {
        return true;
    }
    return false;
};

async function handleSetting(bot, chatId, userId, chatType) {
    if (chatType === 'group' || chatType === 'supergroup') {
        const adminIf = await checkIfGroupAdmin(bot, chatId, userId);
        if (!adminIf) {
            bot.sendMessage(
                chatId,
                'Only Group admins are allowed to use this command',
            );
            return;
        }
    }
    const buttons = [
        [
            { text: 'CHAIN SETTING', callback_data: `${settingPrefix}_chain` },
            {
                text: 'TOKEN VALUE SETTING',
                callback_data: `${settingPrefix}_value`,
            },
        ],
        [
            {
                text: 'REMOVE TOKENS',
                callback_data: `${settingPrefix}_token`,
            },
        ],
    ];

    bot.sendMessage(chatId, 'Choose settings category ⚙️⚒', {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: buttons,
        },
    });
}

async function handleChainsSetting(bot, chatId, userId, chatType) {
    const isGroup = chatType === 'group' || chatType === 'supergroup';

    const id = isGroup ? chatId : userId;
    let account = await getAccountByUserId(id);
    if (!account.data.Account) {
        account = await addAccount(id, chatType);
    }
    if (
        account.data.Account.Chains &&
        JSON.parse(account.data.Account.Chains).length > 0
    ) {
        selectedChains[id] = JSON.parse(account.data.Account.Chains);
    } else {
        selectedChains[id] = [];
    }

    const inlineKeyboard = chains.map(chain => {
        return [
            {
                text: `${selectedChains[id].includes(`${chain.symbol}`) ? ' ✓' : ''} ${chain.name}`,
                callback_data: `${settingPrefix}_${chain.symbol}`,
            },
        ];
    });

    inlineKeyboard.push([
        { text: 'Save Updates', callback_data: `${settingPrefix}_save` },
    ]);

    bot.sendMessage(
        chatId,
        '<b>Chain Settings</b>\nKindly select the chains you want to be displayed when you scan',
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: inlineKeyboard,
            },
        },
    );
}

async function handleTokensSetting(bot, chatId, userId, chatType) {
    try {
        const isGroup = chatType === 'group' || chatType === 'supergroup';
        const id = isGroup ? chatId : userId;
        let account = await getAccountByUserId(id);
        if (!account.data.Account) {
            account = await addAccount(id, chatType);
        }
        if (
            account.data.Account.Chains &&
            JSON.parse(account.data.Account.Chains).length > 0
        ) {
            selectedChains[id] = JSON.parse(account.data.Account.Chains);
        } else {
            selectedChains[id] = [];
        }

        unwantedTokens[id] = [];
        let blocked = await getBlockedTokensByUserId(id);
        if (!blocked.data) {
            blocked = await addAccount(id, chatType);
        }
        if (blocked.data.BlockedTokens) {
            const { BlockedTokens } = blocked.data;
            BlockedTokens.forEach(token => {
                unwantedTokens[id].push(token.Token);
            });
        }

        const myWallets = await getMyWalletsByUserId(id);
        const stalkedWallets = await getMyStalkedWalletsByUserId(id);
        const wallets = [...myWallets.wallets, ...stalkedWallets.wallets];
        const promises = wallets.map(async wallet => {
            const res = await fetchToken(wallet.Wallet);
            return res;
        });
        const walletData = await Promise.all(promises);

        userTokens[userId] = [];
        walletData.forEach(tokens => {
            tokens.data.forEach(token => {
                /* eslint-disable no-prototype-builtins */
                if (!userTokens[userId].hasOwnProperty(token.chain)) {
                    userTokens[userId][token.chain] = [];
                }
                if (
                    !userTokens[userId][token.chain].find(
                        item => item.id === token.id,
                    )
                ) {
                    userTokens[userId][token.chain].push({
                        id: token.id,
                        name: token.name,
                    });
                }
            });
        });

        const filteredChain = chains.filter(
            chain =>
                selectedChains[id].includes(chain.symbol) &&
                userTokens[userId].hasOwnProperty(chain.symbol),
        );
        const inlineKeyboard = [];
        let maxLength = 0;
        currentPage = 1;

        inlineKeyboard.push(
            filteredChain.map(chain => {
                return {
                    text: `-- ${chain.name} --`,
                    callback_data: 'none',
                };
            }),
        );

        filteredChain.forEach(chain => {
            maxLength = Math.max(
                maxLength,
                userTokens[userId][chain.symbol].length,
            );
        });

        for (
            let index = 10 * (currentPage - 1);
            index < Math.min(10 * currentPage, maxLength);
            index += 1
        ) {
            const row = [];
            filteredChain.forEach(chain => {
                row.push(
                    userTokens[userId][chain.symbol][index]
                        ? {
                              text: `${unwantedTokens[id].includes(userTokens[userId][chain.symbol][index].id) ? '' : '✓'} ${userTokens[userId][chain.symbol][index].name}`,
                              callback_data: `${settingPrefix}_blockToken_${userTokens[userId][chain.symbol][index].id}`,
                          }
                        : {
                              text: '-',
                              callback_data: 'none',
                          },
                );
            });
            inlineKeyboard.push(row);
        }

        inlineKeyboard.push([
            {
                text: '◀️ Prev',
                callback_data:
                    currentPage - 1 < 0
                        ? 'none'
                        : `${settingPrefix}_blockToken_page_${currentPage - 1}`,
            },
            {
                text: '🔄 Deselect All',
                callback_data: `${settingPrefix}_blockToken_deselectAll`,
            },
            {
                text: 'Next ▶️',
                callback_data:
                    (currentPage + 1) * 10 > maxLength
                        ? 'none'
                        : `${settingPrefix}_blockToken_page_${currentPage + 1}`,
            },
        ]);

        inlineKeyboard.push([
            {
                text: 'Select All',
                callback_data: `${settingPrefix}_blockToken_selectAll`,
            },
        ]);

        inlineKeyboard.push([
            {
                text: 'Save Updates',
                callback_data: `${settingPrefix}_blockToken_save`,
            },
        ]);

        bot.sendMessage(
            chatId,
            '<b>Token Settings</b>\nKindly select the tokens you want to see in your portfolio',
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: inlineKeyboard,
                },
            },
        );
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
    }
}

async function handleUserActivityLeaderboard(
    bot,
    chatId,
    messageId = '',
    date = 'All',
) {
    lastUserActivityLeaderboardDate = date;

    bot.sendMessage(chatId, 'Processing command...⏳👀').then(
        async loadingMsg => {
            const referrals = await getUserActivityLeaderboard(date);

            let message = '';
            if (referrals.data.Activities.length > 0) {
                message += `🏅 <b>User Activity Leaderboard ( ${date} )</b> 🏅\n\n<b>Rank</b>      <b>Username</b> - <b>Activity Count</b>\n`;
                // eslint-disable-next-line array-callback-return
                referrals.data.Activities.map((activity, index) => {
                    message += ` ${index + 1}.        @${(activity.username || '').slice(0, 20)}${activity.username?.length > 20 ? '...' : ''} - ${formatNumber(activity.activityCounts)}\n`;
                });
            } else {
                message += 'There are no accounts who have activities.';
            }

            const buttons = [
                [
                    {
                        text: '24H',
                        callback_data: `${settingPrefix}_userActivityLeaderboard_24H`,
                    },
                    {
                        text: '7D',
                        callback_data: `${settingPrefix}_userActivityLeaderboard_7D`,
                    },
                    {
                        text: '30D',
                        callback_data: `${settingPrefix}_userActivityLeaderboard_30D`,
                    },
                    {
                        text: 'Custom',
                        callback_data: `${settingPrefix}_userActivityLeaderboard_custom`,
                    },
                ],
                [
                    {
                        text: '🔄 Refresh',
                        callback_data: `${settingPrefix}_userActivityLeaderboard_refresh`,
                    },
                ],
            ];

            bot.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id).then(
                () => {
                    if (messageId) {
                        bot.editMessageText(message, {
                            chat_id: chatId,
                            message_id: messageId,
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: buttons,
                            },
                        });
                    } else {
                        bot.sendMessage(chatId, message, {
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: buttons,
                            },
                        });
                    }
                    addLog(chatId, 'userActivityLeaderboard', '', '');
                },
            );
        },
    );
}

async function handleGroupActivityLeaderboard(
    bot,
    chatId,
    messageId = '',
    date = 'All',
) {
    lastGroupActivityLeaderboardDate = date;

    bot.sendMessage(chatId, 'Processing command...⏳👀').then(
        async loadingMsg => {
            const referrals = await getGroupActivityLeaderboard(date);

            let message = '';
            if (referrals.data.Activities.length > 0) {
                message += `🏅 <b>Group Activity Leaderboard ( ${date} )</b> 🏅\n\n<b>Rank</b>      <b>Group Name</b> - <b>Activity Count</b>\n`;
                // eslint-disable-next-line array-callback-return
                referrals.data.Activities.map((activity, index) => {
                    message += ` ${index + 1}.        ${(activity.groupname || '').slice(0, 20)}${activity.groupname?.length > 20 ? '...' : ''} - ${formatNumber(activity.activityCounts)}\n`;
                });
            } else {
                message += 'There are currently no groups with activities.';
            }

            const buttons = [
                [
                    {
                        text: '24H',
                        callback_data: `${settingPrefix}_groupActivityLeaderboard_24H`,
                    },
                    {
                        text: '7D',
                        callback_data: `${settingPrefix}_groupActivityLeaderboard_7D`,
                    },
                    {
                        text: '30D',
                        callback_data: `${settingPrefix}_groupActivityLeaderboard_30D`,
                    },
                    {
                        text: 'Custom',
                        callback_data: `${settingPrefix}_groupActivityLeaderboard_custom`,
                    },
                ],
                [
                    {
                        text: '🔄 Refresh',
                        callback_data: `${settingPrefix}_groupActivityLeaderboard_refresh`,
                    },
                ],
            ];

            bot.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id).then(
                () => {
                    if (messageId) {
                        bot.editMessageText(message, {
                            chat_id: chatId,
                            message_id: messageId,
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: buttons,
                            },
                        });
                    } else {
                        bot.sendMessage(chatId, message, {
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: buttons,
                            },
                        });
                    }

                    addLog(chatId, 'groupActivityLeaderboard', '', '');
                },
            );
        },
    );
}

async function handleSettingCallbacks(bot) {
    bot.on('callback_query', async query => {
        const { message, data } = query;
        try {
            if (data.includes(settingPrefix)) {
                const userId = query.from.id;
                const chatId = message.chat.id;
                const chatType = message.chat.type;
                const surfix = data.replace(`${settingPrefix}_`, '');
                const isGroup =
                    chatType === 'group' || chatType === 'supergroup';

                if (isGroup) {
                    const adminIf = await checkIfGroupAdmin(
                        bot,
                        chatId,
                        userId,
                    );
                    if (!adminIf) {
                        bot.sendMessage(
                            chatId,
                            'Only Group admins are allowed to use this command',
                        );
                        return;
                    }
                }

                const id = isGroup ? chatId : userId;

                if (surfix.includes('userActivityLeaderboard')) {
                    const date = surfix.replace('userActivityLeaderboard_', '');

                    if (date === 'custom') {
                        await bot.sendMessage(
                            chatId,
                            'Please enter the start date you wish to check the user activity from. The date format should be: YYYY-MM-DD, for example, 2024-03-14.',
                        );

                        store.setCurrentPrompt(
                            'userActivityLeaderboardPrompt',
                            {},
                        );
                        return;
                    }

                    if (date === 'refresh') {
                        handleUserActivityLeaderboard(
                            bot,
                            chatId,
                            message.message_id,
                            lastUserActivityLeaderboardDate,
                        );
                        return;
                    }

                    handleUserActivityLeaderboard(
                        bot,
                        chatId,
                        message.message_id,
                        date,
                    );
                    return;
                }

                if (surfix.includes('groupActivityLeaderboard')) {
                    const date = surfix.replace(
                        'groupActivityLeaderboard_',
                        '',
                    );

                    if (date === 'custom') {
                        await bot.sendMessage(
                            chatId,
                            'Please enter the start date you wish to check the group activity from. The date format should be: YYYY-MM-DD, for example, 2024-03-14.',
                        );

                        store.setCurrentPrompt(
                            'groupActivityLeaderboardPrompt',
                            {},
                        );
                        return;
                    }

                    if (date === 'refresh') {
                        handleGroupActivityLeaderboard(
                            bot,
                            chatId,
                            message.message_id,
                            lastGroupActivityLeaderboardDate,
                        );
                        return;
                    }

                    handleGroupActivityLeaderboard(
                        bot,
                        chatId,
                        message.message_id,
                        date,
                    );
                    return;
                }

                if (surfix === 'chain') {
                    handleChainsSetting(bot, chatId, userId, chatType);
                    return;
                }

                if (surfix === 'token') {
                    handleTokensSetting(bot, chatId, userId, chatType);
                    return;
                }

                if (surfix === 'value') {
                    const namePrompt = await bot.sendMessage(
                        message.chat.id,
                        'Enter the minimum amount (in USD) you wish to be displayed.',
                    );

                    store.setCurrentPrompt('updateMinimumAmountPrompt', {});

                    bot.onReplyToMessage(
                        message.chat.id,
                        namePrompt.message_id,
                        async nameMsg => {
                            const value = nameMsg.text;
                            await updateMinimumAmount(userId, value);
                            bot.sendMessage(
                                message.chat.id,
                                'Successfully saved!',
                            );
                            addLog(chatId, 'updateMinimumAmount', '', chatType);
                        },
                    );
                    return;
                }

                if (surfix.includes('blockToken')) {
                    if (surfix.includes('save')) {
                        await updateBlockedTokens(id, unwantedTokens[id]);
                        bot.sendMessage(chatId, 'Successfully saved!');
                        addLog(chatId, 'updateTokenSetting', '', chatType);
                        return;
                    }

                    if (surfix.includes('deselectAll')) {
                        unwantedTokens[id] = Object.values(userTokens[id])
                            .flat()
                            .map(token => token.id);
                    } else if (surfix.includes('selectAll')) {
                        unwantedTokens[id] = [];
                    } else if (surfix.includes('page')) {
                        currentPage = surfix.replace('blockToken_page_', '');
                    } else {
                        const tokenId = surfix.replace('blockToken_', '');
                        const index = unwantedTokens[id].indexOf(tokenId);
                        if (index > -1) {
                            unwantedTokens[id].splice(index, 1);
                        } else {
                            unwantedTokens[id].push(tokenId);
                        }
                    }

                    const filteredChain = chains.filter(
                        chain =>
                            selectedChains[id].includes(chain.symbol) &&
                            userTokens[userId].hasOwnProperty(chain.symbol),
                    );
                    const inlineKeyboard = [];
                    let maxLength = 0;

                    inlineKeyboard.push(
                        filteredChain.map(chain => {
                            return {
                                text: `-- ${chain.name} --`,
                                callback_data: 'none',
                            };
                        }),
                    );

                    filteredChain.forEach(chain => {
                        maxLength = Math.max(
                            maxLength,
                            userTokens[userId][chain.symbol].length,
                        );
                    });

                    for (
                        let index = 10 * (currentPage - 1);
                        index < Math.min(10 * currentPage, maxLength);
                        index += 1
                    ) {
                        const row = [];
                        filteredChain.forEach(chain => {
                            row.push(
                                userTokens[userId][chain.symbol][index]
                                    ? {
                                          text: `${unwantedTokens[id].includes(userTokens[userId][chain.symbol][index].id) ? '' : '✓'} ${userTokens[userId][chain.symbol][index].name}`,
                                          callback_data: `${settingPrefix}_blockToken_${userTokens[userId][chain.symbol][index].id}`,
                                      }
                                    : {
                                          text: '-',
                                          callback_data: 'none',
                                      },
                            );
                        });
                        inlineKeyboard.push(row);
                    }

                    inlineKeyboard.push([
                        {
                            text: '◀️ Prev',
                            callback_data:
                                currentPage - 1 <= 0
                                    ? 'none'
                                    : `${settingPrefix}_blockToken_page_${Number(currentPage) - 1}`,
                        },
                        {
                            text: '🔄 Deselect All',
                            callback_data: `${settingPrefix}_blockToken_deselectAll`,
                        },
                        {
                            text: 'Next ▶️',
                            callback_data:
                                currentPage * 10 > maxLength
                                    ? 'none'
                                    : `${settingPrefix}_blockToken_page_${Number(currentPage) + 1}`,
                        },
                    ]);

                    inlineKeyboard.push([
                        {
                            text: 'Select All',
                            callback_data: `${settingPrefix}_blockToken_selectAll`,
                        },
                    ]);

                    inlineKeyboard.push([
                        {
                            text: 'Save Updates',
                            callback_data: `${settingPrefix}_blockToken_save`,
                        },
                    ]);

                    bot.editMessageReplyMarkup(
                        {
                            inline_keyboard: inlineKeyboard,
                        },
                        {
                            chat_id: query.message.chat.id,
                            message_id: query.message.message_id,
                        },
                    );
                    return;
                }

                if (surfix === 'save') {
                    await updateChains(id, JSON.stringify(selectedChains[id]));
                    bot.sendMessage(chatId, 'Successfuly saved!');
                    addLog(chatId, 'updateChainSetting', '', chatType);
                    return;
                }

                // Initialize selected options array for the user if it doesn't exist
                if (!selectedChains[id]) {
                    selectedChains[id] = [];
                }

                // Toggle selection for the option
                if (selectedChains[id].includes(surfix)) {
                    // Option is already selected, remove it
                    selectedChains[id] = selectedChains[id].filter(
                        selectedOption => selectedOption !== surfix,
                    );
                } else {
                    // Option is not selected, add it
                    selectedChains[id].push(surfix);
                }

                const inlineKeyboard = chains.map(chain => {
                    return [
                        {
                            text: `${selectedChains[id].includes(`${chain.symbol}`) ? ' ✓' : ''} ${chain.name}`,
                            callback_data: `${settingPrefix}_${chain.symbol}`,
                        },
                    ];
                });
                inlineKeyboard.push([
                    {
                        text: 'Save Updates',
                        callback_data: `${settingPrefix}_save`,
                    },
                ]);

                // Update inline keyboard to reflect selected options
                bot.editMessageReplyMarkup(
                    {
                        inline_keyboard: inlineKeyboard,
                    },
                    {
                        chat_id: query.message.chat.id,
                        message_id: query.message.message_id,
                    },
                );
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
        }
    });
}

async function handleHelp(bot, chatId, chatType) {
    if (chatType === 'group' || chatType === 'supergroup') {
        bot.sendMessage(
            chatId,
            'This command is only available in a private message with the bot.',
        );
    } else if (chatType === 'private') {
        const helpMessage = `
🔹 Available Commands 🔹
/scan - Used to start tracking any wallet. Use /scan {Wallet Address}
/mywallets - Shows all the wallets that you have scanned and saved as your personal wallet
/stalkedwallets - Shows other wallets that don't belong to you that I've helped you scanned
/managewallets - Used to add, delete and rename wallets (including stalked wallets)
/myportfolio - Shows all the tokens in EVERY wallet that belongs to you and their value in USD
/settings - To manage portfolio details such as chains to ignore when you scan and the minimum amount of tokens in USD to display in your portfolio
/gas - To show current gas fee on ethereum network
/stats - Shows total number of bot users, number of groups where bot has been added, number of scanned addresses in the last 24 hours etc. (Only bot owner can use this)
/xtrack - Starts X/Twitter tracking
    `;
        bot.sendMessage(chatId, helpMessage);
        addLog(chatId, 'help', '', chatType);
    }
}

async function handleStart(bot, chatId, userId, chatType) {
    if (chatType !== 'private') {
        bot.sendMessage(
            chatId,
            'This command can only be used in a private message with the bot.',
        );
        return;
    }
    const startMessage = `
This is your comprehensive Multi-Chain and Multi-Wallet Portfolio Tracker. Your token won't go to dust anymore because you forgot which wallet or on which chain you bought the token. You can keep tabs of your token value on multiple wallets and on multiple blockchains.

This bot was made by @TrackerAI_ERC Team.
https://trackerai.bot

Command List

/scan - Used to start tracking any wallet. Use /scan {Wallet Address}
/mywallets - Shows all the wallets that you have scanned and saved as your personal wallet
/stalkedwallets - Shows other wallets that don't belong to you that I've helped you scanned
/managewallets - Used to add, delete and rename wallets (including stalked wallets)
/myportfolio - Shows all the tokens in EVERY wallet that belongs to you and their value in USD
/settings - To manage portfolio details such as chains to ignore when you scan and the minimum amount of tokens in USD to display in your portfolio
/gas - To show current gas fee on ethereum network
/stats - Shows total number of bot users, number of groups where bot has been added, number of scanned addresses in the last 24 hours etc. (Only bot owner can use this)
/pnlall - To start tracking the profit or loss of any token inside any tracked wallet.
/xtrack - Starts X/Twitter tracking
    `;
    bot.sendMessage(chatId, startMessage);
    addLog(userId, 'start', '', chatType);
}

async function handleReferralLink(bot, chatId, username, chatType) {
    if (chatType !== 'private') {
        bot.sendMessage(
            chatId,
            'Use the bot in private to get your referral link.',
        );
    } else {
        bot.sendMessage(
            chatId,
            `You referral link is <code>https://t.me/${BOT_USERNAME}?start=${username}</code>`,
            {
                parse_mode: 'HTML',
            },
        );
        addLog(chatId, 'myPortfolio', '', chatType);
    }
}

async function handleReferralLeaderboard(bot, chatId) {
    const referrals = await getReferralLeaderboard();
    let message = '';
    if (referrals.data.Referrals.length > 0) {
        message +=
            '🏅 <b>Referral Leaderboard</b> 🏅\n\n<b>Rank</b>      <b>Username</b>      <b>Referral count</b>\n';
        /* eslint-disable no-restricted-syntax */
        for (const [index, referral] of referrals.data.Referrals.entries()) {
            const numberOfbreaks = 20 - (referral.Username || '').length;
            const breaks = '\b'.repeat(numberOfbreaks * 2);
            message += ` ${index + 1}.       @${referral.Username}${breaks}${formatNumber(referral.ReferralAmount)}\n`;
        }
        /* eslint-enable no-restricted-syntax */
    } else {
        message += 'There are no referred accounts.';
    }
    bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
    });
    addLog(chatId, 'referralLeaderboard', '', '');
}

async function handleReferralCount(bot, chatId, username, chatType) {
    if (chatType !== 'private') {
        bot.sendMessage(
            chatId,
            'This command can only be used in a private message with the bot.',
        );
    } else {
        const res = await getReferralCountByUsername(username);
        let message = '';
        if (res.data.referralCount) {
            message += `🫂 Number of users referred: ${formatNumber(res.data.referralCount)}\n🥇 Your ranking on the overall leaderboard: ${res.data.rank} `;
        } else {
            message += 'You do not have referred any accounts';
        }
        bot.sendMessage(chatId, message, {
            parse_mode: 'HTML',
        });
        addLog(chatId, 'referralCount', '', '');
    }
}

const handleSettingPrompt = bot => {
    bot.on('message', async message => {
        const chatId = message.chat.id;
        const value = message.text;
        const chatType = message.chat.type;

        if (!value) return;
        const currentPrompt = store.getCurrentPrompt();

        if (
            !(
                currentPrompt.prompt === 'updateMinimumAmountPrompt' ||
                currentPrompt.prompt === 'userActivityLeaderboardPrompt' ||
                currentPrompt.prompt === 'groupActivityLeaderboardPrompt'
            )
        ) {
            return;
        }

        if (currentPrompt.prompt === 'updateMinimumAmountPrompt') {
            await updateMinimumAmount(chatId, value);
            bot.sendMessage(chatId, 'Successfully saved!');
            addLog(chatId, 'updateMinimumAmount', '', chatType);
            store.clearCurrentPrompt();
            return;
        }

        if (!checkDate(value)) {
            bot.sendMessage(
                chatId,
                'Invalid Date Format. Please enter the date again. To end these prompts, type /end.',
            );
            return;
        }

        if (currentPrompt.prompt === 'userActivityLeaderboardPrompt') {
            handleUserActivityLeaderboard(bot, chatId, '', value);
            store.clearCurrentPrompt();
        }

        if (currentPrompt.prompt === 'groupActivityLeaderboardPrompt') {
            handleGroupActivityLeaderboard(bot, chatId, '', value);
            store.clearCurrentPrompt();
        }
    });
};

module.exports = {
    handleSetting,
    handleSettingCallbacks,
    handleHelp,
    handleStart,
    handleReferralLink,
    handleReferralLeaderboard,
    handleUserActivityLeaderboard,
    handleGroupActivityLeaderboard,
    handleReferralCount,
    handleSettingPrompt,
};
