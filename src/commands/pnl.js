const {
    addLog,
    getMyWalletsByUserId,
    getAccountByUserId,
    checkIfScanable,
    getAds,
    getBlockedTokensByUserId,
    getMyStalkedWalletsByUserId,
    checkIfPremium,
    // getWalletById,
} = require('../api.js');
const store = require('../store.js');
const {
    fetchToken,
    formatCost,
    formatAddress,
    verifyAddress,
    verifySolanaAddress,
    getPreviousPrice,
    calculateRate,
    analyzeRate,
    getTotalBalance,
    calculateProfit,
} = require('../utils.js');

const defaultChains = ['eth', 'bsc', 'arb', 'base'];
const scanProfitPrefix = 'scanprofit';

let total = 0;
let previousTotal = 0;
let chunks = [];
let index = 0;
let totalNum = 0;

const checkDate = date => {
    const datelist = date.split('-');
    const today = new Date();
    if (
        today.getFullYear() < datelist[0] &&
        today.getMonth() < datelist[1] &&
        today.getDay() < datelist[2] &&
        today.getHours() < datelist[3]
    ) {
        return false;
    }
    if (datelist[1] <= '12' && datelist[2] <= '31') {
        if (!datelist[3]) return true;
        if (datelist[3] < '24') return true;
        return false;
    }
    return false;
};

