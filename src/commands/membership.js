const {
    requestMembership,
    checkMembershipStatus,
    addLog,
} = require('../api.js');

const { getTimeFormat, formatNumber } = require('../utils.js');

const TOTAL_SUPPLY = 100_000_000;

async function handleMembershipPurchase(bot, chatId, chatType) {
    if (chatType !== 'private') {
        bot.sendMessage(
            chatId,
            `This command is available only in private chat`,
        );
        return;
    }
    const res = await requestMembership(chatId);

    if (
        res &&
        res.data.address &&
        res.data.invoiceId &&
        res.data.price &&
        res.data.percent
    ) {
        bot.sendMessage(
            chatId,
            `To access our premium membership, you have two options:\n\n1. Hold at least <b>${res.data.percent}% (${formatNumber(parseFloat(res.data.percent) * 0.01 * TOTAL_SUPPLY)}) of $TRACK</b> in your wallet. This status will be maintained indefinitely as long as the threshold remains constant and your wallet contains the required amount. To verify your eligibility, please send at least $2 worth of ETH to the following wallet address:\n <code>${res.data.address}</code>
            \n2. Alternatively, you can opt for a 30-day premium subscription by sending <b>${res.data.price} ETH (ERC20)</b> to the same wallet address:\n <code>${res.data.address}</code>
            \nFor a comprehensive overview of the premium membership benefits, please refer to the information provided in our <a href="https://tracker-ai.gitbook.io/tracker-ai-whitepaper/commands-and-utilization-of-the-bot/premium-features">whitepaper.</a>`,
            {
                parse_mode: 'HTML',
            },
        );
        addLog(chatId, 'premium', '', '');
    }
}

async function handleMembershipCheck(bot, chatId, userId) {
    const res = await checkMembershipStatus(userId);
    if (res.data.premium?.premium) {
        if (res.data.premium?.tokenHolder) {
            bot.sendMessage(
                chatId,
                `Congratulations! Your wallet has been verified as holding at least <b>${res.data.percent}% of $TRACK</b>. Welcome to our premium membership club. Get ready to make non-holders jealous 😉.`,
                {
                    parse_mode: 'HTML',
                },
            );
        } else if (
            res.data.premiumDate &&
            new Date(res.data.premiumDate).getTime() > new Date().getTime()
        ) {
            bot.sendMessage(
                chatId,
                `Payment successfully verified.\nYour premium membership expires on ${getTimeFormat(new Date(res.data.premiumDate).getTime())}`,
                {
                    parse_mode: 'HTML',
                },
            );
        }
    } else if (res.data.premium?.tokenExpired) {
        bot.sendMessage(
            chatId,
            'It appears that your wallet no longer meets the required holding threshold for premium membership 😭. You have lost your premium status. We hope to welcome you back soon as a premium member. 🤗',
        );
    } else if (res.data.premium?.premiumExpired) {
        bot.sendMessage(
            chatId,
            'Your premium membership has expired. To regain access, please use the /premium command.',
        );
    } else {
        bot.sendMessage(
            chatId,
            `You’re a basic user, to become a premium member, use the /premium command`,
        );
    }
    addLog(chatId, 'premiumCheck', '', '');
}

module.exports = {
    handleMembershipPurchase,
    handleMembershipCheck,
};
