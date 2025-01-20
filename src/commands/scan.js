const {
    fetchToken,
    getGasPrice,
    formatCost,
    formatAddress,
    verifyAddress,
    getDateTime,
    verifySolanaAddress,
    startWalletMonitoring,
    getPreviousPrice,
    calculateRate,
} = require('../utils.js');
const {
    addWallet,
    getAccountsByWallet,
    addLog,
    getMyWalletsByUserId,
    getAccountByUserId,
    checkIfAddableToMine,
    checkIfScanable,
    checkIfPremium,
    checkIfStalkable,
    getAds,
    getBlockedTokensByUserId,
    // checkIfAdmin,
} = require('../api.js');

const { checkIfGroupAdmin } = require('../utils.js');
const store = require('../store.js');

const defaultChains = ['eth', 'bsc', 'arb', 'base'];
const setWalletPrefex = 'setwallet';
const scanWalletPrefix = 'scan';
const portfolioPrefix = 'portfolio';
const wallets = {};
const EXPLORER_ENDPOINT = {
    eth: 'https://etherscan.io/',
    bsc: 'https://bscscan.com/',
    arb: 'https://arbiscan.io/',
    base: 'https://basescan.org/',
    matic: 'https://polygonscan.com/',
    ftm: 'https://ftmscan.com/',
    cro: 'https://cronoscan.com/',
    sol: 'https://solscan.io/',
};
const nativeTokens = [
    'eth',
    'So11111111111111111111111111111111111111112',
    'bsc',
    'arb',
    'base',
    'matic',
    'ftm',
    'cro',
];
let lastPortfolioDate = '24H';

const askNaming = (bot, chatId) => {
    const buttons = [
        { text: 'Name it now', callback_data: `${setWalletPrefex}_name` },
        { text: 'Skip this', callback_data: `${setWalletPrefex}_skip` },
    ];
    bot.sendMessage(chatId, 'Are you going to name this wallet right now?', {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [buttons],
        },
    });
};

const runScan = async (bot, chatId, address, userId, chatType = 'private') => {
    try {
        const isGroup = chatType === 'group' || chatType === 'supergroup';
        const id = isGroup ? chatId : userId;
        // bot.sendMessage(
        //     chatId,
        //     'Click this link: [OpenAI](https://openai.com)',
        //     { parse_mode: 'HTML' },
        // );
        const scanable = await checkIfScanable(userId);
        if (!scanable.data.scanable) {
            if (scanable.data.premium?.tokenExpired) {
                bot.sendMessage(
                    chatId,
                    'It appears that your wallet no longer meets the required holding threshold for premium membership 😭. You have lost your premium status. We hope to welcome you back soon as a premium member. 🤗',
                );
            } else if (scanable.data.premium?.premiumExpired) {
                bot.sendMessage(
                    chatId,
                    'Your premium membership has expired. To regain access, please use the /premium command.',
                );
            }

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

                let total = 0;

                let currChunk = 0;
                const chunks = [];
                chains.forEach(chain => {
                    if (!chunks[currChunk]) chunks[currChunk] = '';
                    if (chunks[currChunk].length > 2000) {
                        currChunk += 1;
                        chunks[currChunk] = '';
                    }

                    chunks[currChunk] +=
                        `\n⛓ <b>${chain.toUpperCase()}</b> ⛓\n`;
                    const tokensChain = filteredTokens.filter(
                        token => token.chain === chain,
                    );

                    tokensChain.sort((a, b) => b.price - a.price);

                    tokensChain.forEach(token => {
                        if (token.amount * token.price >= minimumAmount) {
                            total += token.amount * token.price;
                            if (chunks[currChunk].length > 2000) {
                                currChunk += 1;
                                chunks[currChunk] = '';
                            }
                            if (nativeTokens.includes(token.id)) {
                                chunks[currChunk] +=
                                    `💸 ${token.name} : ${formatCost(token.amount)} / $${formatCost(token.amount * token.price)}\n`;
                            } else {
                                chunks[currChunk] +=
                                    `💸 <a href='${EXPLORER_ENDPOINT[chain]}token/${token.id}'>${token.name}</a> : ${formatCost(token.amount)} / $${formatCost(token.amount * token.price)}\n`;
                            }
                        }
                    });
                });

                const Ad = await getAds();
                let adData = '';
                if (Ad.data.Ad) {
                    adData = `\n📡<b><i>Ads:</i></b> <a href="${Ad.data.Ad.Url}">${Ad.data.Ad.Text}</a>`;
                }

                bot.deleteMessage(
                    loadingMsg.chat.id,
                    loadingMsg.message_id,
                ).then(() => {
                    chunks.forEach((chunk, index) => {
                        if (index === 0) {
                            bot.sendMessage(
                                chatId,
                                `<a href="https://${isSol ? 'solscan' : 'etherscan'}.io/address/${address}">${formatAddress(address)}</a>\n💰 <b>Total Balance</b> : <b>$${formatCost(total)} 💰\n${chunk}</b>${adData}`,
                                {
                                    parse_mode: 'HTML',
                                    disable_web_page_preview: true,
                                },
                            );
                        } else {
                            bot.sendMessage(chatId, `<b>${chunk}</b>`, {
                                parse_mode: 'HTML',
                                disable_web_page_preview: true,
                            });
                        }
                    });

                    if (chunks.length > 1) {
                        bot.sendMessage(
                            chatId,
                            `Consider utilizing the /settings command to exclude tokens worth less than $10, filtering out insignificant tokens.`,
                            {
                                parse_mode: 'HTML',
                            },
                        );
                    }

                    addLog(id, 'scan', address, chatType);
                });
            },
        );
    } catch (err) {
        // console.log(err);
    }
};