const runAnalyze = async (
    bot,
    chatId,
    address,
    userId,
    creationDate,
    chatType = 'private',
    messageId = '',
) => {
    try {
        const isGroup = chatType === 'group' || chatType === 'supergroup';
        const id = isGroup ? chatId : userId;

        const scanable = await checkIfScanable(userId);

        if (!scanable.data.scanable) {
            bot.sendMessage(
                chatId,
                `As a basic user, you’ve reached the maximum number of scans per day. To track more wallets, kindly wait till tomorrow or subscribe for /premium.`,
            );
            return;
        }
        const isSol = !verifyAddress(address) && verifySolanaAddress(address);
        const tokens = await fetchToken(address);
        const account = await getAccountByUserId(id);
        const minimumAmount = account.data.Account.MinimumAmount || 0;
        const date = new Date(creationDate);

        let chains;

        if (
            account.data.Account.Chains &&
            JSON.parse(account.data.Account.Chains).length > 0
        ) {
            chains = JSON.parse(account.data.Account.Chains);
        } else {
            chains = defaultChains;
        }
        if (chains.length === 0) {
            bot.sendMessage(chatId, 'Please enable chains by using /settings');
            return;
        }
        if (isSol && !chains.includes('sol')) {
            bot.sendMessage(
                chatId,
                'Kindly go to settings using the /settings command and add solana chain in order to track solana wallets',
            );
            return;
        }

        bot.sendMessage(chatId, 'Processing command...⏳👀').then(
            async loadingMsg => {
                const blocked = await getBlockedTokensByUserId(id);
                const unwantedTokens =
                    blocked.data.BlockedTokens?.map(e => e.Token) || [];
                const filteredTokens = tokens.data.filter(
                    token => !unwantedTokens.includes(token.id),
                );
                let currChunk = 0;
                let indexNum = 0;

                const previousPrice = await getPreviousPrice(
                    chains,
                    date.toLocaleDateString('en-CA'),
                    filteredTokens,
                );

                const analyzeTokens = [];

                chunks[currChunk] +=
                    `\n<a href="https://${isSol ? 'solscan' : 'etherscan'}.io/address/${address}">${formatAddress(address)}</a>\n\n`;

                chains.forEach(chain => {
                    if (!chunks[currChunk]) chunks[currChunk] = '';
                    if (chunks[currChunk].length > 2000) {
                        currChunk += 1;
                        chunks[currChunk] = '';
                    }

                    const tokensChain = filteredTokens.filter(
                        token => token.chain === chain,
                    );

                    tokensChain.forEach(token => {
                        indexNum += 1;
                        if (token.amount * token.price >= minimumAmount) {
                            total += token.amount * token.price;
                            previousTotal +=
                                token.amount *
                                previousPrice[indexNum - 1].price;
                            const rate = calculateRate(
                                token.price,
                                previousPrice[indexNum - 1].price,
                            );
                            if (chunks[currChunk].length > 2000) {
                                currChunk += 1;
                                chunks[currChunk] = '';
                            }
                            chunks[currChunk] +=
                                `💸 ${token.name} : $${formatCost(token.amount * token.price)} - ( ${rate} )\n`;
                            analyzeTokens.push({
                                token: token.name,
                                amount: `$${formatCost(token.amount * token.price)}`,
                                rate: analyzeRate(rate),
                            });
                        }
                    });
                });

                const Ad = await getAds();
                let adData = '';
                if (Ad.data.Ad) {
                    adData = `\n<i>Ads:</i> <a href="${Ad.data.Ad.Url}">${Ad.data.Ad.Text}</a>`;
                }

                analyzeTokens.sort((a, b) => a.rate - b.rate);
                const best = analyzeTokens[analyzeTokens.length - 1];
                const worst = analyzeTokens[0];

                chunks[chunks.length - 1] +=
                    `\n<b>Best performer: </b>${best.token} ( ${best.rate > 0 ? `+${best.rate}` : best.rate} % )\n<b>Worst performer: </b>${worst.token} ( ${worst.rate > 0 ? `+${worst.rate}` : worst.rate} % )\n\n`;

                bot.deleteMessage(
                    loadingMsg.chat.id,
                    loadingMsg.message_id,
                ).then(async () => {
                    const buttons = [
                        [
                            {
                                text: '24H',
                                callback_data: `${scanProfitPrefix}_day_${address}`,
                            },
                            {
                                text: '7D',
                                callback_data: `${scanProfitPrefix}_week_${address}`,
                            },
                            {
                                text: '30D',
                                callback_data: `${scanProfitPrefix}_month_${address}`,
                            },
                            {
                                text: 'Custom',
                                callback_data: `${scanProfitPrefix}_custom_${address}`,
                            },
                        ],
                    ];
                    index += 1;
                    if (index === totalNum) {
                        const lengthOfChunks = chunks.length;
                        // eslint-disable-next-line no-restricted-syntax
                        for (
                            let index = 0;
                            index < lengthOfChunks;
                            index += 1
                        ) {
                            const chunk = chunks[index];
                            if (index === 0) {
                                if (index === chunks.length - 1) {
                                    if (messageId) {
                                        // eslint-disable-next-line no-await-in-loop
                                        await bot.editMessageText(
                                            `💰 <b>Total Value</b> : <b>$${formatCost(total)} 💰\n💰 <b>Profit</b>: ${calculateProfit(total, previousTotal)} ( ${calculateRate(total, previousTotal)} ) 💰 ( ${creationDate} ~ )\n${chunk}</b>${adData}`,
                                            {
                                                chat_id: chatId,
                                                message_id: messageId,
                                                parse_mode: 'HTML',
                                                disable_web_page_preview: true,
                                                reply_markup: {
                                                    inline_keyboard: buttons,
                                                },
                                            },
                                        );
                                    } else {
                                        // eslint-disable-next-line no-await-in-loop
                                        await bot.sendMessage(
                                            chatId,
                                            `💰 <b>Total Value</b> : <b>$${formatCost(total)} 💰\n💰 <b>Profit</b>: ${calculateProfit(total, previousTotal)} ( ${calculateRate(total, previousTotal)} ) 💰 ( ${creationDate} ~ )\n${chunk}</b>${adData}`,
                                            {
                                                parse_mode: 'HTML',
                                                disable_web_page_preview: true,
                                                reply_markup: {
                                                    inline_keyboard: buttons,
                                                },
                                            },
                                        );
                                    }
                                } else if (messageId) {
                                    // eslint-disable-next-line no-await-in-loop
                                    await bot.editMessageText(
                                        `💰 <b>Total Value</b> : <b>$${formatCost(total)} 💰\n💰 <b>Profit</b>: ${calculateProfit(total, previousTotal)} ( ${calculateRate(total, previousTotal)} ) 💰 ( ${creationDate} ~ )\n${chunk}</b>${adData}`,
                                        {
                                            chat_id: chatId,
                                            message_id: messageId,
                                            parse_mode: 'HTML',
                                            disable_web_page_preview: true,
                                        },
                                    );
                                } else {
                                    // eslint-disable-next-line no-await-in-loop
                                    await bot.sendMessage(
                                        chatId,
                                        `💰 <b>Total Value</b> : <b>$${formatCost(total)} 💰\n💰 <b>Profit</b>: ${calculateProfit(total, previousTotal)} ( ${calculateRate(total, previousTotal)} ) 💰 ( ${creationDate} ~ )\n${chunk}</b>${adData}`,
                                        {
                                            parse_mode: 'HTML',
                                            disable_web_page_preview: true,
                                        },
                                    );
                                }
                            } else if (index === chunks.length - 1) {
                                if (messageId) {
                                    // eslint-disable-next-line no-await-in-loop
                                    await bot.editMessageText(
                                        `<b>${chunk}</b>`,
                                        {
                                            chat_id: chatId,
                                            message_id: messageId,
                                            parse_mode: 'HTML',
                                            disable_web_page_preview: true,
                                            reply_markup: {
                                                inline_keyboard: buttons,
                                            },
                                        },
                                    );
                                } else {
                                    // eslint-disable-next-line no-await-in-loop
                                    await bot.sendMessage(
                                        chatId,
                                        `<b>${chunk}</b>`,
                                        {
                                            parse_mode: 'HTML',
                                            disable_web_page_preview: true,
                                            reply_markup: {
                                                inline_keyboard: buttons,
                                            },
                                        },
                                    );
                                }
                            } else if (messageId) {
                                // eslint-disable-next-line no-await-in-loop
                                await bot.editMessageText(`<b>${chunk}</b>`, {
                                    chat_id: chatId,
                                    message_id: messageId,
                                    parse_mode: 'HTML',
                                    disable_web_page_preview: true,
                                });
                            } else {
                                // eslint-disable-next-line no-await-in-loop
                                await bot.sendMessage(
                                    chatId,
                                    `<b>${chunk}</b>`,
                                    {
                                        parse_mode: 'HTML',
                                        disable_web_page_preview: true,
                                    },
                                );
                            }
                        }
                        if (chunks.length > 1) {
                            bot.sendMessage(
                                chatId,
                                `Consider utilizing the /settings command to exclude tokens worth less than $10, filtering out insignificant tokens.`,
                                {
                                    parse_mode: 'HTML',
                                },
                            );
                        }
                        total = 0;
                        previousTotal = 0;
                        chunks = [];
                        index = 0;
                        totalNum = 0;
                    }
                    addLog(id, 'pnl', address, chatType);
                });
            },
        );
    } catch (err) {
        // eslint-disable-next-line no-console
        console.log(err);
    }
};

