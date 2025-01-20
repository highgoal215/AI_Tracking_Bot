const {
    getMyWalletsByUserId,
    getMyStalkedWalletsByUserId,
    getWalletById,
    updateWalletUsername,
    removeWallet,
    checkIfAdmin,
    addGroup,
    deleteGroup,
    getStats,
    addWallet,
    checkIfAddableToMine,
    checkIfStalkable,
    checkIfPremium,
    getAccountByUserId,
    updateGroupPremium,
    addLog,
} = require('../api.js');
const { BOT_USERNAME } = require('../config.js');
const store = require('../store.js');
const {
    formatAddress,
    verifyAddress,
    getTotalBalance,
    startWalletMonitoring,
    checkIfGroupAdmin,
    formatNumber,
    stopWalletMonitoring,
} = require('../utils.js');

const manageWalletsPrefix = 'manage_wallets';
const scanWalletPrefix = 'scan';

const walletsInProcessing = {};
let groupPremiumUser = '';

const getMyWallets = async (bot, userId, chatId, chatType) => {
    if (chatType !== 'private') {
        bot.sendMessage(
            chatId,
            'This command can only be used in a private message with the bot.',
        );
        return;
    }
    let message = '';

    const wallets = await getMyWalletsByUserId(userId);

    const inlineKeyboard = [];
    if (!wallets.wallets.length) {
        message = 'You do not have any saved wallets';
    } else {
        message = '\n <b>Your wallets</b> \n\n';
        /* eslint-disable no-await-in-loop */
        /* eslint-disable no-restricted-syntax */
        for (const wallet of wallets.wallets) {
            const totalBalance = await getTotalBalance(
                chatType === 'group' || chatType === 'supergroup'
                    ? chatId
                    : userId,
                wallet.Wallet,
            );
            message += `💳 ${wallet.Username ? `${wallet.Username} - ` : ''}<code>${wallet.Wallet}</code> - $${totalBalance} \n`;
            inlineKeyboard.push([
                {
                    text: `Scan ${wallet.Username ? `${wallet.Username}` : formatAddress(wallet.Wallet)}`,
                    callback_data: `${scanWalletPrefix}_${wallet.Wallet}`,
                },
            ]);
        }
        /* eslint-enable no-restricted-syntax */
        /* eslint-enable no-await-in-loop */
    }
    await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: inlineKeyboard,
        },
    });
    addLog(userId, 'getMyWallets', '', chatType);
};

const getStalkedWallets = async (bot, userId, chatId, chatType) => {
    let wallets;
    if (chatType === 'private') {
        wallets = await getMyStalkedWalletsByUserId(userId);
    } else {
        wallets = await getMyStalkedWalletsByUserId(chatId);
    }
    let message = '';
    const inlineKeyboard = [];
    if (!wallets.wallets.length) {
        message = 'You do not have stalked wallets';
    } else {
        if (chatType === 'private') {
            message = '\n <b>Your stalked wallets</b> \n\n';
        } else {
            message = '\n <b>Group stalked wallets</b> \n\n';
        }
        /* eslint-disable no-await-in-loop */
        /* eslint-disable no-restricted-syntax */
        for (const wallet of wallets.wallets) {
            let totalBalance;
            if (chatType === 'private')
                totalBalance = await getTotalBalance(userId, wallet.Wallet);
            else totalBalance = await getTotalBalance(chatId, wallet.Wallet);
            message += `💳 ${wallet.Username ? `${wallet.Username} - ` : ''}<code>${wallet.Wallet}</code> - $${totalBalance} \n`;
            inlineKeyboard.push([
                {
                    text: `Scan ${wallet.Username ? `${wallet.Username}` : formatAddress(wallet.Wallet)}`,
                    callback_data: `${scanWalletPrefix}_${wallet.Wallet}`,
                },
            ]);
        }
        /* eslint-enable no-restricted-syntax */
        /* eslint-enable no-await-in-loop */
    }
    await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: inlineKeyboard,
        },
    });
    addLog(userId, 'getStalkedWallets', '', chatType);
};

