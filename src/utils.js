const Web3 = require('web3');
const axios = require('axios');
const { PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { Metaplex } = require('@metaplex-foundation/js');
const { SOLANA_CONNECTION } = require('./config.js');
const { getBlockedTokensByUserId, getAccountByUserId } = require('./api.js');

const hashShift = 3; // Shift amount

const debankURL = 'https://pro-openapi.debank.com/v1/user';
const infuraUrl =
    'https://mainnet.infura.io/v3/f211a367c4b348cda8c897a56e72099b';

const { DEBANK_API_KEY } = process.env;

const web3 = new Web3(new Web3.providers.HttpProvider(infuraUrl));

const subscriptionIds = [];

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

function verifyAddress(address) {
    return Web3.utils.isAddress(address);
}

function verifySolanaAddress(address) {
    if (address.length < 32 || address.length > 44) {
        return false;
    }

    // Use the web3.js library to perform checksum validation
    try {
        const publicKey = new PublicKey(address);
        return PublicKey.isOnCurve(publicKey);
    } catch (error) {
        return false;
    }
}

async function getBalance(address) {
    const publicKey = new PublicKey(address);
    const balance = await SOLANA_CONNECTION.getBalance(publicKey);

    const url =
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd';
    const res = await axios.get(url);
    const { solana } = res.data;
    const exchangeRate = solana.usd;
    return {
        balance: (1.0 * balance) / LAMPORTS_PER_SOL,
        price: exchangeRate,
    };
}

const getSolPair = async tokenAddress => {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    const res = await axios.get(url);

    const { pairs } = res.data;
    if (pairs === null || pairs === undefined) {
        throw new Error('No pair');
    }

    const pair = pairs.find(
        ({ quoteToken }) =>
            quoteToken.address ===
            'So11111111111111111111111111111111111111112',
    );
    if (pair === null || pair === undefined) {
        throw new Error('No pair');
    }
    return pair;
};

const getSolTokenMetadata = async mintAddress => {
    const metaplex = new Metaplex(SOLANA_CONNECTION);
    return metaplex
        .nfts()
        .findByMint({ mintAddress: new PublicKey(mintAddress) });
};

const getSolTokenAccountsByOwner = async ownerAddress => {
    const url = `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
    const res = await axios.post(
        url,
        {
            id: 1,
            jsonrpc: '2.0',
            method: 'getTokenAccountsByOwner',
            params: [
                ownerAddress,
                {
                    programId: TOKEN_PROGRAM_ID,
                },
                {
                    encoding: 'jsonParsed',
                },
            ],
        },
        {
            headers: {
                'Content-Type': 'application/json',
            },
        },
    );
    const { result } = res.data;
    if (result && result.value) {
        return result.value;
    }
    throw new Error('Error in obtain data for api...');
};

const fetchSolToken = async ownerAddress => {
    const res = [];
    const tokenAccounts = await getSolTokenAccountsByOwner(ownerAddress);
    tokenAccounts.sort((a, b) =>
        a.account.data.parsed.info.mint.localeCompare(
            b.account.data.parsed.info.mint,
        ),
    );

    tokenAccounts.map(async acc => {
        const tokenAccount = acc.account;
        const mintAddress = tokenAccount.data.parsed.info.mint;
        const tokenAmount = tokenAccount.data.parsed.info.tokenAmount.uiAmount;
        let pair;
        let metadata;

        if (tokenAmount === 0) {
            return;
        }

        try {
            pair = await getSolPair(mintAddress);
        } catch {
            metadata = await getSolTokenMetadata(mintAddress);
        }

        const priceUsd = pair ? parseFloat(pair.priceUsd) : 0;

        res.push({
            id: mintAddress,
            name: pair?.baseToken?.name || metadata?.name,
            amount: tokenAmount,
            price: priceUsd,
            chain: 'sol',
        });
    });
    const solBalance = await getBalance(ownerAddress);
    res.push({
        id: 'So11111111111111111111111111111111111111112',
        name: 'SOL',
        amount: solBalance.balance,
        price: solBalance.price,
        chain: 'sol',
    });

    return { data: res };
};

async function getPreviousPrice(chains, date, filteredTokens) {
    const url = `https://pro-openapi.debank.com/v1/token/history_price`;
    const headers = {
        AccessKey: DEBANK_API_KEY,
    };

    const promises = chains.map(async chain => {
        const tokensChain = filteredTokens.filter(
            token => token.chain === chain,
        );

        if (chain === 'sol') {
            const tokenRequests = tokensChain.map(async token => {
                try {
                    const pair = await getSolPair(token);
                    const priceUsd = pair ? parseFloat(pair.priceUsd) : 0;
                    return {
                        price: priceUsd,
                    };
                } catch {
                    return {
                        price: 0,
                    };
                }
            });

            const responses = await Promise.all(tokenRequests);
            return responses.map(res => {
                return {
                    price: res?.priceUsd || 0,
                };
            });
        }

        const tokenRequests = tokensChain.map(async token => {
            try {
                const res = await axios.get(
                    `${url}?id=${token.id}&chain_id=${token.chain}&date_at=${date}`,
                    { headers },
                );
                return res.data;
            } catch {
                return {
                    price: 0,
                };
            }
        });

        const responses = await Promise.all(tokenRequests);
        return responses;
    });

    const previousPrice = await Promise.all(promises);
    const price = previousPrice.flat();

    return price;
}

const fetchToken = async address => {
    if (!verifyAddress(address) && verifySolanaAddress(address)) {
        return fetchSolToken(address);
    }
    const headers = {
        AccessKey: DEBANK_API_KEY,
    };
    const tokens = await axios.get(
        `${debankURL}/all_token_list?id=${address}`,
        {
            headers,
        },
    );

    return tokens;
};

const getGasPrice = async () => {
    const gasPrice = await web3.eth.getGasPrice();
    return web3.utils.fromWei(gasPrice, 'gwei');
};

const formatAddress = address => {
    // Check if the address is a valid Ethereum address
    // if (!/^0x[0-9A-Fa-f]{40}$/.test(address)) {
    //     throw new Error('Invalid Ethereum address');
    // }

    // Extract the first 4 and last 6 characters
    const firstPart = address.slice(0, 4);
    const lastPart = address.slice(-6);

    // Return the formatted address
    return `${firstPart}...${lastPart}`;
};

const formatNumber = number => {
    return Number(number).toLocaleString('en-US');
};

const formatCost = cost => {
    return Number(cost).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const getTotalBalance = async (userId, address) => {
    const tokens = await fetchToken(address);

    const unwantedTokens = [];
    const blocked = await getBlockedTokensByUserId(userId);
    if (blocked.data.BlockedTokens) {
        const { BlockedTokens } = blocked.data;
        BlockedTokens.forEach(token => {
            unwantedTokens.push(token.Token);
        });
    }

    const filteredTokens = tokens.data.filter(
        token => !unwantedTokens.includes(token.id),
    );

    const totalBalance = filteredTokens.reduce(
        (a, b) => a + b.amount * b.price,
        0,
    );
    return formatCost(totalBalance);
};

const getTotalBalanceOnETH = async address => {
    const headers = {
        AccessKey: DEBANK_API_KEY,
    };
    const balances = await axios.get(
        `${debankURL}/total_balance?id=${address}`,
        {
            headers,
        },
    );

    let result = 0;

    /* eslint-disable no-restricted-syntax */
    for (const balance of balances.data.chain_list) {
        if (balance.id === 'eth') {
            result = balance.usd_value;
        }
    }
    return result;
};

const getDateTime = () => {
    // Create a new Date object to represent the current date and time
    const now = new Date();

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

    return [`${day}/${month}/${year}`, `${hours}:${minutes}`];
};

// Encrypt function using Caesar Cipher
const caesarEncrypt = plaintext => {
    return plaintext
        .split('')
        .map(char => {
            // Check if character is a letter
            if (char.match(/[a-z]/i)) {
                const code = char.charCodeAt(0);
                const shiftAmount = (code - 65 + hashShift) % 26;
                const shiftedChar = String.fromCharCode(shiftAmount + 65);
                return shiftedChar;
            }
            return char; // Leave non-alphabetic characters unchanged
        })
        .join('');
};

const caesarDecrypt = ciphertext => {
    return ciphertext
        .split('')
        .map(char => {
            // Check if character is a letter
            if (char.match(/[a-z]/i)) {
                const code = char.charCodeAt(0);
                const shiftAmount = (code - 65 - hashShift) % 26;
                const shiftedChar = String.fromCharCode(shiftAmount + 65);
                return shiftedChar;
            }
            return char; // Leave non-alphabetic characters unchanged
        })
        .join('');
};

const getTimeFormat = timestamp => {
    // Convert timestamp to Date object
    const date = new Date(timestamp);

    // Array of weekday names
    const weekdays = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
    ];

    // Get the weekday
    const weekday = weekdays[date.getUTCDay()];

    // Get hours, minutes, and seconds
    const hours = `0${date.getUTCHours()}`.slice(-2);
    const minutes = `0${date.getUTCMinutes()}`.slice(-2);
    const seconds = `0${date.getUTCSeconds()}`.slice(-2);

    // Get day, month, and year
    const day = `0${date.getUTCDate()}`.slice(-2);
    const month = `0${date.getUTCMonth() + 1}`.slice(-2); // Month is zero-based, so we add 1
    const year = date.getUTCFullYear();

    // Construct the formatted date string
    const formattedDate = `${weekday}, ${hours}:${minutes}:${seconds}, ${day}/${month}/${year} in UTC`;
    return formattedDate;
};

const isValidURL = url => {
    // Regular expression to match URL pattern
    // eslint-disable-next-line prefer-regex-literals
    const urlRegex = new RegExp(
        '^(http(s)?:\\/\\/)?([\\w-]+\\.)+[\\w-]+(\\/[\\w- .\\/\\?%&=]*)?$',
    );

    // Test if the given URL matches the regex pattern
    return urlRegex.test(url);
};
const checkIfGroupAdmin = async (bot, chatId, userId) => {
    const administrators = await bot.getChatAdministrators(chatId);
    let res = false;

    administrators.forEach(administrator => {
        if (administrator.user.id === userId) res = true;
    });

    return res;
};

const walletMonitoring = async (
    bot,
    chatId,
    address,
    signature,
    minimumAmount,
    walletName,
) => {
    const transaction = await SOLANA_CONNECTION.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
    });

    if (!transaction) return;

    const { meta } = transaction;
    if (meta.err) return;

    const { postTokenBalances, preTokenBalances } = meta;
    if (postTokenBalances.length === 0 || preTokenBalances.length === 0) {
        const balance = await getBalance(address);
        const balanceAmount = balance.balance * LAMPORTS_PER_SOL;
        const { preBalances, postBalances } = meta;
        postBalances.forEach((one, index) => {
            if (one === balanceAmount) {
                if (preBalances[index] >= balanceAmount + minimumAmount) {
                    const amount = preBalances[index] - balanceAmount;
                    bot.sendMessage(
                        chatId,
                        `💳...💰... ➡️
                        
<b>A wallet you're tracking (${walletName || formatAddress(address)}) just sent/sold
$SOL worth $${formatCost((amount * balance.price) / LAMPORTS_PER_SOL)}.</b>

<a href="https://solscan.io/tx/${signature}">https://solscan.io/tx/${signature}</a>`,
                        {
                            parse_mode: 'HTML',
                            disable_web_page_preview: true,
                        },
                    );
                    return;
                }
                if (
                    balanceAmount >= minimumAmount &&
                    preBalances[index] === 0
                ) {
                    bot.sendMessage(
                        chatId,
                        `💳...⬅️...💰
                        
<b>A wallet you're tracking (${walletName || formatAddress(address)}) just received/bought
$SOL worth $${formatCost((balanceAmount * balance.price) / LAMPORTS_PER_SOL)}.</b>

<a href="https://solscan.io/tx/${signature}">https://solscan.io/tx/${signature}</a>`,
                        {
                            parse_mode: 'HTML',
                            disable_web_page_preview: true,
                        },
                    );
                }
            }
        });
        return;
    }

    const targetTokenBalances = postTokenBalances.filter(
        one => one.owner === address,
    );
    if (targetTokenBalances.length <= 0) return;

    const postAmount = targetTokenBalances[0]?.uiTokenAmount?.uiAmount || 0;
    const preToken = preTokenBalances.filter(one => one.owner === address);
    if (preToken.length <= 0) return;
    const preAmount = preToken[0]?.uiTokenAmount?.uiAmount || 0;
    const mintAddress = preToken[0]?.mint || '';
    const metadata = await getSolTokenMetadata(mintAddress);

    const pair = await getSolPair(targetTokenBalances[0].mint);
    const priceUsd = pair ? parseFloat(pair.priceUsd) : NaN;

    if (postAmount === preAmount) return;
    if (postAmount >= minimumAmount && preAmount === 0) {
        bot.sendMessage(
            chatId,
            `💳...⬅️...💰

<b>A wallet you're tracking (${walletName || formatAddress(address)}) just received/bought
$${metadata.symbol} worth $${formatCost(postAmount * priceUsd)}.</b>

<a href="https://solscan.io/tx/${signature}">https://solscan.io/tx/${signature}</a>

Buy with: <a href="https://t.me/MaestroSniperBot?start=${mintAddress}-OxTrackerAIBot">Maestro</a> | <a href="https://t.me/bonkbot_bot?start=ref_0xTrackerAIBot_ca_${mintAddress}">Bonk</a> | <a href="https://t.me/solana_trojanbot?start=r-0xTrackerAIBot-${mintAddress}">Trojan</a>`,
            {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            },
        );
        return;
    }
    if (preAmount >= postAmount + minimumAmount) {
        bot.sendMessage(
            chatId,
            `💳...💰... ➡️
            
<b>A wallet you're tracking (${walletName || formatAddress(address)}) just sent/sold
$${metadata.symbol} worth $${formatCost((preAmount - postAmount) * priceUsd)}.</b>

<a href="https://solscan.io/tx/${signature}">https://solscan.io/tx/${signature}</a>

Buy with: <a href="https://t.me/MaestroSniperBot?start=${mintAddress}-OxTrackerAIBot">Maestro</a> | <a href="https://t.me/bonkbot_bot?start=ref_0xTrackerAIBot_ca_${mintAddress}">Bonk</a> | <a href="https://t.me/solana_trojanbot?start=r-0xTrackerAIBot-${mintAddress}">Trojan</a>`,
            {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            },
        );
    }
};

