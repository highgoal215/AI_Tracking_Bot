const Web3 = require('web3');
const ethers = require('ethers');
const axios = require('axios');
const QuickChart = require('quickchart-js');
const {
    checkIfAdmin,
    getAllAccounts,
    getAllLogs,
    getMyWalletsByUserId,
    getBlockedTokensByUserId,
    checkIfPremium,
    addLog,
    getScanLogs,
} = require('../api.js');
const {
    getTotalBalanceOnETH,
    verifyAddress,
    fetchToken,
    getPreviousPrice,
    formatCost,
} = require('../utils.js');
const store = require('../store.js');

const chartPrefix = 'chart';
const userPrefix = 'user';
const logPrefix = 'log';
const activityPrefix = 'activity';
const portfolioPrefix = 'portfolio';
const profitPrefix = 'profit';

const { ETHERSCAN_API_KEY, RPC_URL, ENDPOINT, DEBANK_API_KEY } = process.env;

const web3 = new Web3(RPC_URL);

const chart = new QuickChart();

chart.setWidth(500);
chart.setHeight(300);
chart.setBackgroundColor('#181818');
chart.setVersion('2');

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

const convertDateToShort = date => {
    return new Date(date).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
    });
};

const convertDateToHour = date => {
    return new Date(date).toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
};

const getDateFromDateTime = dateTime => {
    return dateTime.toISOString().split('T')[0];
};

const getDateTime = date => {
    // Create a new Date object to represent the current date and time
    const now = new Date(date);

    // Get the current year
    const year = now.getFullYear();

    // Get the current month (0-indexed, so January is 0)
    const month = now.getMonth() + 1; // Adding 1 to adjust for 0-indexing

    // Get the current day of the month
    const day = now.getDate();

    // Get the current hours in 24-hour format
    const hours = now.getHours();

    // Get the current minutes
    const minutes = now.getMinutes();

    // Round down the minutes to the nearest 60 (1 hour)
    const roundedMinutes = minutes - (minutes % 60);

    // Create a new Date object with the rounded minutes
    const roundedDate = new Date(year, month - 1, day, hours, roundedMinutes);

    return roundedDate;
};

const buildChart = async (
    data,
    title,
    isCumulative,
    isReverse,
    isHour,
    startDate,
    endDate,
) => {
    const countByCreationDate = data.reduce((acc, account) => {
        const accountDate = isHour
            ? getDateTime(new Date(account.CreationDate)).toISOString()
            : getDateFromDateTime(new Date(account.CreationDate));
        acc[accountDate] = (acc[accountDate] || 0) + (account.value || 1);
        return acc;
    }, {});

    let cumulativeSum = 0;
    const cumulativeCountByCreationDate = {};

    if (isHour) {
        const endDate1 = new Date();
        const startDate1 = new Date(endDate1);
        startDate1.setDate(startDate1.getDate() - 1);
        for (
            let date = endDate1;
            date >= startDate1;
            date.setMinutes(date.getMinutes() - 120)
        ) {
            const dateStr = getDateTime(date).toISOString();
            if (isCumulative) {
                cumulativeSum += countByCreationDate[dateStr] || 0;
            } else {
                cumulativeSum = countByCreationDate[dateStr] || 0;
            }
            cumulativeCountByCreationDate[convertDateToHour(dateStr)] =
                cumulativeSum < 0 ? 0 : cumulativeSum;
        }
    } else if (startDate && endDate) {
        const earliestDate = new Date(
            Math.min(...data.map(account => new Date(account.CreationDate))),
        );

        if (isCumulative) {
            for (
                let date = earliestDate;
                date < startDate;
                date.setDate(date.getDate() + 1)
            ) {
                const dateStr = getDateFromDateTime(date);
                cumulativeSum += countByCreationDate[dateStr] || 0;
            }
        }

        startDate.setDate(startDate.getDate() + 1);

        if (isReverse) {
            for (
                let date = endDate;
                date >= startDate;
                date.setDate(date.getDate() - 1)
            ) {
                const dateStr = getDateFromDateTime(date);
                if (isCumulative) {
                    cumulativeSum += countByCreationDate[dateStr] || 0;
                } else {
                    cumulativeSum = countByCreationDate[dateStr] || 0;
                }
                cumulativeCountByCreationDate[convertDateToShort(dateStr)] =
                    cumulativeSum < 0 ? 0 : cumulativeSum;
            }
        } else {
            for (
                let date = startDate;
                date <= endDate;
                date.setDate(date.getDate() + 1)
            ) {
                const dateStr = getDateFromDateTime(date);
                if (isCumulative) {
                    cumulativeSum += countByCreationDate[dateStr] || 0;
                } else {
                    cumulativeSum = countByCreationDate[dateStr] || 0;
                }
                cumulativeCountByCreationDate[convertDateToShort(dateStr)] =
                    cumulativeSum < 0 ? 0 : cumulativeSum;
            }
        }
    } else {
        Object.keys(countByCreationDate).forEach(date => {
            if (isCumulative) {
                cumulativeSum += countByCreationDate[date] || 0;
            } else {
                cumulativeSum = countByCreationDate[date] || 0;
            }
            cumulativeCountByCreationDate[convertDateToShort(date)] =
                cumulativeSum < 0 ? 0 : cumulativeSum;
        });
    }

    chart.setConfig({
        type: 'line',
        data: {
            labels: Object.keys(cumulativeCountByCreationDate),
            datasets: [
                {
                    label: 'My First dataset',
                    backgroundColor: 'rgb(255, 99, 132)',
                    borderColor: 'rgb(255, 99, 132)',
                    data: Object.values(cumulativeCountByCreationDate),
                    fill: false,
                },
            ],
        },
        options: {
            title: {
                display: true,
                text: title,
                fontColor: '#ffffff',
            },
            legend: {
                display: false,
            },
            scales: {
                xAxes: [
                    {
                        ticks: {
                            fontColor: '#fff',
                            reverse: isReverse,
                        },
                        gridLines: {
                            color: '#aaa',
                        },
                    },
                ],
                yAxes: [
                    {
                        ticks: {
                            fontColor: '#fff',
                            maxTicksLimit: 5,
                        },
                        gridLines: {
                            color: '#aaa',
                        },
                    },
                ],
            },
            plugins: {
                tickFormat: {
                    prefix: isReverse ? '$' : '',
                },
            },
        },
    });

    const image = await chart.getUrl();
    return image;
};

