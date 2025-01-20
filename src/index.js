const TelegramBot = require('node-telegram-bot-api');
const { TOKEN } = require('./config.js');
const { addErrorLog, addAccount } = require('./api.js');
const {
    getTagStats,
    handleTagPrompt,
    handleCallbackQuery,
} = require('./commands/latestStats.js');

const {
    scanWallet,
    handleScanCallbacks,
    handlePortfolio,
    handleGetGasPrice,
    handlePortfolioCallbacks,
    handleScanPrompt,
} = require('./commands/scan.js');
const {
    handleProfitAndLoss,
    handleProfitAndLossAll,
    handleProfitAndLossCallbacks,
    handleProfitAndLossPrompt,
    // handleProfitAndLossAllCallbacks,
} = require('./commands/pnl.js');
const {
    getMyWallets,
    getStalkedWallets,
    manageWallets,
    handleManageCallbacks,
    handleStats,
    handleGroups,
    handlePremiumGroup,
    handleManagePrompt,
} = require('./commands/manage.js');
const {
    handleSetting,
    handleSettingCallbacks,
    handleHelp,
    handleStart,
    handleReferralLink,
    handleReferralLeaderboard,
    handleReferralCount,
    handleSettingPrompt,
    handleUserActivityLeaderboard,
    handleGroupActivityLeaderboard,
} = require('./commands/settings.js');
const {
    handleMembershipPurchase,
    handleMembershipCheck,
} = require('./commands/membership.js');
const { verifyAddress, verifySolanaAddress } = require('./utils.js');
const {
    handleAdvert,
    handleAdvertCallbacks,
    handleAdminAds,
    HandleSendAdminAd,
    handleAdvertPrompt,
} = require('./commands/advert.js');
const {
    handleUserBaseChart,
    handleWalletScanChart,
    handleChartCallback,
    handlePortfolioChart,
    handleProfitChart,
    handleActivityChart,
    handleChartPrompt,
} = require('./commands/chart.js');
const {
    xTrack,
    xTrackUser,
    xTrackHashtag,
    handleXTrackTagMessages,
    handleXTrackUserMessages,
    handleXTrackCallbacks,
    handleXTrackHashtagCallbacks,
    manageXTracking,
    handleManageXTrackingCallbacks,
    handleMostTracked,
} = require('./commands/xtrack.js');
const {
    xPost,
    handleXPostUserMessages,
    xPostUser,
} = require('./commands/xpost.js');
const { requestOTP } = require('./commands/auth.js');
const store = require('./store.js');

const bot = new TelegramBot(TOKEN, { polling: true });
const managingStatus = {};
const updateManagingStatus = (accountId, status) => {
    managingStatus[accountId] = status;
};

process.on('unhandledRejection', (reason, p) => {
    // eslint-disable-next-line no-console
    console.error('Unhandled Rejection at:', p, 'reason:', reason);
    addErrorLog(`Unhandled Rejection at: ${p}. reason: ${reason}`).catch(
        // eslint-disable-next-line no-console
        console.log,
    );
});