const manageWallets = async (bot, chatId, chatType) => {
    if (chatType !== 'private') {
        const stalkedWallets = await getMyStalkedWalletsByUserId(chatId);
        const stalkeButtons = stalkedWallets.wallets.map(wallet => {
            return [
                {
                    text: `${wallet.Username ? `${wallet.Username} => ` : ''}  ${formatAddress(wallet.Wallet)}`,
                    callback_data: `${manageWalletsPrefix}_${wallet.Id}`,
                },
            ];
        });
        stalkeButtons.push([
            {
                text: 'ADD NEW WALLET',
                callback_data: `${manageWalletsPrefix}_stalkedNew`,
            },
        ]);
        bot.sendMessage(chatId, 'SELECT WALLET', {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: stalkeButtons,
            },
        });
        addLog(chatId, 'getMyWallets', '', chatType);
        return;
    }
    const buttons = [
        {
            text: 'PERSONAL WALLETS',
            callback_data: `${manageWalletsPrefix}_personal`,
        },
        {
            text: 'STALKED WALLETS',
            callback_data: `${manageWalletsPrefix}_stalked`,
        },
    ];
    await bot.sendMessage(
        chatId,
        'Manage your Personal Wallets or Stalked Wallets',
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [buttons],
            },
        },
    );
    addLog(chatId, 'getMyWallets', '', chatType);
};

