const {
    getAvailableDates,
    handleAdvertPayment,
    checkIfAdmin,
    getAdByUser,
    updateAdText,
    updateAdImage,
    getAllAccounts,
    addLog,
} = require('../api.js');
const store = require('../store.js');

const { isValidURL, sleep } = require('../utils.js');

const advertPrefix = 'advert';

async function handleAdvert(bot, chatId) {
    const datesRes = await getAvailableDates();
    const { dates, price } = datesRes.data;
    const message = `
    <b>Tracker AI automated Ad System</b>\n
You can reserve ad space through this form, which will be showcased below all wallet scans and during portfolio tracking sessions.\n
Please choose a date for your ad to be displayed. Ads will be active from 00:00 UTC to 23:59 UTC on the selected date. Date format is dd/mm/yy.\n
If you book an ad on a date that has already commenced, it will be immediately displayed and run until 23:59 UTC on the same day.\n
A maximum of 6 ads can be reserved per day, and each ad will be equally rotated for display.\n
<b>Cost per day for ad: ${price} ETH</b>\n
<b>Ads promoting scams, sexually explicit content, or tokens associated with gambling, alcohol, or drugs will be promptly removed, and the user will be blacklisted from future advertisement bookings.</b>\n
<i>Please be aware that we have a strict no-refund policy.</i>`;
    const buttons = [
        [
            {
                text: `\u2003\u2003${dates[0]}\u2003\u2003`,
                callback_data: `${advertPrefix}_${dates[0]}`,
            },
            {
                text: `\u2003\u2003${dates[1]}\u2003\u2003`,
                callback_data: `${advertPrefix}_${dates[1]}`,
            },
            {
                text: `\u2003\u2003${dates[2]}\u2003\u2003`,
                callback_data: `${advertPrefix}_${dates[2]}`,
            },
        ],
        [
            {
                text: `\u2003\u2003${dates[3]}\u2003\u2003`,
                callback_data: `${advertPrefix}_${dates[3]}`,
            },
            {
                text: `\u2003\u2003${dates[4]}\u2003\u2003`,
                callback_data: `${advertPrefix}_${dates[4]}`,
            },
            {
                text: `\u2003\u2003${dates[5]}\u2003\u2003`,
                callback_data: `${advertPrefix}_${dates[5]}`,
            },
        ],
        [
            {
                text: `\u2003\u2003${dates[6]}\u2003\u2003`,
                callback_data: `${advertPrefix}_${dates[6]}`,
            },
        ],
    ];

    bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: buttons,
        },
    });
    addLog(chatId, 'advert', '', '');
}

const handleAdminAds = async (bot, chatId, userId) => {
    try {
        const adminIf = await checkIfAdmin(userId);
        if (!adminIf.data.adminIf) {
            bot.sendMessage(chatId, `You're not allowed to set advert`);
        } else {
            const Advert = await getAdByUser(userId);
            const buttons = [
                [
                    {
                        text: 'Update Text',
                        callback_data: `${advertPrefix}_text`,
                    },
                    {
                        text: 'Update Image/Video',
                        callback_data: `${advertPrefix}_image`,
                    },
                ],
            ];
            if (!Advert.data.Ad) {
                bot.sendMessage(chatId, `You do not have advert template`, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: buttons,
                    },
                });
            } else if (Advert.data.Ad.Url) {
                if (Advert.data.Ad.MediaType === 'image') {
                    bot.sendPhoto(chatId, Advert.data.Ad.Url, {
                        caption: Advert.data.Ad.Text,
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: buttons,
                        },
                    });
                } else {
                    bot.sendVideo(chatId, Advert.data.Ad.Url, {
                        caption: Advert.data.Ad.Text,
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: buttons,
                        },
                    });
                }
            } else {
                bot.sendMessage(chatId, Advert.data.Ad.Text, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: buttons,
                    },
                });
            }
            addLog(chatId, 'adminAd', '', '');
        }
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
    }
};

const HandleSendAdminAd = async (bot, chatId, userId) => {
    try {
        const adminIf = await checkIfAdmin(userId);
        if (!adminIf.data.adminIf) {
            bot.sendMessage(chatId, `You're not allowed to set advert`);
        } else {
            const Advert = await getAdByUser(userId);
            if (Advert.data.Ad && (Advert.data.Ad.Text || Advert.data.Ad.Url)) {
                const Accounts = await getAllAccounts();
                let iteration = 0;
                // eslint-disable-next-line no-restricted-syntax
                for (const account of Accounts.Accounts) {
                    const userChatId = account.AccountId;
                    if (Advert.data.Ad.Url) {
                        if (Advert.data.Ad.MediaType === 'image') {
                            bot.sendPhoto(userChatId, Advert.data.Ad.Url, {
                                caption: Advert.data.Ad.Text,
                                parse_mode: 'HTML',
                            });
                        } else {
                            bot.sendVideo(userChatId, Advert.data.Ad.Url, {
                                caption: Advert.data.Ad.Text,
                                parse_mode: 'HTML',
                            });
                        }
                    } else {
                        bot.sendMessage(userChatId, Advert.data.Ad.Text, {
                            parse_mode: 'HTML',
                        });
                    }

                    iteration += 1;
                    if (iteration >= 20) {
                        // eslint-disable-next-line no-await-in-loop
                        await sleep(10000);
                        iteration = 0;
                    }
                }
                bot.sendMessage(chatId, `Successfully Sent Ads`, {
                    parse_mode: 'HTML',
                });
                addLog(chatId, 'sendAdminAd', '', '');
            } else {
                bot.sendMessage(
                    chatId,
                    `You do not have Ad template, please set it using /handleAdminAds`,
                    {
                        parse_mode: 'HTML',
                    },
                );
            }
        }
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
    }
};

