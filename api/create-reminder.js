export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { telegram_id, text, remind_at } = req.body || {};

        if (!telegram_id || !text || !remind_at) {
            return res.status(400).json({ error: "Не хватает данных" });
        }

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: "Supabase не настроен на сервере" });
        }

        const response = await fetch(`${supabaseUrl}/rest/v1/reminders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                Prefer: "return=representation"
            },
            body: JSON.stringify({
                telegram_id,
                text,
                remind_at,
                sent: false
            })
        });

        const bodyText = await response.text();
        let data = null;

        try {
            data = bodyText ? JSON.parse(bodyText) : null;
        } catch {
            data = bodyText;
        }

        if (!response.ok) {
            console.error("Supabase error:", data);
            return res.status(response.status).json({
                error: "Ошибка Supabase",
                details: data
            });
        }

        return res.status(200).json({
            success: true,
            reminder: Array.isArray(data) ? data[0] : data
        });
    } catch (error) {
        console.error("Create reminder error:", error);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
}
