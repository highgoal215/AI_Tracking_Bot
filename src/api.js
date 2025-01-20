const axios = require('axios');
const { API_URL } = require('./config.js');

async function addWallet(data) {
    // console.log('data---', data);
    const response = await axios.post(`${API_URL}/accounts/addWallet`, data);
    return response.data;
}

async function getAllLogs(startDate, endDate) {
    const response = await axios.get(
        `${API_URL}/admin/getAllLogs?startDate=${startDate}&endDate=${endDate}`,
    );
    return response.data;
}

async function getScanLogs() {
    const response = await axios.get(`${API_URL}/admin/getScanLogs`);
    return response.data;
}

async function getAllAccounts() {
    const response = await axios.get(`${API_URL}/accounts/getAllAccounts`);
    return response.data;
}

async function getAccountsByWallet(wallet) {
    const response = await axios.get(
        `${API_URL}/accounts/getAccountsByWallet?wallet=${wallet}`,
    );
    return response.data;
}

async function getMyWalletsByUserId(accountId) {
    const response = await axios.get(
        `${API_URL}/accounts/getMyWallets?accountId=${accountId}`,
    );
    return response.data;
}

async function getMyStalkedWalletsByUserId(accountId) {
    const response = await axios.get(
        `${API_URL}/accounts/stalkedWallets?accountId=${accountId}`,
    );
    return response.data;
}

async function addLog(accountId, action, wallet, chatType) {
    const mode = process.env.MODE
    if (mode === 'production') return {};
    const response = await axios.post(`${API_URL}/accounts/addLog`, {
        accountId,
        wallet,
        chatType,
        action,
    });
    return response;
}

async function getWalletById(id) {
    const response = await axios.get(
        `${API_URL}/accounts/getWalletById?id=${id}`,
    );
    return response;
}

async function updateWalletUsername({ id, username }) {
    const response = await axios.post(
        `${API_URL}/accounts/updateWalletUsername`,
        {
            id,
            username,
        },
    );
    return response;
}

async function removeWallet(id) {
    const response = await axios.post(`${API_URL}/accounts/removeWallet`, {
        id,
    });
    return response;
}

async function getOTP(userId, username) {
    const response = await axios.get(
        `${API_URL}/accounts/getOTP?accountId=${userId}&username=${username}`,
    );
    return response;
}

async function checkIfAdmin(accountId) {
    const response = await axios.get(
        `${API_URL}/admin/checkIfAdmin?accountId=${accountId}`,
    );
    return response;
}

async function addGroup(chatId, groupName, chatType) {
    const response = await axios.post(`${API_URL}/groups/addGroup`, {
        chatId,
        groupName,
        chatType,
    });
    return response;
}

async function deleteGroup(chatId) {
    const response = await axios.get(
        `${API_URL}/groups/deleteGroup?chatId=${chatId}`,
    );
    return response;
}

async function getStats() {
    const response = await axios.get(`${API_URL}/admin/getStats`);
    return response;
}

async function getAccountByUserId(userId) {
    const response = await axios.get(
        `${API_URL}/accounts/getAccountByUserId?userId=${userId}`,
    );
    return response;
}

async function addAccount(accountId, chatType, username, payload) {
    const response = await axios.post(`${API_URL}/accounts/addAccount`, {
        accountId,
        chatType,
        username,
        payload,
    });
    return response;
}

async function updateChains(userId, chains) {
    const response = await axios.post(`${API_URL}/accounts/updateChains`, {
        userId,
        chains,
    });
    return response;
}

async function updateMinimumAmount(userId, amount) {
    const response = await axios.post(
        `${API_URL}/accounts/updateMinimumAmount`,
        {
            userId,
            amount,
        },
    );
    return response;
}

async function checkIfAccountExist(userId) {
    const response = await axios.get(
        `${API_URL}/accounts/checkIfAccountExist?userId=${userId}`,
    );
    return response;
}

async function checkIfAccountUsernameExist(userId) {
    const response = await axios.get(
        `${API_URL}/accounts/checkIfAccountUsernameExist?userId=${userId}`,
    );
    return response;
}

async function getUserActivityLeaderboard(date) {
    const response = await axios.get(
        `${API_URL}/accounts/getUserActivityLeaderboard?date=${date}`,
    );
    return response;
}