async function scanWallet(bot, userId, chatId, chatType, address) {
    const isAddress =
        (await verifyAddress(address)) || (await verifySolanaAddress(address));
    if (!isAddress) {
        bot.sendMessage(chatId, 'Invalid Address');
        return;
    }
    if (chatType === 'group' || chatType === 'supergroup') {
        wallets[chatId] = address;

        bot.sendMessage(chatId, 'Scan', {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: 'Casual Scan',
                            callback_data: `${setWalletPrefex}_casual`,
                        },
                    ],
                    [
                        {
                            text: 'Stalked Wallet',
                            callback_data: `${setWalletPrefex}_stalk`,
                        },
                    ],
                ],
            },
        });
        return;
    }
    const accounts = await getAccountsByWallet(address);
    let registerdAccounts;
    if (chatType === 'private') {
        registerdAccounts = accounts.wallets.filter(
            account =>
                account.AccountId === userId && account.Wallet === address,
        );
    } else {
        registerdAccounts = accounts.wallets.filter(
            account =>
                account.AccountId === chatId && account.Wallet === address,
        );
    }

    if (registerdAccounts.length && registerdAccounts[0].Username) {
        runScan(bot, chatId, address, userId, chatType);
        return;
    }
    wallets[userId] = address;

    const premiumIf = await checkIfPremium(chatId);

    if (
        registerdAccounts.length &&
        !registerdAccounts[0].Username &&
        premiumIf.data.premiumIf?.premium
    ) {
        askNaming(bot, chatId);
        return;
    }
    // console.log('accounts---', accounts)
    if (registerdAccounts.length && !premiumIf.data.premiumIf?.premium) {
        runScan(bot, chatId, address, userId, chatType);
    } else {
        const text =
            chatType === 'private'
                ? 'Is this your wallet or you just want to stalk someone else?'
                : 'Casual scan or save as stalked wallet';
        const buttons =
            chatType === 'private'
                ? [
                      [
                          {
                              text: 'My Wallet',
                              callback_data: `${setWalletPrefex}_mine`,
                          },
                      ],
                      [
                          {
                              text: 'I want to stalk',
                              callback_data: `${setWalletPrefex}_random`,
                          },
                      ],
                  ]
                : [
                      [
                          {
                              text: 'Casual Scan',
                              callback_data: `${setWalletPrefex}_casual`,
                          },
                      ],
                      [
                          {
                              text: 'Stalked Wallet',
                              callback_data: `${setWalletPrefex}_stalk`,
                          },
                      ],
                  ];

        bot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: buttons,
            },
        });
    }
}