bot.on('message', async msg => {
    try {
        if (msg.new_chat_participant || msg.left_chat_participant) {
            handleGroups(msg);
            return;
        }

        const userId = msg.from.id;
        const chatId = msg.chat.id;
        const chatType = msg.chat.type;
        let username =
            msg.chat?.title ||
            msg.chat?.username ||
            `${msg.chat?.first_name || ''} ${msg.chat?.last_name || ''}`;
        username = username.replaceAll('<', '').replaceAll('>', '');

        const { text } = msg;

        if (!text) return;

        let COMMANDS = '';
        let PAYLOAD = '';

        if (chatType === 'group' || chatType === 'supergroup') {
            const [command, payload] = text.split(' ');
            PAYLOAD = payload;

            if (command.includes('@')) {
                const [commands, botName] = command.split('@');
                const botInfo = await bot.getMe();
                if (botInfo.username !== botName) return;
                COMMANDS = commands.toUpperCase();
            } else {
                COMMANDS = command.toUpperCase();
            }
        } else {
            const [commands, payload] = text.split(' ');
            COMMANDS = commands.toUpperCase();
            PAYLOAD = payload;
        }

        if (msg.entities && msg.entities[0].type === 'bot_command') {
            store.clearCurrentPrompt();
            if (COMMANDS === '/START') {
                await addAccount(chatId, chatType, username, PAYLOAD);
            } else {
                await addAccount(chatId, chatType, username);
            }
        }

        const isAddress =
            (await verifyAddress(text)) || verifySolanaAddress(text);

        if (chatType === 'private' && isAddress && !managingStatus[userId]) {
            scanWallet(bot, userId, chatId, chatType, text);
            return;
        }

        switch (COMMANDS) {
            case '/XTRACK':
                if (!PAYLOAD) {
                    await xTrack(bot, userId, chatId, chatType);
                    break;
                }
                {
                    const payloadStart = PAYLOAD[0];
                    const payloadBody = PAYLOAD.replace(payloadStart, '');
                    if (payloadBody === '') {
                        bot.sendMessage(
                            chatId,
                            'Invalid payload body. The body must not contain spaces after the special character (@/#/$)',
                        );
                        break;
                    }
                    switch (payloadStart) {
                        case '#':
                        case '$':
                            xTrackHashtag(
                                bot,
                                userId,
                                chatId,
                                chatType,
                                PAYLOAD,
                            );
                            break;
                        case '@':
                            xTrackUser(bot, userId, chatId, chatType, PAYLOAD);
                            break;
                        default:
                            bot.sendMessage(
                                chatId,
                                'Invalid tracking argument, tracking argument should start with @/#/$',
                            );
                            break;
                    }
                }
                break;
            case '/XPOST':
                if (!PAYLOAD) {
                    await xPost(bot, userId, chatId, chatType);
                    break;
                }
                {
                    const payloadStart = PAYLOAD[0];
                    const payloadBody = PAYLOAD.replace(payloadStart, '');
                    if (payloadBody === '') {
                        bot.sendMessage(
                            chatId,
                            'Invalid payload body. The body must not contain spaces after the special character (@)',
                        );
                        break;
                    }
                    switch (payloadStart) {
                        case '@':
                            xPostUser(bot, userId, chatId, chatType, PAYLOAD);
                            break;
                        default:
                            bot.sendMessage(
                                chatId,
                                'Invalid tracking argument, tracking argument should start with @',
                            );
                            break;
                    }
                }
                break;
            case '/MANAGETRACKING':
                manageXTracking(bot, chatId, userId, chatType);
                break;
            case '/MOSTTRACKED':
                handleMostTracked(bot, chatId);
                break;
            case '/SCAN':
                if (PAYLOAD) {
                    scanWallet(bot, userId, chatId, chatType, PAYLOAD);
                } else {
                    bot.sendMessage(
                        chatId,
                        'Invalid Address, Please type as /scan {address}',
                    );
                }
                break;
            case '/MYWALLETS':
                getMyWallets(bot, userId, chatId, chatType);
                break;
            case '/STALKEDWALLETS':
                getStalkedWallets(bot, userId, chatId, chatType);
                break;
            case '/MANAGEWALLETS':
                manageWallets(bot, chatId, chatType);
                break;
            case '/MYPORTFOLIO':
                handlePortfolio(bot, chatId, userId, chatType);
                break;
            case '/GAS':
                handleGetGasPrice(bot, chatId);
                break;
            case '/STATS':
                handleStats(bot, chatId, userId);
                break;
            case '/SETTINGS':
                handleSetting(bot, chatId, userId, chatType);
                break;
            case '/HELP':
                handleHelp(bot, chatId, chatType);
                break;
            case '/START':
                handleStart(bot, chatId, userId, chatType);
                break;
            case '/REFERRAL':
                handleReferralLink(bot, chatId, username, chatType);
                break;
            case '/REFERRALLEADERBOARD':
                handleReferralLeaderboard(bot, chatId);
                break;
            case '/REFERRALCOUNT':
                handleReferralCount(bot, chatId, username, chatType);
                break;
            case '/USERACTIVITYLEADERBOARD':
                handleUserActivityLeaderboard(bot, chatId);
                break;
            case '/GROUPACTIVITYLEADERBOARD':
                handleGroupActivityLeaderboard(bot, chatId);
                break;
            case '/PREMIUM':
                handleMembershipPurchase(bot, chatId, chatType);
                break;
            case '/MEMBERSHIPSTATUS':
                handleMembershipCheck(bot, chatId, userId);
                break;
            case '/ADVERT':
                handleAdvert(bot, chatId);
                break;
            case '/HANDLEADMINAD':
                handleAdminAds(bot, chatId, userId);
                break;
            case '/SENDADMINAD':
                HandleSendAdminAd(bot, chatId, userId);
                break;
            case '/PNLALL':
                handleProfitAndLossAll(bot, chatId, userId, chatType);
                break;
            case '/PNL': {
                handleProfitAndLoss(bot, chatId, userId, chatType, PAYLOAD);
                break;
            }
            case '/PREMIUMGROUP': {
                handlePremiumGroup(bot, chatId, userId, chatType);
                break;
            }
            case '/USERBASECHART': {
                handleUserBaseChart(bot, chatId, userId);
                break;
            }
            case '/SCANSCHART': {
                handleWalletScanChart(bot, chatId, userId);
                break;
            }
            case '/ACTIVITYCHART': {
                handleActivityChart(bot, chatId, userId);
                break;
            }
            case '/PORTFOLIOCHART': {
                handlePortfolioChart(bot, chatId, userId, chatType);
                break;
            }
            case '/PROFITCHART': {
                handleProfitChart(bot, chatId, userId, chatType);
                break;
            }
            case '/OTP': {
                requestOTP(bot, chatId, userId, username, chatType);
                break;
            }
            case '/END': {
                store.clearCurrentPrompt();
                break;
            }
            case '/HASHTAGSTATS':
            case '/CASHTAGSTATS': {
                getTagStats(bot, msg, chatType);
                break;
            }

            default:
        }
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
    }
});

handleScanCallbacks(bot);
handlePortfolioCallbacks(bot);
handleManageCallbacks(bot, updateManagingStatus);
handleSettingCallbacks(bot);
handleAdvertCallbacks(bot);
// handleProfitAndLossAllCallbacks(bot);
handleProfitAndLossCallbacks(bot);
handleChartCallback(bot);

handleXTrackHashtagCallbacks(bot);
handleXTrackTagMessages(bot);

handleXTrackCallbacks(bot);
handleXTrackUserMessages(bot);
handleXPostUserMessages(bot);
handleManageXTrackingCallbacks(bot);

handleScanPrompt(bot);
handleSettingPrompt(bot);
handleProfitAndLossPrompt(bot);
handleManagePrompt(bot, updateManagingStatus);
handleChartPrompt(bot);
handleAdvertPrompt(bot);
handleTagPrompt(bot);
handleCallbackQuery(bot);

module.exports = {
    bot,
};