const handleManageCallbacks = (bot, updateManagingStatus) => {
    bot.on('callback_query', async query => {
        const { message, data, from } = query;
        try {
            if (data.includes(manageWalletsPrefix)) {
                const result = data.replace(`${manageWalletsPrefix}_`, '');
                switch (result) {
                    case 'personal': {
                        const wallets = await getMyWalletsByUserId(
                            message.chat.id,
                        );
                        const buttons = wallets.wallets.map(wallet => {
                            return [
                                {
                                    text: `${wallet.Username ? `${wallet.Username}=>` : ''}     ${formatAddress(wallet.Wallet)}`,
                                    callback_data: `${manageWalletsPrefix}_${wallet.Id}`,
                                },
                            ];
                        });
                        buttons.push([
                            {
                                text: 'ADD NEW WALLET',
                                callback_data: `${manageWalletsPrefix}_personalNew`,
                            },
                        ]);
                        bot.sendMessage(message.chat.id, 'SELECT WALLET', {
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: buttons,
                            },
                        });
                        break;
                    }
                    case 'stalked': {
                        const stalkedWallets =
                            await getMyStalkedWalletsByUserId(message.chat.id);
                        const stalkeButtons = stalkedWallets.wallets.map(
                            wallet => {
                                return [
                                    {
                                        text: `${wallet.Username ? `${wallet.Username} => ` : ''}  ${formatAddress(wallet.Wallet)}`,
                                        callback_data: `${manageWalletsPrefix}_${wallet.Id}`,
                                    },
                                ];
                            },
                        );
                        stalkeButtons.push([
                            {
                                text: 'ADD NEW WALLET',
                                callback_data: `${manageWalletsPrefix}_stalkedNew`,
                            },
                        ]);
                        bot.sendMessage(message.chat.id, 'SELECT WALLET', {
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: stalkeButtons,
                            },
                        });
                        break;
                    }
                    case 'rename': {
                        const wallet = await getWalletById(
                            walletsInProcessing[message.chat.id].Id,
                        );
                        if (!wallet.data.Wallet.Personal) {
                            const premiumIf = await checkIfPremium(from.id);
                            if (!premiumIf.data.premiumIf?.premium) {
                                if (premiumIf.data.premiumIf?.tokenExpired) {
                                    bot.sendMessage(
                                        message.chat.id,
                                        'It appears that your wallet no longer meets the required holding threshold for premium membership 😭. You have lost your premium status. We hope to welcome you back soon as a premium member. 🤗',
                                    );
                                } else if (
                                    premiumIf.data.premiumIf?.premiumExpired
                                ) {
                                    bot.sendMessage(
                                        message.chat.id,
                                        'Your premium membership has expired. To regain access, please use the /premium command.',
                                    );
                                }
                                bot.sendMessage(
                                    message.chat.id,
                                    `Only premium users can name stalked wallets. To subscribe, use the /premium command`,
                                );
                                break;
                            }
                        }

                        store.setCurrentPrompt('renameWalletPrompt', {
                            address: wallet.data.Wallet.Wallet,
                        });

                        await bot.sendMessage(
                            message.chat.id,
                            'Please enter wallet name',
                        );
                        break;
                    }
                    case 'personalNew': {
                        const checkAddable = await checkIfAddableToMine(
                            from.id,
                        );
                        if (!checkAddable.data.addable) {
                            if (checkAddable.data.premium?.tokenExpired) {
                                bot.sendMessage(
                                    message.chat.id,
                                    'It appears that your wallet no longer meets the required holding threshold for premium membership 😭. You have lost your premium status. We hope to welcome you back soon as a premium member. 🤗',
                                );
                            } else if (
                                checkAddable.data.premium?.premiumExpired
                            ) {
                                bot.sendMessage(
                                    message.chat.id,
                                    'Your premium membership has expired. To regain access, please use the /premium command.',
                                );
                            }

                            bot.sendMessage(
                                message.chat.id,
                                'You have reached the maximum number of personal wallets you can add.',
                                {
                                    parse_mode: 'HTML',
                                },
                            );
                            break;
                        }

                        await bot.sendMessage(
                            message.chat.id,
                            'Please enter new wallet address',
                        );

                        updateManagingStatus(message.chat.id, true);

                        store.setCurrentPrompt('personalNewWalletPrompt', {
                            address: '',
                        });
                        break;
                    }
                    case 'stalkedNew': {
                        const stalkable = await checkIfStalkable(from.id);
                        if (!stalkable.data.stalkable) {
                            if (stalkable.data.premium?.tokenExpired) {
                                bot.sendMessage(
                                    message.chat.id,
                                    'It appears that your wallet no longer meets the required holding threshold for premium membership 😭. You have lost your premium status. We hope to welcome you back soon as a premium member. 🤗',
                                );
                            } else if (stalkable.data.premium?.premiumExpired) {
                                bot.sendMessage(
                                    message.chat.id,
                                    'Your premium membership has expired. To regain access, please use the /premium command.',
                                );
                            }

                            bot.sendMessage(
                                message.chat.id,
                                `You have reached the maximum number of stalked wallet you can add.`,
                            );
                            break;
                        }

                        await bot.sendMessage(
                            message.chat.id,
                            'Please enter new wallet address',
                        );

                        updateManagingStatus(message.chat.id, true);

                        store.setCurrentPrompt('stalkedNewWalletPrompt', {
                            address: '',
                        });
                        break;
                    }
                    case 'delete':
                        if (walletsInProcessing[message.chat.id]) {
                            await removeWallet(
                                walletsInProcessing[message.chat.id].Id,
                            );
                            stopWalletMonitoring(
                                message.chat.id,
                                walletsInProcessing[message.chat.id].Wallet,
                            );
                            bot.sendMessage(
                                message.chat.id,
                                'Wallet successfully deleted.',
                            );
                            addLog(
                                message.chat.id,
                                'removeWallet',
                                walletsInProcessing[message.chat.id].Wallet,
                                '',
                            );
                        }
                        break;

                    case 'group_premium': {
                        const premium = await checkIfPremium(groupPremiumUser);
                        if (!premium.data.premiumIf) {
                            bot.sendMessage(
                                message.chat.id,
                                'You are not a premium user',
                            );
                            groupPremiumUser = '';
                            break;
                        }
                        const account =
                            await getAccountByUserId(groupPremiumUser);
                        const result = await updateGroupPremium(
                            message.chat.id,
                            groupPremiumUser,
                            account.data.Account.PremiumDate,
                        );

                        if (result.res === 'Success') {
                            bot.sendMessage(
                                message.chat.id,
                                `Congratulations! Your group now has premium access. You will lose premium access if the group admin also loses premium access.`,
                            );
                            addLog(
                                message.chat.id,
                                'premiumGroup',
                                '',
                                'group',
                            );
                        } else {
                            bot.sendMessage(
                                message.chat.id,
                                'Request failed, please try again later.',
                            );
                        }
                        groupPremiumUser = '';

                        break;
                    }
                    case 'group_premium_no': {
                        bot.sendMessage(
                            message.chat.id,
                            'You can’t get premium access in this group unless one of the group admins are premium members. You can ask an admin who is a premium user of our bot to use the /premiumgroup command for premium access.',
                        );
                        break;
                    }
                    default: {
                        const wallet = await getWalletById(result);
                        if (wallet) {
                            walletsInProcessing[message.chat.id] =
                                wallet.data.Wallet;
                        }

                        const buttonsManage = [
                            {
                                text: 'RENAME WALLET',
                                callback_data: `${manageWalletsPrefix}_rename`,
                            },
                            {
                                text: 'DELETE WALLET',
                                callback_data: `${manageWalletsPrefix}_delete`,
                            },
                        ];

                        bot.sendMessage(
                            message.chat.id,
                            `<b>MANAGE WALLET</b>\n${wallet?.data?.Wallet?.Wallet}`,
                            {
                                parse_mode: 'HTML',
                                reply_markup: {
                                    inline_keyboard: [buttonsManage],
                                },
                            },
                        );
                    }
                }
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
        }
    });
};