const handleUserBaseChart = async (bot, chatId, userId) => {
    const adminIf = await checkIfAdmin(userId);
    if (!adminIf.data.adminIf) {
        bot.sendMessage(chatId, 'Only bot owner can use this command');
        return;
    }

    bot.sendMessage(chatId, 'Processing command...⏳👀').then(
        async loadingMsg => {
            const accounts = await getAllAccounts();
            const title = 'Total Number of Users';
            const image = await buildChart(
                accounts.Accounts,
                title,
                true,
                false,
                false,
            );

            const buttons = [
                [
                    {
                        text: '1 week',
                        callback_data: `${chartPrefix}_${userPrefix}_week`,
                    },
                    {
                        text: '1 month',
                        callback_data: `${chartPrefix}_${userPrefix}_month`,
                    },
                    {
                        text: 'Custom',
                        callback_data: `${chartPrefix}_${userPrefix}_custom`,
                    },
                ],
            ];

            bot.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id).then(
                () => {
                    bot.sendPhoto(chatId, image, {
                        reply_markup: {
                            inline_keyboard: buttons,
                        },
                    });
                    addLog(chatId, 'userChart', '', '');
                },
            );
        },
    );
};

const getPortfolioHistoryData = async (wallets, startDate, endDate) => {
    const currentBlock = await web3.eth.getBlockNumber();
    const startBlock =
        startDate && endDate
            ? currentBlock - (endDate - startDate) / (1000 * 12) - 10
            : currentBlock - 5 * 60 * 24 - 10;
    const now = new Date();

    const portfolioHistory = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const wallet of wallets) {
        // eslint-disable-next-line no-await-in-loop
        const present = await getTotalBalanceOnETH(wallet.Wallet);
        portfolioHistory.push({
            CreationDate: now,
            value: parseFloat(present),
        });

        const ETH_ETHERSCAN_ENDPOINT = `${ENDPOINT}?module=account&action=txlist&address=${wallet.Wallet}&startblock=${startBlock}&endblock=${currentBlock}&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
        // eslint-disable-next-line no-await-in-loop
        const responseEth = await axios.get(ETH_ETHERSCAN_ENDPOINT);

        // eslint-disable-next-line no-restricted-syntax
        for (const tx of responseEth.data.result) {
            if (!tx.blockNumber) {
                // eslint-disable-next-line no-continue
                continue;
            }
            if (tx.value === '0') {
                // eslint-disable-next-line no-continue
                continue;
            }

            const date = new Date(Number(tx.timeStamp) * 1000);

            const headers = {
                AccessKey: DEBANK_API_KEY,
            };
            const debankURL = `https://pro-openapi.debank.com/v1/token/history_price?chain_id=eth&id=eth&date_at=${date}`;
            // eslint-disable-next-line no-await-in-loop
            const price = await axios.get(debankURL, {
                headers,
            });

            const value = formatCost(
                parseFloat(price.data.price) *
                    parseFloat(ethers.formatEther(tx.value || 0)),
            );
            if (value) {
                if (tx.to.toLowerCase() === wallet.Wallet.toLowerCase()) {
                    portfolioHistory.push({
                        CreationDate: date,
                        value: -parseFloat(value),
                    });
                    // eslint-disable-next-line no-continue
                    continue;
                }
                if (tx.from.toLowerCase() === wallet.Wallet.toLowerCase()) {
                    portfolioHistory.push({
                        CreationDate: new Date(Number(tx.timeStamp) * 1000),
                        value: parseFloat(value),
                    });
                    // eslint-disable-next-line no-continue
                    continue;
                }
            }
        }

        const TOKEN_ETHERSCAN_ENDPOINT = `${ENDPOINT}?module=account&action=tokentx&address=${wallet.Wallet}&startblock=${startBlock}&endblock=${currentBlock}&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
        // eslint-disable-next-line no-await-in-loop
        const responseToken = await axios.get(TOKEN_ETHERSCAN_ENDPOINT);

        if (responseToken.data.message !== 'OK') {
            // eslint-disable-next-line no-continue
            continue;
        }
        // eslint-disable-next-line no-restricted-syntax
        for (const tx of responseToken.data.result) {
            if (!tx.blockNumber) {
                // eslint-disable-next-line no-continue
                continue;
            }

            const date = new Date(Number(tx.timeStamp) * 1000);

            const { contractAddress } = tx;
            const headers = {
                AccessKey: DEBANK_API_KEY,
            };
            const debankURL = `https://pro-openapi.debank.com/v1/token/history_price?chain_id=eth&id=${contractAddress}&date_at=${date}`;
            // eslint-disable-next-line no-await-in-loop
            const price = await axios.get(debankURL, {
                headers,
            });
            const value = formatCost(
                parseFloat(
                    ethers.formatUnits(tx.value, Number(tx.tokenDecimal) || 18),
                ) * (price.data?.price || 0),
            );

            if (tx.to.toLowerCase() === wallet.Wallet.toLowerCase()) {
                portfolioHistory.push({
                    CreationDate: new Date(Number(tx.timeStamp) * 1000),
                    value: -parseFloat(value),
                });
                // eslint-disable-next-line no-continue
                continue;
            }
            if (tx.from.toLowerCase() === wallet.Wallet.toLowerCase()) {
                portfolioHistory.push({
                    CreationDate: new Date(Number(tx.timeStamp) * 1000),
                    value: parseFloat(value),
                });
                // eslint-disable-next-line no-continue
                continue;
            }
        }
    }
    return portfolioHistory;
};