const handleScanCallbacks = bot => {
    bot.on('callback_query', async query => {
        try {
            const { message, data, from } = query;
            if (data.includes(setWalletPrefex)) {
                const result = data.replace(`${setWalletPrefex}_`, '');
                const address = wallets[message.chat.id];
                switch (result) {
                    case 'mine': {
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
                            return;
                        }
                        const accounts = await getAccountsByWallet(address);
                        const stalkedAccounts = accounts.wallets.filter(
                            account =>
                                account.AccountId !== message.chat.id &&
                                account.Wallet === address,
                        );
                        if (stalkedAccounts.length) {
                            const textProceed =
                                "It's funny another user has already registered this address as his wallet, who is the stalker between you two?";
                            const buttonsProceed = [
                                [
                                    {
                                        text: 'Proceed',
                                        callback_data: `${setWalletPrefex}_proceed`,
                                    },
                                    {
                                        text: 'Cancel',
                                        callback_data: `${setWalletPrefex}_cancel`,
                                    },
                                ],
                            ];
                            bot.sendMessage(message.chat.id, textProceed, {
                                parse_mode: 'HTML',
                                reply_markup: {
                                    inline_keyboard: buttonsProceed,
                                },
                            });
                            return;
                        }
                        askNaming(bot, message.chat.id);
                        break;
                    }
                    case 'proceed':
                        askNaming(bot, message.chat.id);
                        break;
                    case 'name': {
                        await bot.sendMessage(
                            message.chat.id,
                            'Please enter your wallet name:',
                        );

                        store.setCurrentPrompt('walletNamePrompt', { address });
                        break;
                    }
                    case 'skip':
                        if (message.chat.type === 'private') {
                            // console.log(message.chat.type === 'private');
                            if (wallets[message.chat.id]) {
                                const res = await addWallet({
                                    accountId: message.chat.id,
                                    wallet: wallets[message.chat.id],
                                    username: null,
                                    personal: true,
                                    chatId: message.chat.id,
                                });
                                if (res.status === 'create') {
                                    startWalletMonitoring(
                                        bot,
                                        message.chat.id,
                                        message.chat.id,
                                        wallets[message.chat.id],
                                    );
                                }
                            }
                            runScan(
                                bot,
                                message.chat.id,
                                address,
                                message.chat.id,
                            );
                        } else {
                            const res = await addWallet({
                                accountId: message.chat.id,
                                wallet: address,
                                username: null,
                                personal: false,
                            });
                            if (res.status === 'create') {
                                startWalletMonitoring(
                                    bot,
                                    message.chat.id,
                                    message.chat.id,
                                    address,
                                );
                            }
                            runScan(
                                bot,
                                message.chat.id,
                                address,
                                from.id,
                                message.chat.type,
                            );
                        }

                        break;
                    case 'random': {
                        const stalkable = await checkIfStalkable(
                            message.chat.id,
                        );
                        if (
                            stalkable.data.stalkable &&
                            wallets[message.chat.id]
                        ) {
                            const res = await addWallet({
                                accountId: message.chat.id,
                                wallet: wallets[message.chat.id],
                                username: null,
                                personal: false,
                                chatId: message.chat.id,
                            });
                            if (res.status === 'create') {
                                startWalletMonitoring(
                                    bot,
                                    message.chat.id,
                                    message.chat.id,
                                    wallets[message.chat.id],
                                );
                            }
                            runScan(bot, message.chat.id, address, from.id);
                        } else {
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
                        }
                        break;
                    }
                    case 'cancel':
                        if (wallets[message.chat.id]) {
                            const res = await addWallet({
                                accountId: message.chat.id,
                                wallet: wallets[message.chat.id],
                                username: null,
                                personal: false,
                                chatId: message.chat.id,
                            });
                            if (res.status === 'create') {
                                startWalletMonitoring(
                                    bot,
                                    message.chat.id,
                                    message.chat.id,
                                    wallets[message.chat.id],
                                );
                            }
                            runScan(bot, message.chat.id, address, from.id);
                        }
                        break;
                    case 'casual': {
                        runScan(bot, message.chat.id, address, from.id);
                        break;
                    }
                    case 'stalk': {
                        const adminIf = await checkIfGroupAdmin(
                            bot,
                            message.chat.id,
                            from.id,
                        );
                        if (adminIf) {
                            askNaming(bot, message.chat.id);
                            return;
                        }
                        bot.sendMessage(
                            message.chat.id,
                            'Only group admins can save a wallet.',
                        );

                        const res = await addWallet({
                            accountId: message.chat.id,
                            wallet: wallets[message.chat.id],
                            username: null,
                            personal: false,
                            chatId: message.chat.id,
                        });
                        if (res.status === 'create') {
                            startWalletMonitoring(
                                bot,
                                message.chat.id,
                                message.chat.id,
                                wallets[message.chat.id],
                            );
                        }

                        runScan(bot, message.chat.id, address, from.id);

                        break;
                    }
                    default:
                }
            }

            if (data.includes(scanWalletPrefix)) {
                const result = data.replace(`${scanWalletPrefix}_`, '');
                if (verifyAddress(result)) {
                    runScan(bot, message.chat.id, result, from.id);
                }
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
        }
    });
};