async function handleStats(bot, chatId, userId, chatType) {
    if (chatType !== 'private') {
        const adminIf = await checkIfAdmin(userId);
        if (!adminIf.data.adminIf) {
            bot.sendMessage(chatId, 'Only bot owner can use this command');
        } else {
            const stats = await getStats();
            const message = `
            👤 Number of users: ${formatNumber(stats.data.users)}
🤴 Number of premium users: ${formatNumber(stats.data.premiumUser)}
👥 Number of groups added: ${formatNumber(stats.data.groups)}
💼 Number of addresses scanned in the last 24 hours: ${formatNumber(stats.data.scans)}
💼 Number of addresses scanned in the last 7 days: ${formatNumber(stats.data.scans_7d)}
🥽 Number of activities in the last 24 hours: ${formatNumber(stats.data.activities)}
🥽 Number of activities in the last 7 days: ${formatNumber(stats.data.activities_7d)}
            `;
            bot.sendMessage(chatId, message, {
                parse_mode: 'HTML',
            });
            addLog(userId, 'stats', '', chatType);
        }
    }
}

async function handleGroups(msg) {
    if (
        msg?.left_chat_participant &&
        msg?.left_chat_participant?.is_bot &&
        msg?.left_chat_participant?.username === BOT_USERNAME
    ) {
        deleteGroup(msg.chat.id);
    }
    if (
        msg?.new_chat_participant &&
        msg?.new_chat_participant?.is_bot &&
        msg?.new_chat_participant?.username === BOT_USERNAME
    ) {
        addGroup(msg.chat.id, msg.chat.title, msg.chat.type);
    }
}

