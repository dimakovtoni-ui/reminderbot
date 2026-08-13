const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadAllTelegramIds(supabaseUrl, supabaseKey) {
    const ids = new Set();
    const pageSize = 1000;
    let offset = 0;

    while (true) {
        const response = await fetch(
            `${supabaseUrl}/rest/v1/reminders?select=telegram_id&telegram_id=not.is.null&order=id.asc&limit=${pageSize}&offset=${offset}`,
            {
                headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`
                }
            }
        );

        const data = await response.json().catch(() => null);

        if (!response.ok || !Array.isArray(data)) {
            throw new Error("Не удалось загрузить пользователей из Supabase");
        }

        for (const row of data) {
            if (row?.telegram_id) ids.add(String(row.telegram_id));
        }

        if (data.length < pageSize) break;
        offset += pageSize;
    }

    return [...ids];
}

async function sendTelegramMessage(botToken, chatId, text) {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            disable_web_page_preview: true
        })
    });

    const data = await response.json().catch(() => null);

    if (response.status === 429 && data?.parameters?.retry_after) {
        await sleep((Number(data.parameters.retry_after) + 1) * 1000);
        return sendTelegramMessage(botToken, chatId, text);
    }

    return {
        ok: response.ok && data?.ok,
        description: data?.description || null
    };
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminSecret = process.env.ADMIN_SECRET;

    if (!supabaseUrl || !supabaseKey || !botToken || !adminSecret) {
        return res.status(500).json({ error: "Админ-рассылка ещё не настроена на сервере" });
    }

    const { secret, text } = req.body || {};

    if (!secret || secret !== adminSecret) {
        return res.status(401).json({ error: "Неверный пароль" });
    }

    if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Сообщение пустое" });
    }

    if (text.trim().length > 3500) {
        return res.status(400).json({ error: "Сообщение слишком длинное" });
    }

    try {
        const users = await loadAllTelegramIds(supabaseUrl, supabaseKey);
        let sent = 0;
        let failed = 0;

        for (const telegramId of users) {
            const result = await sendTelegramMessage(botToken, telegramId, text.trim());

            if (result.ok) sent += 1;
            else failed += 1;

            // Conservative rate: about 20 messages/second.
            await sleep(50);
        }

        return res.status(200).json({
            success: true,
            total: users.length,
            sent,
            failed
        });
    } catch (error) {
        console.error("Broadcast error:", error);
        return res.status(500).json({ error: "Ошибка рассылки" });
    }
}