const handleScanPrompt = bot => {
    bot.on('message', async message => {
        const userId = message.from.id;
        const chatId = message.chat.id;
        const chatType = message.chat.type;

        const { text: name } = message;

        if (!name) return;
        const currentPrompt = store.getCurrentPrompt();

        if (currentPrompt.prompt !== 'walletNamePrompt' || !currentPrompt.data)
            return;

        // save name in DB if you want to ...
        if (chatType === 'private') {
            if (wallets[userId]) {
                const res = await addWallet({
                    accountId: userId,
                    wallet: wallets[userId],
                    username: name,
                    personal: true,
                });
                if (res.status === 'create') {
                    startWalletMonitoring(
                        bot,
                        userId,
                        chatId,
                        wallets[userId],
                        name,
                    );
                }
            }
        } else if (wallets[chatId]) {
            const res = await addWallet({
                accountId: chatId,
                wallet: wallets[chatId],
                username: name,
                personal: false,
            });
            if (res.status === 'create') {
                startWalletMonitoring(
                    bot,
                    userId,
                    chatId,
                    wallets[chatId],
                    name,
                );
            }
        }

        bot.sendMessage(chatId, 'Wallet Name saved');

        runScan(bot, chatId, currentPrompt.data?.address, userId, chatType);
        store.clearCurrentPrompt();
    });
};