const handlePortfolioChart = async (bot, chatId, userId, chatType) => {
    if (chatType !== 'private') {
        bot.sendMessage(
            chatId,
            'This command can only be used in a private message with the bot.',
        );
        return;
    }
    bot.sendMessage(chatId, 'Processing command...⏳👀').then(
        async loadingMsg => {
            const myWallets = await getMyWalletsByUserId(userId);
            const myETHWallets = myWallets.wallets.filter(wallet =>
                verifyAddress(wallet.Wallet),
            );

            const portfolioHistory =
                await getPortfolioHistoryData(myETHWallets);

            const title = 'History of Portfolio Value';
            const image = await buildChart(
                portfolioHistory,
                title,
                true,
                true,
                true,
            );

            const buttons = [
                [
                    {
                        text: '24H',
                        callback_data: `${chartPrefix}_${portfolioPrefix}_day`,
                    },
                    {
                        text: '1W',
                        callback_data: `${chartPrefix}_${portfolioPrefix}_week`,
                    },
                    {
                        text: '1m',
                        callback_data: `${chartPrefix}_${portfolioPrefix}_month`,
                    },
                ],
            ];

            bot.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id).then(
                () => {
                    bot.sendPhoto(chatId, image, {
                        reply_markup: {
                            inline_keyboard: buttons,
                        },
                    });
                    addLog(chatId, 'portfolioChart', '', '');
                },
            );
        },
    );
};

