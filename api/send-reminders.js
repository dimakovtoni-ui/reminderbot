// Vercel cron endpoint: sends due reminders through Telegram and marks them as sent.
// Cron schedule is configured in vercel.json.
export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const cronSecret = process.env.CRON_SECRET;

    if (!supabaseUrl || !supabaseKey || !botToken || !cronSecret) {
        return res.status(500).json({
            error: "Server is not fully configured",
            hasSupabaseUrl: Boolean(supabaseUrl),
            hasSupabaseServiceRoleKey: Boolean(supabaseKey),
            hasTelegramBotToken: Boolean(botToken),
            hasCronSecret: Boolean(cronSecret)
        });
    }

    const authHeader = req.headers.authorization || "";
    if (authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: "Unauthorized" });
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

        const results = [];

        for (const reminder of reminders) {
            const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: reminder.telegram_id,
                    text: `🔔 Напоминание\n\n${reminder.text}`
                })
            });

            const telegramData = await telegramResponse.json().catch(() => null);

            if (!telegramResponse.ok || !telegramData?.ok) {
                console.error("Telegram send error:", {
                    reminderId: reminder.id,
                    status: telegramResponse.status,
                    description: telegramData?.description
                });
                results.push({ id: reminder.id, sent: false, error: telegramData?.description || "Telegram error" });
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
                results.push({ id: reminder.id, sent: true, marked: false });
                continue;
            }

            results.push({ id: reminder.id, sent: true, marked: true });
        }

        return res.status(200).json({
            success: true,
            checkedAt: now,
            due: reminders.length,
            sent: results.filter((item) => item.sent).length,
            results
        });
    } catch (error) {
        console.error("Send reminders error:", error);
        return res.status(500).json({ error: "Server error" });
    }
}