async function getGroupActivityLeaderboard(date) {
    const response = await axios.get(
        `${API_URL}/accounts/getGroupActivityLeaderboard?date=${date}`,
    );
    return response;
}

async function getReferralLeaderboard() {
    const response = await axios.get(
        `${API_URL}/accounts/getReferralLeaderboard`,
    );
    return response;
}

async function getReferralCountByUsername(username) {
    const response = await axios.get(
        `${API_URL}/accounts/getReferralCountByUsername?username=${username}`,
    );
    return response;
}

async function requestMembership(userId) {
    const response = await axios.get(
        `${API_URL}/membership/handleMembership?userId=${userId}`,
    );
    return response;
}

async function checkIfAddableToMine(userId) {
    const response = await axios.get(
        `${API_URL}/accounts/checkIfAddableToMine?accountId=${userId}`,
    );
    return response;
}

async function checkIfScanable(userId) {
    const response = await axios.get(
        `${API_URL}/accounts/checkIfScanable?accountId=${userId}`,
    );
    return response;
}

async function checkIfXHashtagTrackable(userId) {
    const response = await axios.get(
        `${API_URL}/accounts/checkIfXHashtagTrackable?accountId=${userId}`,
    );
    return response;
}

async function checkIfXCashtagTrackable(userId) {
    const response = await axios.get(
        `${API_URL}/accounts/checkIfXCashtagTrackable?accountId=${userId}`,
    );
    return response;
}

async function checkIfXUserTrackable(userId) {
    const response = await axios.get(
        `${API_URL}/accounts/checkIfXUserTrackable?accountId=${userId}`,
    );
    return response;
}

async function checkIfXPostTrackable(userId) {
    const response = await axios.get(
        `${API_URL}/accounts/checkIfXPostTrackable?accountId=${userId}`,
    );
    return response;
}

async function checkIfPremium(userId) {
    const response = await axios.get(
        `${API_URL}/accounts/checkIfPremium?accountId=${userId}`,
    );
    return response;
}

async function checkIfStalkable(userId) {
    const response = await axios.get(
        `${API_URL}/accounts/checkIfStalkable?accountId=${userId}`,
    );
    return response;
}

async function checkMembershipStatus(userId) {
    const response = await axios.get(
        `${API_URL}/membership/checkMembershipStatus?userId=${userId}`,
    );
    return response;
}

async function getBlockedTokensByUserId(userId) {
    const response = await axios.get(
        `${API_URL}/settings/getBlockedTokensByUserId?userId=${userId}`,
    );
    return response;
}

async function updateBlockedTokens(userId, tokens) {
    const response = await axios.post(
        `${API_URL}/settings/updateBlockedTokens`,
        {
            userId,
            tokens,
        },
    );
    return response;
}

async function getAvailableDates() {
    const response = await axios.get(`${API_URL}/adverts/getAvailableDates`);
    return response;
}

async function handleAdvertPayment(userId, text, url, date) {
    const response = await axios.get(
        `${API_URL}/adverts/handleAdvertPayment?userId=${userId}&text=${text}&url=${url}&date=${date}`,
    );
    return response;
}

async function getAds() {
    const response = await axios.get(`${API_URL}/adverts/getAds`);
    return response;
}

async function getAdByUser(userId) {
    const response = await axios.get(
        `${API_URL}/adverts/getAdByUser?userId=${userId}`,
    );
    return response;
}

async function updateAdText(userId, text) {
    const response = await axios.post(`${API_URL}/adverts/updateAdText`, {
        userId,
        text,
    });
    return response;
}

async function updateAdImage(userId, url, mediaType) {
    const response = await axios.post(`${API_URL}/adverts/updateAdImage`, {
        userId,
        url,
        mediaType,
    });
    return response;
}

async function updateGroupPremium(groupId, groupPremiumUser, date) {
    const response = await axios.post(
        `${API_URL}/accounts/updateGroupPremium`,
        {
            groupId,
            groupPremiumUser,
            date,
        },
    );
    return response.data;
}

async function addErrorLog(message) {
    return axios.post(`${API_URL}/errorlogs`, {
        message,
        key: 'yHrMkFi725sQv3RqVxCVEegF8zXbMeT65E8NWypMfcK3vNP9xUrZfkbnpqtcRUfoYVFjc6cfcnDA6aSyX6yNnUKN4eMcGNazmmdvGcZvvDRca5NqPkxavUPwU8VqyBHe',
    });
}