async function handleProfitAndLossAll(bot, chatId, userId, chatType) {
    try {
        const { premiumIf } = (await checkIfPremium(userId)).data;
        if (!premiumIf.premium) {
            bot.sendMessage(
                chatId,
                'Only premium members can now use this feature, kindly use /premium command to subscribe.',
            );
            return;
        }

        if (chatType === 'group' || chatType === 'supergroup') {
            const wallets = await getMyStalkedWalletsByUserId(chatId);

            if (!wallets.wallets.length) {
                bot.sendMessage(
                    chatId,
                    'Your Group does not have stalked wallets',
                    {
                        parse_mode: 'HTML',
                        disable_web_page_preview: true,
                    },
                );
            }
            total = 0;
            chunks[0] = '';
            previousTotal = 0;
            index = 0;

            totalNum = wallets.wallets.length;

            const requestUsernameOptions = {
                reply_markup: {
                    parse_mode: 'HTML',
                },
            };

            await bot.sendMessage(
                chatId,
                'Please enter the date you want to analyze from.\nThe date format is YYYY-MM-DD-HH.',
                requestUsernameOptions,
            );

            store.setCurrentPrompt('pnlAllPrompt', { wallets });
        }
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
    }
}

async function handleProfitAndLoss(bot, chatId, userId, chatType, address) {
    try {
        const { premiumIf } = (await checkIfPremium(userId)).data;
        if (!premiumIf.premium) {
            bot.sendMessage(
                chatId,
                'Only premium members can now use this feature, kindly use /premium command to subscribe.',
            );
            return;
        }

        if (verifyAddress(address)) {
            total = 0;
            chunks[0] = '';
            previousTotal = 0;
            index = 0;
            totalNum = 1;

            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 1);

            runAnalyze(
                bot,
                chatId,
                address,
                userId,
                startDate.toLocaleDateString('en-CA'),
                chatType,
            );
            return;
        }

        if (chatType === 'private') {
            const buttons = [
                { text: 'Personal Wallet', callback_data: `analyze_personal` },
                { text: 'Stalked Wallet', callback_data: `analyze_stalked` },
            ];
            bot.sendMessage(
                chatId,
                'Select the wallet type you want to analyze 📈📉',
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [buttons],
                    },
                },
            );
        } else {
            const wallets = await getMyStalkedWalletsByUserId(chatId);

            let message = '';
            const inlineKeyboard = [];
            if (!wallets.wallets.length) {
                message = 'We do not have any saved wallets';
            } else {
                message = '\n <b>Group Stalked Wallets</b> \n\n';
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
                            text: `Analyze ${wallet.Username ? `${wallet.Username}` : formatAddress(wallet.Wallet)}`,
                            callback_data: `${scanProfitPrefix}_${wallet.Wallet}`,
                        },
                    ]);
                }
                /* eslint-enable no-restricted-syntax */
                /* eslint-enable no-await-in-loop */
            }
            bot.sendMessage(chatId, message, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: inlineKeyboard,
                },
            });
        }
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
    }
}