const handleWalletScanChart = async (bot, chatId, userId) => {
    const adminIf = await checkIfAdmin(userId);
    if (!adminIf.data.adminIf) {
        bot.sendMessage(chatId, 'Only bot owner can use this command');
        return;
    }

    bot.sendMessage(chatId, 'Processing command...⏳👀').then(
        async loadingMsg => {
            const logs = await getScanLogs();
            const title = 'Number of Daily Scans';
            const image = await buildChart(
                logs.Logs,
                title,
                false,
                false,
                false,
            );

            const buttons = [
                [
                    {
                        text: '1 week',
                        callback_data: `${chartPrefix}_${logPrefix}_week`,
                    },
                    {
                        text: '1 month',
                        callback_data: `${chartPrefix}_${logPrefix}_month`,
                    },
                    {
                        text: 'Custom',
                        callback_data: `${chartPrefix}_${logPrefix}_custom`,
                    },
                ],
            ];

            bot.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id).then(
                () => {
                    bot.sendPhoto(chatId, image, {
                        reply_markup: {
                            inline_keyboard: buttons,
                        },
                    });
                    addLog(chatId, 'scanChart', '', '');
                },
            );
        },
    );
};

const handleActivityChart = async (bot, chatId, userId) => {
    const adminIf = await checkIfAdmin(userId);
    if (!adminIf.data.adminIf) {
        bot.sendMessage(chatId, 'Only bot owner can use this command');
        return;
    }

    bot.sendMessage(chatId, 'Processing command...⏳👀').then(
        async loadingMsg => {
            const logs = await getAllLogs(
                new Date(0).toLocaleDateString('en-CA'),
                new Date().toLocaleDateString('en-CA'),
            );
            const title = 'Number of Daily Activities';
            const image = await buildChart(
                logs.Logs,
                title,
                false,
                false,
                false,
            );

            const buttons = [
                [
                    {
                        text: '1 week',
                        callback_data: `${chartPrefix}_${activityPrefix}_week`,
                    },
                    {
                        text: '1 month',
                        callback_data: `${chartPrefix}_${activityPrefix}_month`,
                    },
                    {
                        text: 'Custom',
                        callback_data: `${chartPrefix}_${activityPrefix}_custom`,
                    },
                ],
            ];

            bot.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id).then(
                () => {
                    bot.sendPhoto(chatId, image, {
                        reply_markup: {
                            inline_keyboard: buttons,
                        },
                    });
                    addLog(chatId, 'activityChart', '', '');
                },
            );
        },
    );
};

const getProfitData = async (userId, startDate, endDate) => {
    const chains = ['eth', 'bsc', 'arb', 'base'];
    const title = 'History of Profit Value';

    const unwantedTokens = [];
    const blocked = await getBlockedTokensByUserId(userId);
    if (blocked.data.BlockedTokens) {
        const { BlockedTokens } = blocked.data;
        BlockedTokens.forEach(token => {
            unwantedTokens.push(token.Token);
        });
    }

    const myWallets = await getMyWalletsByUserId(userId);
    const promises = myWallets.wallets.map(async wallet => {
        const res = await fetchToken(wallet.Wallet);
        return res.data;
    });

    const walletData = await Promise.all(promises);
    const data = {};
    const tokens = [];

    for (let index = 0; index < walletData.length; index += 1) {
        const wallet = walletData[index];
        const tokensChain = wallet.filter(
            token =>
                chains.includes(token.chain) &&
                !unwantedTokens.includes(token.id),
        );
        tokens.push(tokensChain);
    }
    const allTokens = tokens.flat();

    for (
        let date = startDate;
        date < endDate;
        date.setDate(date.getDate() + 1)
    ) {
        // eslint-disable-next-line no-await-in-loop
        const previousPrice = await getPreviousPrice(
            chains,
            new Date(date).toLocaleString('en-CA'),
            allTokens,
        );

        for (let index1 = 0; index1 < allTokens.length; index1 += 1) {
            const token = allTokens[index1];
            data[convertDateToShort(date)] =
                (data[convertDateToShort(date)] || 0) +
                (previousPrice[index1].price * token.amount || 0);
        }
    }

    const firstValue = data[Object.keys(data)[0]];

    const keys = Object.keys(data);
    for (let i = 1; i < keys.length; i += 1) {
        if (data[keys[i]] === 0) {
            data[keys[i]] = data[keys[i - 1]];
        }
    }

    Object.keys(data).forEach(key => {
        data[key] -= firstValue;
    });

    chart.setConfig({
        type: 'line',
        data: {
            labels: Object.keys(data),
            datasets: [
                {
                    label: 'My First dataset',
                    backgroundColor: 'rgb(255, 99, 132)',
                    borderColor: 'rgb(255, 99, 132)',
                    data: Object.values(data),
                    fill: false,
                },
            ],
        },
        options: {
            title: {
                display: true,
                text: title,
                fontColor: '#ffffff',
            },
            legend: {
                display: false,
            },
            scales: {
                xAxes: [
                    {
                        ticks: {
                            fontColor: '#fff',
                        },
                        gridLines: {
                            color: '#aaa',
                        },
                    },
                ],
                yAxes: [
                    {
                        ticks: {
                            fontColor: '#fff',
                            maxTicksLimit: 5,
                        },
                        gridLines: {
                            color: '#aaa',
                        },
                    },
                ],
            },
            plugins: {
                tickFormat: {
                    prefix: '$',
                },
            },
        },
    });

    const image = await chart.getUrl();
    return image;
};