const handleAdvertCallbacks = bot => {
    bot.on('callback_query', async query => {
        const { message, data } = query;
        try {
            if (data.includes(advertPrefix)) {
                const date = data.replace(`${advertPrefix}_`, '');
                switch (date) {
                    case 'text': {
                        await bot.sendMessage(
                            message.chat.id,
                            `Type the text to send DM to users`,
                        );

                        store.setCurrentPrompt('textAdvertPrompt', {
                            date,
                        });
                        break;
                    }
                    case 'image': {
                        await bot.sendMessage(
                            message.chat.id,
                            `Upload image/video to send DM to users`,
                        );

                        store.setCurrentPrompt('imageAdvertPrompt', {
                            date,
                        });
                        break;
                    }
                    default: {
                        await bot.sendMessage(
                            message.chat.id,
                            `You selected ${date}\nPlease enter the text you'd like to be displayed in your advert. Maximum character accepted is 150. Custom emojis are not allowed.`,
                        );

                        store.setCurrentPrompt('userAdvertPrompt', {
                            date,
                        });
                    }
                }
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
        }
    });

    // bot.on('photo', async (msg) => {
    //     const chatId = msg.chat.id;
    //     const photoId = msg.photo[0].file_id; // Get the file ID of the photo
    //     const fileName = `${photoId}.jpg`; // Define the filename
    //     console.log('file nme--', fileName);

    //     bot.sendPhoto(chatId, photoId, { caption: 'test' });

    // // Download the photo to the server
    // const filePath = `../images/${fileName}`;
    // const fileStream = fs.createWriteStream(filePath);
    // axios.get(fileUrl, (response) => {
    //     response.pipe(fileStream);
    //     fileStream.on('error', (error) => {
    //         console.error('Error writing file:', error);
    //     });
    //     fileStream.on('finish', () => {
    //         console.log('File saved successfully:', fileName);
    //         // Send a confirmation message to the user
    //         bot.sendMessage(chatId, 'Image received and saved successfully!');
    //     });
    // });
    // })
};

const handleAdvertPrompt = bot => {
    bot.on('message', async message => {
        const chatId = message.chat.id;
        const advert = message.text;
        const chatType = message.chat.type;

        const currentPrompt = store.getCurrentPrompt();

        if (
            !(
                currentPrompt.prompt === 'textAdvertPrompt' ||
                currentPrompt.prompt === 'imageAdvertPrompt' ||
                currentPrompt.prompt === 'userAdvertPrompt' ||
                currentPrompt.prompt === 'urlAdvertPrompt'
            ) ||
            !currentPrompt.data
        )
            return;

        if (currentPrompt.prompt === 'textAdvertPrompt') {
            if (advert.length > 1024) {
                bot.sendMessage(
                    chatId,
                    `The Text length is too long(Max 1024), please try again using /handleAdminAd. To end these prompts, type /end.`,
                );
                return;
            }

            await updateAdText(chatId, advert);
            bot.sendMessage(chatId, `Successfully updated Ad text`);
            addLog(chatId, 'updateTextAd', '', chatType);
            store.clearCurrentPrompt();
        } else if (currentPrompt.prompt === 'imageAdvertPrompt') {
            let url = null;
            let mediaType = '';

            if (message.photo && message.photo[0].file_id) {
                mediaType = 'image';
                url = message.photo[0].file_id;
            }
            if (message.video && message?.video.file_id) {
                mediaType = 'video';
                url = message.video.file_id;
            }

            await updateAdImage(chatId, url, mediaType);
            bot.sendMessage(chatId, `Successfully updated Ad Image/Video`);
            addLog(chatId, 'updateImageAd', '', chatType);
            store.clearCurrentPrompt();
        } else if (currentPrompt.prompt === 'userAdvertPrompt') {
            const date = currentPrompt.data?.date;

            if (advert.length > 150) {
                bot.sendMessage(
                    chatId,
                    `The Text length is too long(Max 150), please try again using /advert. To end these prompts, type /end.`,
                );
                return;
            }

            await bot.sendMessage(chatId, 'Please enter Url');

            store.setCurrentPrompt('urlAdvertPrompt', {
                date,
                text: advert,
            });
        } else if (currentPrompt.prompt === 'urlAdvertPrompt') {
            const text = currentPrompt.data?.text;
            const date = currentPrompt.data?.date;
            if (isValidURL(advert)) {
                const invoice = await handleAdvertPayment(
                    chatId,
                    text,
                    advert,
                    date,
                );
                if (
                    invoice.data.address &&
                    invoice.data.invoiceId &&
                    invoice.data.price
                ) {
                    bot.sendMessage(
                        chatId,
                        `Please send ${invoice.data.price} ETH to this address:\n<code>${invoice.data.address}</code>`,
                        {
                            parse_mode: 'HTML',
                        },
                    );
                    addLog(chatId, 'userAd', '', chatType);
                    store.clearCurrentPrompt();
                }
            } else {
                bot.sendMessage(
                    chatId,
                    `The URL is not valid, please try again using /advert. To end these prompts, type /end.`,
                );
            }
        }
    });
};

module.exports = {
    handleAdvert,
    handleAdvertCallbacks,
    handleAdminAds,
    HandleSendAdminAd,
    handleAdvertPrompt,
};