const handleProfitAndLossCallbacks = bot => {
    bot.on('callback_query', async query => {
        try {
            const { message, data } = query;
            const chatId = message.chat.id;
            const userId = query.from.id;
            const messageId = message.message_id;
            const result = data.replace(`${scanProfitPrefix}_`, '');

            if (
                data.includes('personalwallet') ||
                data.includes('stalkedwallet')
            ) {
                let result;
                if (data.includes('personalwallet')) {
                    result = data.replace(`personalwallet_`, '');
                } else {
                    result = data.replace(`stalkedwallet_`, '');
                }
                total = 0;
                chunks[0] = '';
                previousTotal = 0;
                index = 0;
                totalNum = 1;

                const date = new Date();
                date.setMonth(date.getMonth() - 1);

                runAnalyze(
                    bot,
                    chatId,
                    result,
                    userId,
                    date.toLocaleDateString('en-CA'),
                    message.chat.type,
                );
                return;
            }
            if (data.includes(scanProfitPrefix)) {
                let address = result;
                const { premiumIf } = (await checkIfPremium(userId)).data;
                if (!premiumIf.premium) {
                    bot.sendMessage(
                        chatId,
                        'Only premium members can now use this feature, kindly use /premium command to subscribe.',
                    );
                    return;
                }
                total = 0;
                chunks[0] = '';
                previousTotal = 0;
                index = 0;
                totalNum = 1;

                if (result.includes('custom')) {
                    address = result.replace('custom_', '');
                    const requestUsernameOptions = {
                        reply_markup: {
                            parse_mode: 'HTML',
                        },
                    };

                    await bot.sendMessage(
                        chatId,
                        'Please enter the date you want to analyze from.\nThe date format is YYYY-MM-DD-HH.',
                        requestUsernameOptions,
                    );

                    store.setCurrentPrompt('pnlPrompt', { address });
                    return;
                }

                const date = new Date();

                if (result.includes('month')) {
                    address = result.replace('month_', '');
                    date.setMonth(date.getMonth() - 1);
                } else if (result.includes('week')) {
                    address = result.replace('week_', '');
                    date.setDate(date.getDate() - 7);
                } else if (result.includes('day')) {
                    address = result.replace('day_', '');
                    date.setDate(date.getDate() - 1);
                }

                runAnalyze(
                    bot,
                    chatId,
                    address,
                    userId,
                    date.toLocaleDateString('en-CA'),
                    message.chat.type,
                    messageId,
                );
                return;
            }
            if (data === 'analyze_stalked') {
                const wallets = await getMyStalkedWalletsByUserId(chatId);

                let message = '';
                const inlineKeyboard = [];
                if (!wallets.wallets.length) {
                    message = 'You do not have any saved stalked wallets';
                } else {
                    message = '\n <b>Group Stalked Wallets</b> \n\n';
                    /* eslint-disable no-await-in-loop */
                    /* eslint-disable no-restricted-syntax */
                    for (const wallet of wallets.wallets) {
                        const totalBalance = await getTotalBalance(
                            chatId,
                            wallet.Wallet,
                        );

                        message += `💳 ${wallet.Username ? `${wallet.Username} - ` : ''}<code>${wallet.Wallet}</code> - $${totalBalance} \n`;
                        inlineKeyboard.push([
                            {
                                text: `Analyze ${wallet.Username ? `${wallet.Username}` : formatAddress(wallet.Wallet)}`,
                                callback_data: `stalkedwallet_${wallet.Wallet}`,
                            },
                        ]);
                    }
                    /* eslint-enable no-restricted-syntax */
                    /* eslint-enable no-await-in-loop */
                }
                bot.sendMessage(chatId, message, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: inlineKeyboard,
                    },
                });
            }
            if (data === 'analyze_personal') {
                const wallets = await getMyWalletsByUserId(chatId);
                let message = '';
                const inlineKeyboard = [];
                if (!wallets.wallets.length) {
                    message = 'You do not have any saved personal wallets';
                } else {
                    message = '\n <b>Group Personal Wallets</b> \n\n';
                    /* eslint-disable no-await-in-loop */
                    /* eslint-disable no-restricted-syntax */
                    for (const wallet of wallets.wallets) {
                        const totalBalance = await getTotalBalance(
                            chatId,
                            wallet.Wallet,
                        );

                        message += `💳 ${wallet.Username ? `${wallet.Username} - ` : ''}<code>${wallet.Wallet}</code> - $${totalBalance} \n`;
                        inlineKeyboard.push([
                            {
                                text: `Analyze ${wallet.Username ? `${wallet.Username}` : formatAddress(wallet.Wallet)}`,
                                callback_data: `personalwallet_${wallet.Wallet}`,
                            },
                        ]);
                    }
                    /* eslint-enable no-restricted-syntax */
                    /* eslint-enable no-await-in-loop */
                }
                bot.sendMessage(chatId, message, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: inlineKeyboard,
                    },
                });
            }
            if (data === 'stalked_wallet') {
                const userId = message.chat.id;
                const chatType = message.chat.type;
                const wallets = await getMyStalkedWalletsByUserId(userId);

                // console.log(wallets.wallets)

                if (!wallets.wallets.length) {
                    bot.sendMessage(chatId, 'You do not have stalked wallets', {
                        parse_mode: 'HTML',
                        disable_web_page_preview: true,
                    });
                }
                total = 0;
                chunks[0] = '';
                previousTotal = 0;
                index = 0;

                totalNum = wallets.wallets.length;

                wallets.wallets.forEach(wallet => {
                    runAnalyze(
                        bot,
                        chatId,
                        wallet.Wallet,
                        userId,
                        wallet.CreationDate,
                        chatType,
                    );
                });
            } else if (data === 'personal_wallet') {
                const userId = message.chat.id;
                const chatType = message.chat.type;
                const wallets = await getMyWalletsByUserId(userId);

                if (!wallets.wallets.length) {
                    bot.sendMessage(
                        chatId,
                        'You do not have personal wallets',
                        {
                            parse_mode: 'HTML',
                            disable_web_page_preview: true,
                        },
                    );
                }
                total = 0;
                chunks[0] = '';
                previousTotal = 0;
                index = 0;

                totalNum = wallets.wallets.length;
                // console.log(totalNum)/sts

                wallets.wallets.forEach(wallet => {
                    runAnalyze(
                        bot,
                        chatId,
                        wallet.Wallet,
                        userId,
                        wallet.CreationDate,
                        chatType,
                    );
                });
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
        }
    });
};