async function handlePremiumGroup(bot, chatId, userId, chatType) {
    if (chatType === 'private') {
        bot.sendMessage(
            chatId,
            'This command can only be used in a group chat with the bot.',
            {
                parse_mode: 'HTML',
            },
        );
        return;
    }

    if ((await checkIfGroupAdmin(bot, chatId, userId)) === false) {
        bot.sendMessage(
            chatId,
            'This command can only be used by a group admin in a group chat with the bot.',
        );
        return;
    }
    groupPremiumUser = userId;
    const buttons = [
        { text: 'Yes', callback_data: `${manageWalletsPrefix}_group_premium` },
        {
            text: 'No',
            callback_data: `${manageWalletsPrefix}_group_premium_no`,
        },
    ];
    bot.sendMessage(
        chatId,
        'In order to have premium access in this group, one of the group admins must be a premium member?\nAre you a premium member?',
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [buttons],
            },
        },
    );
    // checkIfGroupAdmin(bot, chatId, userId)
}

const handleManagePrompt = (bot, updateManagingStatus) => {
    bot.on('message', async message => {
        const userId = message.from.id;
        const chatId = message.chat.id;
        const value = message.text;
        const chatType = message.chat.type;

        if (!value) return;
        const currentPrompt = store.getCurrentPrompt();

        if (
            !(
                currentPrompt.prompt === 'renameWalletPrompt' ||
                currentPrompt.prompt === 'personalNewWalletPrompt' ||
                currentPrompt.prompt === 'stalkedNewWalletPrompt'
            ) ||
            !currentPrompt.data
        )
            return;

        const address = currentPrompt.data?.address || '';

        if (currentPrompt.prompt === 'renameWalletPrompt') {
            // save name in DB if you want to ...
            if (walletsInProcessing[userId]) {
                updateWalletUsername({
                    id: walletsInProcessing[userId].Id,
                    username: value,
                });
                bot.sendMessage(chatId, 'Wallet Name saved');
                addLog(chatId, 'renameWallet', address, chatType);
                store.clearCurrentPrompt();
            } else {
                bot.sendMessage(
                    chatId,
                    'Error Occured. To end these prompts, type /end.',
                );
            }
        } else if (currentPrompt.prompt === 'personalNewWalletPrompt') {
            try {
                const isVerified = await verifyAddress(value);
                if (!isVerified) {
                    bot.sendMessage(
                        chatId,
                        'Invalid Address Input. To end these prompts, type /end.',
                    );
                } else {
                    const res = await addWallet({
                        accountId: userId,
                        wallet: value,
                        personal: true,
                    });
                    if (res.status === 'create') {
                        startWalletMonitoring(bot, userId, chatId, value);
                    }
                    bot.sendMessage(chatId, 'Successfully Added A New Address');
                    updateManagingStatus(userId, false);
                    addLog(userId, 'addPersonalWallet', value, chatType);
                    store.clearCurrentPrompt();
                }
            } catch (err) {
                bot.sendMessage(
                    chatId,
                    'Error Occurred. To end these prompts, type /end.',
                );
                updateManagingStatus(userId, false);
            }
        } else if (currentPrompt.prompt === 'stalkedNewWalletPrompt') {
            try {
                const isVerified = await verifyAddress(value);
                if (!isVerified) {
                    bot.sendMessage(
                        chatId,
                        'Invalid Address Input. To end these prompts, type /end.',
                    );
                } else {
                    const res = await addWallet({
                        accountId: userId,
                        wallet: value,
                        personal: false,
                    });
                    if (res.status === 'create') {
                        startWalletMonitoring(bot, userId, chatId, value);
                    }
                    bot.sendMessage(chatId, 'Successfully Added A New Address');
                    updateManagingStatus(userId, false);
                    addLog(userId, 'addStalkedWallet', value, chatType);
                    store.clearCurrentPrompt();
                }
            } catch (err) {
                bot.sendMessage(
                    chatId,
                    'Error Occurred. To end these prompts, type /end.',
                );
                updateManagingStatus(userId, false);
            }
        }
    });
};

module.exports = {
    getMyWallets,
    getStalkedWallets,
    manageWallets,
    handleManageCallbacks,
    handleStats,
    handleGroups,
    handlePremiumGroup,
    handleManagePrompt,
};