async function handlePortfolio(
    bot,
    chatId,
    userId,
    chatType,
    messageId = '',
    interval = '24H',
) {
    if (chatType !== 'private') {
        bot.sendMessage(
            chatId,
            'This command can only be used in a private message with the bot.',
        );
        return;
    }

    lastPortfolioDate = interval;

    bot.sendMessage(chatId, 'Processing command...⏳👀').then(
        async loadingMsg => {
            const [date, time] = getDateTime();
            let messagePrefix = `<b>Here are your portfolio details as of ${date}, ${time} UTC. ( ${interval} ) Considering the following wallets:</b>\n`;

            const account = await getAccountByUserId(userId);
            let chains;
            if (
                account.data?.Account?.Chains &&
                JSON.parse(account.data.Account.Chains).length > 0
            ) {
                chains = JSON.parse(account.data.Account.Chains);
            } else {
                chains = defaultChains;
            }

            const unwantedTokens = [];
            const blocked = await getBlockedTokensByUserId(
                chatType === 'group' || chatType === 'supergroup'
                    ? chatId
                    : userId,
            );
            if (blocked.data.BlockedTokens) {
                const { BlockedTokens } = blocked.data;
                BlockedTokens.forEach(token => {
                    unwantedTokens.push(token.Token);
                });
            }

            const minimumAmount = account.data.Account.MinimumAmount || 0;
            const myWallets = await getMyWalletsByUserId(userId);
            const promises = myWallets.wallets.map(async wallet => {
                messagePrefix += `${formatAddress(wallet.Wallet)}\n`;
                const res = await fetchToken(wallet.Wallet);
                return res.data;
            });

            const walletData = await Promise.all(promises);
            const data = {};
            let total = 0;
            let oldTotal = 0;
            let currChunk = 0;
            const chunks = [];

            await Promise.all(
                chains.map(async chain => {
                    data[chain] = {
                        total: 0,
                    };
                    await Promise.all(
                        walletData.map(async wallet => {
                            const tokensChain = wallet.filter(
                                token => token.chain === chain,
                            );
                            await Promise.all(
                                tokensChain.map(async token => {
                                    /* eslint-disable no-prototype-builtins */
                                    if (!unwantedTokens.includes(token.id)) {
                                        let fromDate = Date.now();
                                        if (interval === '24H') {
                                            fromDate -= 24 * 60 * 60 * 1000;
                                        }
                                        if (interval === '7D') {
                                            fromDate -= 7 * 24 * 60 * 60 * 1000;
                                        }
                                        if (interval === '30D') {
                                            fromDate -=
                                                30 * 24 * 60 * 60 * 1000;
                                        }

                                        const previousPrice =
                                            await getPreviousPrice(
                                                [chain],
                                                new Date(
                                                    fromDate,
                                                ).toLocaleDateString('en-CA'),
                                                [token],
                                            );

                                        if (
                                            data[chain].hasOwnProperty(token.id)
                                        ) {
                                            data[chain][token.id].amount +=
                                                token.amount;
                                            data[chain][token.id].cost +=
                                                token.amount * token.price;
                                            data[chain][token.id].oldCost +=
                                                token.amount *
                                                previousPrice[0].price;
                                        } else {
                                            data[chain][token.id] = {};
                                            data[chain][token.id].id = token.id;
                                            data[chain][token.id].name =
                                                token.name;
                                            data[chain][token.id].amount =
                                                token.amount;
                                            data[chain][token.id].cost =
                                                token.amount * token.price;
                                            data[chain][token.id].oldCost =
                                                token.amount *
                                                previousPrice[0].price;
                                        }
                                        data[chain].total +=
                                            token.amount * token.price;
                                    }
                                }),
                            );
                        }),
                    );
                }),
            );

            chains
                .sort((a, b) => data[b].total - data[a].total)
                // eslint-disable-next-line array-callback-return
                .map(chain => {
                    if (!chunks[currChunk]) chunks[currChunk] = '';
                    if (chunks[currChunk].length > 2000) {
                        currChunk += 1;
                        chunks[currChunk] = '';
                    }

                    chunks[currChunk] +=
                        `\n⛓ <b>${chain.toUpperCase()}</b> ⛓\n`;
                    Object.values(data[chain])
                        .sort((b, a) => a.cost - b.cost)
                        .forEach(token => {
                            if (token.cost >= minimumAmount) {
                                oldTotal += token.oldCost;
                                total += token.cost;
                                if (chunks[currChunk].length > 2000) {
                                    currChunk += 1;
                                    chunks[currChunk] = '';
                                }
                                const rate = calculateRate(
                                    token.cost,
                                    token.oldCost,
                                );
                                if (nativeTokens.includes(token.id)) {
                                    chunks[currChunk] +=
                                        `🚀 ${token.name} : ${formatCost(token.amount)} / $${formatCost(token.cost)} ( ${rate} )\n`;
                                } else {
                                    chunks[currChunk] +=
                                        `🚀 <a href='${EXPLORER_ENDPOINT[chain]}token/${token.id}'>${token.name}</a> : ${formatCost(token.amount)} / $${formatCost(token.cost)} ( ${rate} )\n`;
                                }
                            }
                        });
                });

            const Ad = await getAds();
            let adData = '';
            if (Ad.data.Ad) {
                adData = `\n📡<b><i>Ads:</i></b> <a href="${Ad.data.Ad.Url}">${Ad.data.Ad.Text}</a>`;
            }

            const buttons = [
                [
                    {
                        text: '24H',
                        callback_data: `${portfolioPrefix}_24H`,
                    },
                    {
                        text: '7D',
                        callback_data: `${portfolioPrefix}_7D`,
                    },
                    {
                        text: '30D',
                        callback_data: `${portfolioPrefix}_30D`,
                    },
                ],
                [
                    {
                        text: '🔄 Refresh',
                        callback_data: `${portfolioPrefix}_refresh`,
                    },
                ],
            ];

            const rate = calculateRate(total, oldTotal);

            const lengthOfChunks = chunks.length;

            bot.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id).then(
                async () => {
                    // eslint-disable-next-line no-restricted-syntax
                    for (let index = 0; index < lengthOfChunks; index += 1) {
                        const chunk = chunks[index];
                        if (index === 0) {
                            if (index === chunks.length - 1) {
                                if (messageId) {
                                    // eslint-disable-next-line no-await-in-loop
                                    await bot.editMessageText(
                                        `${messagePrefix}\n💰 <b>Total Balance</b> : <b>$${formatCost(total)} ( ${rate} ) 💰\n${chunk}</b>${adData}`,
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
                                        `${messagePrefix}\n💰 <b>Total Balance</b> : <b>$${formatCost(total)} ( ${rate} ) 💰\n${chunk}</b>${adData}`,
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
                                    `${messagePrefix}\n💰 <b>Total Balance</b> : <b>$${formatCost(total)} ( ${rate} ) 💰\n${chunk}</b>${adData}`,
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
                                    `${messagePrefix}\n💰 <b>Total Balance</b> : <b>$${formatCost(total)} ( ${rate} ) 💰\n${chunk}</b>${adData}`,
                                    {
                                        parse_mode: 'HTML',
                                        disable_web_page_preview: true,
                                    },
                                );
                            }
                        } else if (index === chunks.length - 1) {
                            if (messageId) {
                                // eslint-disable-next-line no-await-in-loop
                                await bot.editMessageText(`<b>${chunk}</b>`, {
                                    chat_id: chatId,
                                    message_id: messageId,
                                    parse_mode: 'HTML',
                                    disable_web_page_preview: true,
                                    reply_markup: {
                                        inline_keyboard: buttons,
                                    },
                                });
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
                            await bot.sendMessage(chatId, `<b>${chunk}</b>`, {
                                parse_mode: 'HTML',
                                disable_web_page_preview: true,
                            });
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
                    addLog(chatId, 'myPortfolio', '', chatType);
                },
            );
        },
    );
}

async function handleGetGasPrice(bot, chatId) {
    const gasPrice = await getGasPrice();
    bot.sendMessage(chatId, `Current Ethereum Gas Price is ${gasPrice} Gwei`);
    addLog(chatId, 'gas', '', '');
}

const handlePortfolioCallbacks = bot => {
    bot.on('callback_query', async query => {
        try {
            const { message, data, from } = query;
            if (data.includes(portfolioPrefix)) {
                const result = data.replace(`${portfolioPrefix}_`, '');
                switch (result) {
                    case '24H':
                        handlePortfolio(
                            bot,
                            message.chat.id,
                            from.id,
                            message.chat.type,
                            message.message_id,
                            '24H',
                        );
                        break;
                    case '7D':
                        handlePortfolio(
                            bot,
                            message.chat.id,
                            from.id,
                            message.chat.type,
                            message.message_id,
                            '7D',
                        );
                        break;
                    case '30D':
                        handlePortfolio(
                            bot,
                            message.chat.id,
                            from.id,
                            message.chat.type,
                            message.message_id,
                            '30D',
                        );
                        break;
                    case 'refresh':
                        handlePortfolio(
                            bot,
                            message.chat.id,
                            from.id,
                            message.chat.type,
                            message.message_id,
                            lastPortfolioDate,
                        );
                        break;
                    default:
                }
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
        }
    });
};

module.exports = {
    scanWallet,
    handleScanCallbacks,
    handlePortfolio,
    handlePortfolioCallbacks,
    handleGetGasPrice,
    handleScanPrompt,
};