async function sendXAddtrack(chatId, username, trackType) {
    const response = await axios.post(`${API_URL}/twitter/addTrack`, {
        chatId,
        username,
        trackType,
    });
    return response.data;
}

async function sendXtrackHashtag(chatId, threshold, tag, extraFilter) {
    const response = await axios.post(`${API_URL}/twitter/addTrackTag`, {
        chatId,
        threshold,
        tag,
        extraFilter
    });
    return response.data;
}

async function getXTrackUser(accountId) {
    const response = await axios.post(`${API_URL}/twitter/getXTrackUser`, {
        accountId,
    });
    return response;
}

async function deleteXTrackUser(id) {
    const response = await axios.post(`${API_URL}/twitter/deleteXTrackUser`, {
        id,
    });
    return response;
}

async function getXTrackPost(accountId) {
    const response = await axios.post(`${API_URL}/twitter/getXTrackPost`, {
        accountId,
    });
    return response;
}

async function deleteXTrackPost(id) {
    const response = await axios.post(`${API_URL}/twitter/deleteXTrackPost`, {
        id,
    });
    return response;
}

async function getXTrackCashtag(accountId) {
    const response = await axios.post(`${API_URL}/twitter/getXTrackCashtag`, {
        accountId,
    });
    return response;
}

async function deleteXTrackCashtag(id) {
    const response = await axios.post(
        `${API_URL}/twitter/deleteXTrackCashtag`,
        {
            id,
        },
    );
    return response;
}

async function getXTrackHashtag(accountId) {
    const response = await axios.post(`${API_URL}/twitter/getXTrackHashtag`, {
        accountId,
    });
    return response;
}

async function deleteXTrackHashtag(id) {
    const response = await axios.post(
        `${API_URL}/twitter/deleteXTrackHashtag`,
        {
            id,
        },
    );
    return response;
}

async function getXTrackUserLeaderboard() {
    const response = await axios.get(
        `${API_URL}/twitter/getXTrackUserLeaderboard`,
    );
    return response;
}

async function getXTrackCashtagLeaderboard() {
    const response = await axios.get(
        `${API_URL}/twitter/getXTrackCashtagLeaderboard`,
    );
    return response;
}

async function getXTrackHashtagLeaderboard() {
    const response = await axios.get(
        `${API_URL}/twitter/getXTrackHashtagLeaderboard`,
    );
    return response;
}

async function getUserTagStats(data) {
    const response = await axios.post(
        `${API_URL}/twitter/getTopTagUsers`,
        data,
    );
    return response.data;
}

async function handleTagRefresh(data) {
    const response = await axios.post(
        `${API_URL}/twitter/handleTagRefresh`,
        data,
    );
    return response.data;
}

module.exports = {
    addWallet,
    getAccountsByWallet,
    getMyWalletsByUserId,
    getMyStalkedWalletsByUserId,
    getAllLogs,
    getScanLogs,
    addLog,
    getWalletById,
    updateWalletUsername,
    removeWallet,
    checkIfAdmin,
    addGroup,
    deleteGroup,
    getStats,
    getAccountByUserId,
    addAccount,
    updateChains,
    updateMinimumAmount,
    checkIfAccountExist,
    checkIfAccountUsernameExist,
    getUserActivityLeaderboard,
    getGroupActivityLeaderboard,
    getReferralLeaderboard,
    getReferralCountByUsername,
    requestMembership,
    checkIfAddableToMine,
    checkIfScanable,
    checkIfXHashtagTrackable,
    checkIfXCashtagTrackable,
    checkIfXUserTrackable,
    checkIfXPostTrackable,
    checkIfPremium,
    checkIfStalkable,
    checkMembershipStatus,
    getBlockedTokensByUserId,
    updateBlockedTokens,
    getAvailableDates,
    handleAdvertPayment,
    getAds,
    getAdByUser,
    updateAdText,
    updateAdImage,
    getAllAccounts,
    updateGroupPremium,
    addErrorLog,
    getOTP,
    sendXAddtrack,
    sendXtrackHashtag,
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
    getUserTagStats,
    handleTagRefresh,
};