const handleProfitChart = async (bot, chatId, userId, chatType) => {
    if (chatType !== 'private') {
        bot.sendMessage(
            chatId,
            'This command can only be used in a private message with the bot.',
        );
        return;
    }

    const { premiumIf } = (await checkIfPremium(userId)).data;
    if (!premiumIf.premium) {
        bot.sendMessage(
            chatId,
            'Only premium members can use this feature, kindly use /premium command to subscribe.',
        );
        return;
    }

    bot.sendMessage(chatId, 'Processing command...⏳👀').then(
        async loadingMsg => {
            const startDate = new Date();
            const endDate = new Date();
            startDate.setMonth(startDate.getMonth() - 1);

            const profitChart = await getProfitData(userId, startDate, endDate);

            const buttons = [
                [
                    {
                        text: '24H',
                        callback_data: `${chartPrefix}_${profitPrefix}_day`,
                    },
                    {
                        text: '1W',
                        callback_data: `${chartPrefix}_${profitPrefix}_week`,
                    },
                    {
                        text: '1m',
                        callback_data: `${chartPrefix}_${profitPrefix}_month`,
                    },
                ],
            ];

            bot.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id).then(
                () => {
                    bot.sendPhoto(chatId, profitChart, {
                        reply_markup: {
                            inline_keyboard: buttons,
                        },
                    });
                    addLog(chatId, 'profitChart', '', '');
                },
            );
        },
    );
};