const handleProfitAndLossPrompt = bot => {
    bot.on('message', async message => {
        const userId = message.from.id;
        const chatId = message.chat.id;
        const date = message.text;
        const chatType = message.chat.type;

        if (!date) return;
        const currentPrompt = store.getCurrentPrompt();

        if (
            !(
                currentPrompt.prompt === 'pnlAllPrompt' ||
                currentPrompt.prompt === 'pnlPrompt'
            ) ||
            !currentPrompt.data
        )
            return;

        const wallets = currentPrompt.data?.wallets || [];
        const address = currentPrompt.data?.address || '';

        if (checkDate(date)) {
            if (currentPrompt.prompt === 'pnlAllPrompt') {
                wallets.wallets.forEach(wallet => {
                    runAnalyze(
                        bot,
                        chatId,
                        wallet.Wallet,
                        userId,
                        date,
                        chatType,
                    );
                });
            } else {
                runAnalyze(bot, chatId, address, userId, date, chatType);
            }
            store.clearCurrentPrompt();
            return;
        }

        bot.sendMessage(
            chatId,
            'Invalid Date Format. Please enter the date again. To end these prompts, type /end.',
        );
    });
};

module.exports = {
    handleProfitAndLoss,
    handleProfitAndLossAll,
    handleProfitAndLossCallbacks,
    // handleProfitAndLossAllCallbacks,
    handleProfitAndLossPrompt,
};
