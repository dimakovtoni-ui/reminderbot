// External scheduler endpoint: sends due reminders through Telegram and marks them as sent.

const wishes = [
    "Я тобой горжусь ❤️",
    "Ты большая умница 💗",
    "Я тебя очень люблю ❤️",
    "У тебя всё обязательно получится 💕",
    "Ты у меня самая лучшая 💗",
    "Не забывай, какая ты замечательная ❤️",
    "Я верю в тебя, солнышко 💕",
    "Ты справишься, я рядом ❤️",
    "Пусть у тебя сегодня всё получится 💗",
    "Ты делаешь всё намного лучше, чем тебе кажется ❤️"
];

function getRandomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
}

async function loadPhotoUrls() {
    try {
        const response = await fetch(
            "https://api.github.com/repos/dimakovtoni-ui/reminderbot/contents?ref=main",
            {
                headers: {
                    Accept: "application/vnd.github+json",
                    "User-Agent": "reminderbot"
                }
            }
        );

        if (!response.ok) {
            console.error("GitHub photo list error:", response.status);
            return [];
        }

        const files = await response.json();

        if (!Array.isArray(files)) {
            return [];
        }

        return files
            .filter((file) =>
                file?.type === "file" &&
                /\.(jpe?g|png|webp)$/i.test(file?.name || "") &&
                file?.download_url
            )
            .map((file) => file.download_url);
    } catch (error) {
        console.error("GitHub photo loading error:", error);
        return [];
    }
}

async function sendTelegramReminder(botToken, reminder, photoUrls) {
    const wish = getRandomItem(wishes);
    const caption = `Твоё напоминание ❤️\n\n${reminder.text}\n\n${wish}`;

    // If photos are available, send one random photo with the entire reminder as its caption.
    if (photoUrls.length > 0) {
        const photo = getRandomItem(photoUrls);

        const photoResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/sendPhoto`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: reminder.telegram_id,
                    photo,
                    caption
                })
            }
        );

        const photoData = await photoResponse.json().catch(() => null);

        if (photoResponse.ok && photoData?.ok) {
            return { ok: true, data: photoData, usedPhoto: true };
        }

        // If Telegram could not fetch a selected image, fall back to a normal text reminder
        // so the reminder itself is never lost.
        console.error("Telegram sendPhoto error:", {
            reminderId: reminder.id,
            status: photoResponse.status,
            description: photoData?.description,
            photo
        });
    }

    const messageResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: reminder.telegram_id,
                text: caption
            })
        }
    );

    const messageData = await messageResponse.json().catch(() => null);

    return {
        ok: Boolean(messageResponse.ok && messageData?.ok),
        data: messageData,
        status: messageResponse.status,
        usedPhoto: false
    };
}

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!supabaseUrl || !supabaseKey || !botToken) {
        return res.status(500).json({
            error: "Server is not fully configured",
            hasSupabaseUrl: Boolean(supabaseUrl),
            hasSupabaseServiceRoleKey: Boolean(supabaseKey),
            hasTelegramBotToken: Boolean(botToken)
        });
    }

    try {
        const now = new Date().toISOString();
        const query = new URLSearchParams({
            select: "id,telegram_id,text,remind_at",
            sent: "eq.false",
            remind_at: `lte.${now}`,
            order: "remind_at.asc",
            limit: "100"
        });

        const dueResponse = await fetch(`${supabaseUrl}/rest/v1/reminders?${query.toString()}`, {
            headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`
            }
        });

        const dueBody = await dueResponse.text();
        let reminders = [];

        try {
            reminders = dueBody ? JSON.parse(dueBody) : [];
        } catch {
            reminders = [];
        }

        if (!dueResponse.ok) {
            console.error("Supabase select error:", reminders || dueBody);
            return res.status(dueResponse.status).json({ error: "Failed to load reminders" });
        }

        // Read the repository each run, so any new photos uploaded to main are picked up automatically.
        const photoUrls = await loadPhotoUrls();
        const results = [];

        for (const reminder of reminders) {
            const telegramResult = await sendTelegramReminder(botToken, reminder, photoUrls);

            if (!telegramResult.ok) {
                console.error("Telegram send error:", {
                    reminderId: reminder.id,
                    status: telegramResult.status,
                    description: telegramResult.data?.description
                });
                results.push({
                    id: reminder.id,
                    sent: false,
                    error: telegramResult.data?.description || "Telegram error"
                });
                continue;
            }

            const markResponse = await fetch(`${supabaseUrl}/rest/v1/reminders?id=eq.${encodeURIComponent(reminder.id)}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    Prefer: "return=minimal"
                },
                body: JSON.stringify({ sent: true })
            });

            if (!markResponse.ok) {
                const markError = await markResponse.text();
                console.error("Supabase mark-sent error:", { reminderId: reminder.id, markError });
                results.push({
                    id: reminder.id,
                    sent: true,
                    marked: false,
                    usedPhoto: telegramResult.usedPhoto
                });
                continue;
            }

            results.push({
                id: reminder.id,
                sent: true,
                marked: true,
                usedPhoto: telegramResult.usedPhoto
            });
        }

        return res.status(200).json({
            success: true,
            checkedAt: now,
            photoCount: photoUrls.length,
            due: reminders.length,
            sent: results.filter((item) => item.sent).length,
            results
        });
    } catch (error) {
        console.error("Send reminders error:", error);
        return res.status(500).json({ error: "Server error" });
    }
}