const handleChartCallback = bot => {
    bot.on('callback_query', async query => {
        try {
            const { message, data, from } = query;

            if (data.includes(chartPrefix)) {
                const userId = from.id;
                const chatId = message.chat.id;
                const messageId = message.message_id;
                const typeSurfix = data.replace(`${chartPrefix}_`, '');
                const chartType = typeSurfix.split('_')[0];
                const surfix = typeSurfix.split('_')[1];

                if (
                    chartType === 'user' ||
                    chartType === 'log' ||
                    chartType === 'activity'
                ) {
                    const adminIf = await checkIfAdmin(userId);
                    if (!adminIf.data.adminIf) {
                        bot.sendMessage(
                            chatId,
                            'Only bot owner can use this command',
                        );
                        return;
                    }
                }

                if (surfix === 'week' || surfix === 'month') {
                    bot.sendMessage(chatId, 'Processing command...⏳👀').then(
                        async loadingMsg => {
                            const startDate = new Date();
                            const endDate = new Date();

                            if (surfix === 'week') {
                                startDate.setDate(startDate.getDate() - 7);
                            } else {
                                startDate.setMonth(startDate.getMonth() - 1);
                            }

                            let image = '';
                            let buttons = [];
                            if (chartType === 'user') {
                                const accounts = await getAllAccounts();
                                const title = 'Total Number of Users';
                                image = await buildChart(
                                    accounts.Accounts,
                                    title,
                                    true,
                                    false,
                                    false,
                                    startDate,
                                    endDate,
                                );

                                buttons = [
                                    [
                                        {
                                            text: '1 week',
                                            callback_data: `${chartPrefix}_${userPrefix}_week`,
                                        },
                                        {
                                            text: '1 month',
                                            callback_data: `${chartPrefix}_${userPrefix}_month`,
                                        },
                                        {
                                            text: 'Custom',
                                            callback_data: `${chartPrefix}_${userPrefix}_custom`,
                                        },
                                    ],
                                ];
                            } else if (chartType === 'log') {
                                const logs = await getScanLogs();
                                const title = 'Number of Daily Scans';
                                image = await buildChart(
                                    logs.Logs,
                                    title,
                                    false,
                                    false,
                                    false,
                                    startDate,
                                    endDate,
                                );

                                buttons = [
                                    [
                                        {
                                            text: '1 week',
                                            callback_data: `${chartPrefix}_${logPrefix}_week`,
                                        },
                                        {
                                            text: '1 month',
                                            callback_data: `${chartPrefix}_${logPrefix}_month`,
                                        },
                                        {
                                            text: 'Custom',
                                            callback_data: `${chartPrefix}_${logPrefix}_custom`,
                                        },
                                    ],
                                ];
                            } else if (chartType === 'activity') {
                                const logs = await getAllLogs(
                                    startDate.toLocaleDateString('en-CA'),
                                    endDate.toLocaleDateString('en-CA'),
                                );
                                const title = 'Number of Daily Activities';
                                image = await buildChart(
                                    logs.Logs,
                                    title,
                                    false,
                                    false,
                                    false,
                                    startDate,
                                    endDate,
                                );

                                buttons = [
                                    [
                                        {
                                            text: '1 week',
                                            callback_data: `${chartPrefix}_${activityPrefix}_week`,
                                        },
                                        {
                                            text: '1 month',
                                            callback_data: `${chartPrefix}_${activityPrefix}_month`,
                                        },
                                        {
                                            text: 'Custom',
                                            callback_data: `${chartPrefix}_${activityPrefix}_custom`,
                                        },
                                    ],
                                ];
                            } else if (chartType === 'profit') {
                                image = await getProfitData(
                                    userId,
                                    startDate,
                                    endDate,
                                );

                                buttons = [
                                    [
                                        {
                                            text: '24H',
                                            callback_data: `${chartPrefix}_${profitPrefix}_day`,
                                        },
                                        {
                                            text: '1W',
                                            callback_data: `${chartPrefix}_${profitPrefix}_week`,
                                        },
                                        {
                                            text: '1m',
                                            callback_data: `${chartPrefix}_${profitPrefix}_month`,
                                        },
                                    ],
                                ];
                            } else {
                                const myWallets =
                                    await getMyWalletsByUserId(userId);
                                const myETHWallets = myWallets.wallets.filter(
                                    wallet => verifyAddress(wallet.Wallet),
                                );

                                const portfolioHistory =
                                    await getPortfolioHistoryData(
                                        myETHWallets,
                                        startDate,
                                        endDate,
                                    );

                                const title = 'History of Portfolio Value';
                                image = await buildChart(
                                    portfolioHistory,
                                    title,
                                    true,
                                    true,
                                    false,
                                    startDate,
                                    endDate,
                                );

                                buttons = [
                                    [
                                        {
                                            text: '24H',
                                            callback_data: `${chartPrefix}_${portfolioPrefix}_day`,
                                        },
                                        {
                                            text: '1W',
                                            callback_data: `${chartPrefix}_${portfolioPrefix}_week`,
                                        },
                                        {
                                            text: '1m',
                                            callback_data: `${chartPrefix}_${portfolioPrefix}_month`,
                                        },
                                    ],
                                ];
                            }

                            bot.deleteMessage(
                                loadingMsg.chat.id,
                                loadingMsg.message_id,
                            ).then(() => {
                                bot.editMessageMedia(
                                    {
                                        type: 'photo',
                                        media: image,
                                    },
                                    {
                                        chat_id: chatId,
                                        message_id: messageId,
                                        reply_markup: {
                                            inline_keyboard: buttons,
                                        },
                                    },
                                );
                                addLog(chatId, 'portfolioChart', '', '');
                            });
                        },
                    );
                } else if (surfix === 'day') {
                    bot.sendMessage(chatId, 'Processing command...⏳👀').then(
                        async loadingMsg => {
                            let image;
                            let buttons;

                            const myWallets =
                                await getMyWalletsByUserId(userId);
                            const myETHWallets = myWallets.wallets.filter(
                                wallet => verifyAddress(wallet.Wallet),
                            );

                            if (chartType === 'portfolio') {
                                const portfolioHistory =
                                    await getPortfolioHistoryData(myETHWallets);

                                const title = 'History of Portfolio Value';
                                image = await buildChart(
                                    portfolioHistory,
                                    title,
                                    true,
                                    true,
                                    true,
                                );

                                buttons = [
                                    [
                                        {
                                            text: '24H',
                                            callback_data: `${chartPrefix}_${portfolioPrefix}_day`,
                                        },
                                        {
                                            text: '1W',
                                            callback_data: `${chartPrefix}_${portfolioPrefix}_week`,
                                        },
                                        {
                                            text: '1m',
                                            callback_data: `${chartPrefix}_${portfolioPrefix}_month`,
                                        },
                                        // {
                                        //     text: 'Custom',
                                        //     callback_data: `${chartPrefix}_${portfolioPrefix}_custom`,
                                        // },
                                    ],
                                ];
                            } else if (chartType === 'profit') {
                                const title = 'History of Profit Value';

                                const profitHistory = {};
                                // eslint-disable-next-line no-restricted-syntax
                                for (const wallet of myETHWallets) {
                                    const headers = {
                                        AccessKey: DEBANK_API_KEY,
                                    };
                                    const debankURL = `https://pro-openapi.debank.com/v1/user/total_net_curve?id=${wallet.Wallet}`;
                                    // eslint-disable-next-line no-await-in-loop
                                    const response = await axios.get(
                                        debankURL,
                                        {
                                            headers,
                                        },
                                    );
                                    const histories = response.data;

                                    for (
                                        let index = 0;
                                        index < histories.length;
                                        index += 1
                                    ) {
                                        const history = histories[index];
                                        const date = new Date(
                                            Number(history.timestamp) * 1000,
                                        );
                                        const profit = parseFloat(
                                            history.usd_value,
                                        );
                                        profitHistory[convertDateToHour(date)] =
                                            (profitHistory[
                                                convertDateToHour(date)
                                            ] || 0) + profit;
                                    }
                                }

                                const firstValue =
                                    profitHistory[
                                        Object.keys(profitHistory)[0]
                                    ];

                                Object.keys(profitHistory).forEach(key => {
                                    profitHistory[key] -= firstValue;
                                });

                                chart.setConfig({
                                    type: 'line',
                                    data: {
                                        labels: Object.keys(
                                            profitHistory,
                                        ).filter((_, i) => i % 24 === 0),
                                        datasets: [
                                            {
                                                label: 'My First dataset',
                                                backgroundColor:
                                                    'rgb(255, 99, 132)',
                                                borderColor:
                                                    'rgb(255, 99, 132)',
                                                data: Object.values(
                                                    profitHistory,
                                                ).filter(
                                                    (_, i) => i % 24 === 0,
                                                ),
                                                fill: false,
                                            },
                                        ],
                                    },
                                    options: {
                                        title: {
                                            display: true,
                                            text: title,
                                            fontColor: '#ffffff',
                                        },
                                        legend: {
                                            display: false,
                                        },
                                        scales: {
                                            xAxes: [
                                                {
                                                    ticks: {
                                                        fontColor: '#fff',
                                                    },
                                                    gridLines: {
                                                        color: '#aaa',
                                                    },
                                                },
                                            ],
                                            yAxes: [
                                                {
                                                    ticks: {
                                                        fontColor: '#fff',
                                                        maxTicksLimit: 5,
                                                    },
                                                    gridLines: {
                                                        color: '#aaa',
                                                    },
                                                },
                                            ],
                                        },
                                        plugins: {
                                            tickFormat: {
                                                prefix: '$',
                                            },
                                        },
                                    },
                                });

                                image = await chart.getUrl();

                                buttons = [
                                    [
                                        {
                                            text: '24H',
                                            callback_data: `${chartPrefix}_${profitPrefix}_day`,
                                        },
                                        {
                                            text: '1W',
                                            callback_data: `${chartPrefix}_${profitPrefix}_week`,
                                        },
                                        {
                                            text: '1m',
                                            callback_data: `${chartPrefix}_${profitPrefix}_month`,
                                        },
                                    ],
                                ];
                            }

                            bot.deleteMessage(
                                loadingMsg.chat.id,
                                loadingMsg.message_id,
                            ).then(() => {
                                bot.editMessageMedia(
                                    {
                                        type: 'photo',
                                        media: image,
                                    },
                                    {
                                        chat_id: chatId,
                                        message_id: messageId,
                                        reply_markup: {
                                            inline_keyboard: buttons,
                                        },
                                    },
                                );
                                addLog(chatId, 'profitChart', '', '');
                            });
                        },
                    );
                } else {
                    await bot.sendMessage(
                        chatId,
                        'Please enter the start date you wish to check the user count from. The date format should be: YYYY-MM-DD, for example, 2024-03-14.',
                    );

                    store.setCurrentPrompt('startDatePrompt', {
                        startDate: '',
                        chartType,
                    });
                }
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
        }
    });
};

const handleChartPrompt = bot => {
    bot.on('message', async message => {
        const userId = message.from.id;
        const chatId = message.chat.id;
        const date = message.text;
        const chatType = message.chat.type;

        if (!date) return;
        const currentPrompt = store.getCurrentPrompt();

        if (
            !(
                currentPrompt.prompt === 'startDatePrompt' ||
                currentPrompt.prompt === 'endDatePrompt'
            ) ||
            !currentPrompt.data
        )
            return;

        const chartType = currentPrompt.data?.chartType;

        if (!checkDate(date)) {
            bot.sendMessage(
                chatId,
                'Invalid Date Format. Please enter the date again. To end these prompts, type /end.',
            );
            return;
        }

        if (currentPrompt.prompt === 'startDatePrompt') {
            await bot.sendMessage(
                chatId,
                'Please provide the end date you wish to check the user count from. The date format should be: YYYY-MM-DD, for example, 2024-03-14.',
            );

            store.setCurrentPrompt('endDatePrompt', {
                startDate: date,
                chartType,
            });
        } else if (currentPrompt.prompt === 'endDatePrompt') {
            const date1 = currentPrompt.data?.startDate;
            if (!checkDate(date1)) {
                bot.sendMessage(
                    chatId,
                    'Error Occurred. To end these prompts, type /end.',
                );
                return;
            }

            bot.sendMessage(chatId, 'Processing command...⏳👀').then(
                async loadingMsg => {
                    const startDate = new Date(date1);
                    const endDate = new Date(date);

                    let image = '';
                    let buttons = [];
                    if (chartType === 'user') {
                        const accounts = await getAllAccounts();
                        const title = 'Total Number of Users';
                        image = await buildChart(
                            accounts.Accounts,
                            title,
                            true,
                            false,
                            false,
                            startDate,
                            endDate,
                        );

                        buttons = [
                            [
                                {
                                    text: '1 week',
                                    callback_data: `${chartPrefix}_${userPrefix}_week`,
                                },
                                {
                                    text: '1 month',
                                    callback_data: `${chartPrefix}_${userPrefix}_month`,
                                },
                                {
                                    text: 'Custom',
                                    callback_data: `${chartPrefix}_${userPrefix}_custom`,
                                },
                            ],
                        ];
                    } else if (chartType === 'log') {
                        const logs = await getScanLogs();
                        const title = 'Number of Daily Scans';
                        image = await buildChart(
                            logs.Logs,
                            title,
                            false,
                            false,
                            false,
                            startDate,
                            endDate,
                        );

                        buttons = [
                            [
                                {
                                    text: '1 week',
                                    callback_data: `${chartPrefix}_${logPrefix}_week`,
                                },
                                {
                                    text: '1 month',
                                    callback_data: `${chartPrefix}_${logPrefix}_month`,
                                },
                                {
                                    text: 'Custom',
                                    callback_data: `${chartPrefix}_${logPrefix}_custom`,
                                },
                            ],
                        ];
                    } else if (chartType === 'activity') {
                        const logs = await getAllLogs(
                            startDate.toLocaleDateString('en-CA'),
                            new Date(
                                new Date(endDate).getTime() +
                                    24 * 60 * 60 * 1000,
                            ).toLocaleDateString('en-CA'),
                        );
                        const title = 'Number of Daily Activities';
                        image = await buildChart(
                            logs.Logs,
                            title,
                            false,
                            false,
                            false,
                            startDate,
                            endDate,
                        );

                        buttons = [
                            [
                                {
                                    text: '1 week',
                                    callback_data: `${chartPrefix}_${activityPrefix}_week`,
                                },
                                {
                                    text: '1 month',
                                    callback_data: `${chartPrefix}_${activityPrefix}_month`,
                                },
                                {
                                    text: 'Custom',
                                    callback_data: `${chartPrefix}_${activityPrefix}_custom`,
                                },
                            ],
                        ];
                    } else {
                        const myWallets = await getMyWalletsByUserId(userId);
                        const myETHWallets = myWallets.wallets.filter(wallet =>
                            verifyAddress(wallet.Wallet),
                        );

                        const portfolioHistory = await getPortfolioHistoryData(
                            myETHWallets,
                            startDate,
                            endDate,
                        );

                        const title = 'History of Portfolio Value';
                        image = await buildChart(
                            portfolioHistory,
                            title,
                            true,
                            true,
                            false,
                            startDate,
                            endDate,
                        );

                        buttons = [
                            [
                                {
                                    text: '24H',
                                    callback_data: `${chartPrefix}_${portfolioPrefix}_day`,
                                },
                                {
                                    text: '1W',
                                    callback_data: `${chartPrefix}_${portfolioPrefix}_week`,
                                },
                                {
                                    text: '1m',
                                    callback_data: `${chartPrefix}_${portfolioPrefix}_month`,
                                },
                                // {
                                //     text: 'Custom',
                                //     callback_data: `${chartPrefix}_${portfolioPrefix}_custom`,
                                // },
                            ],
                        ];
                    }

                    bot.deleteMessage(
                        loadingMsg.chat.id,
                        loadingMsg.message_id,
                    ).then(() => {
                        bot.sendPhoto(chatId, image, {
                            reply_markup: {
                                inline_keyboard: buttons,
                            },
                        });
                        addLog(chatId, 'portfolioChart', '', chatType);
                        store.clearCurrentPrompt();
                    });
                },
            );
        }
    });
};

module.exports = {
    handleUserBaseChart,
    handleWalletScanChart,
    handleActivityChart,
    handlePortfolioChart,
    handleProfitChart,
    handleChartCallback,
    handleChartPrompt,
};