const startWalletMonitoring = async (
    bot,
    userId,
    chatId,
    address,
    walletName = '',
) => {
    if (!verifyAddress(address) && verifySolanaAddress(address)) {
        const account = await getAccountByUserId(userId);
        const minimumAmount = account.data.Account.MinimumAmount || 0;
        const subscriptionId = SOLANA_CONNECTION.onLogs(
            new PublicKey(address),
            async logs => {
                if (!logs.err && logs.signature) {
                    walletMonitoring(
                        bot,
                        chatId,
                        address,
                        logs.signature,
                        minimumAmount,
                        walletName,
                    );
                }
            },
            'finalized',
        );

        subscriptionIds.push({
            chatId,
            address,
            subscriptionId,
        });
    }
};

const stopWalletMonitoring = (chatId, address) => {
    if (!verifyAddress(address) && verifySolanaAddress(address)) {
        const subscriptionId = subscriptionIds.find(
            subscription =>
                subscription.chatId.toString() === chatId.toString() &&
                subscription.address === address,
        );
        if (subscriptionId) {
            SOLANA_CONNECTION.removeAccountChangeListener(
                subscriptionId.subscriptionId,
            );
        }
    }
};

const calculateRate = (current, previous) => {
    if (!Number(current) && !Number(previous)) return '+0.00%';
    if (!Number(current)) return '-99.99%';
    if (!Number(previous)) return '+0.00%';
    if (Number(current) - Number(previous) >= 0)
        return `+${formatCost(
            ((Number(current) - Number(previous)) / Number(previous)) * 100,
        )}%`;
    return `${formatCost(
        ((Number(current) - Number(previous)) / Number(previous)) * 100,
    )}%`;
};

const calculateProfit = (current, previous) => {
    if (current < previous) {
        return `-$${formatCost(Number(previous) - Number(current))}`;
    }
    return `$${formatCost(Number(current) - Number(previous))}`;
};

const analyzeRate = rate => {
    return Number(rate.slice(0, rate.length - 1));
};

module.exports = {
    sleep,
    verifyAddress,
    verifySolanaAddress,
    getBalance,
    fetchToken,
    fetchSolToken,
    getGasPrice,
    formatAddress,
    formatNumber,
    formatCost,
    getTotalBalance,
    getTotalBalanceOnETH,
    getDateTime,
    caesarEncrypt,
    caesarDecrypt,
    getTimeFormat,
    isValidURL,
    checkIfGroupAdmin,
    startWalletMonitoring,
    stopWalletMonitoring,
    getPreviousPrice,
    calculateRate,
    calculateProfit,
    analyzeRate,
};
