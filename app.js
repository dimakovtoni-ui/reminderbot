const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
}

const createTab = document.getElementById("createTab");
const myRemindersTab = document.getElementById("myRemindersTab");
const createPage = document.getElementById("createPage");
const remindersPage = document.getElementById("remindersPage");
const saveButton = document.getElementById("saveReminder");

createTab.addEventListener("click", showCreatePage);
myRemindersTab.addEventListener("click", showRemindersPage);

function showCreatePage() {
    createPage.classList.remove("hidden");
    remindersPage.classList.add("hidden");

    createTab.classList.add("active");
    myRemindersTab.classList.remove("active");
}

function showRemindersPage() {
    createPage.classList.add("hidden");
    remindersPage.classList.remove("hidden");

    createTab.classList.remove("active");
    myRemindersTab.classList.add("active");

    renderReminders();
}

saveButton.addEventListener("click", async () => {
    const textInput = document.getElementById("reminderText");
    const dateInput = document.getElementById("reminderDate");
    const timeInput = document.getElementById("reminderTime");

    const text = textInput.value.trim();
    const date = dateInput.value;
    const time = timeInput.value;

    if (!text || !date || !time) {
        showMessage("Заполни все поля");
        return;
    }

    const telegramId = tg?.initDataUnsafe?.user?.id;

    if (!telegramId) {
        showMessage("Открой приложение через Telegram-бота");
        return;
    }

    const remindAt = new Date(`${date}T${time}:00`).toISOString();

    saveButton.disabled = true;
    saveButton.textContent = "Сохраняю...";

    try {
        const response = await fetch("/api/create-reminder", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                telegram_id: telegramId,
                text,
                remind_at: remindAt
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Ошибка создания напоминания:", data);
            showMessage(data?.error || "Не удалось сохранить напоминание");
            return;
        }

        const reminder = {
            id: data?.reminder?.id ?? Date.now(),
            text,
            date,
            time
        };

        const reminders = getReminders();
        reminders.push(reminder);
        localStorage.setItem("reminders", JSON.stringify(reminders));

        textInput.value = "";
        dateInput.value = "";
        timeInput.value = "";

        showMessage("Умница, солнышко, напоминание скоро придет тебе ❤️");
        showRemindersPage();
    } catch (error) {
        console.error("Ошибка сети:", error);
        showMessage("Не удалось связаться с сервером");
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Создать напоминание ♥";
    }
});

function getReminders() {
    try {
        const saved = localStorage.getItem("reminders");

        if (!saved) {
            return [];
        }

        const reminders = JSON.parse(saved);
        return Array.isArray(reminders) ? reminders : [];
    } catch (error) {
        console.error("Ошибка чтения напоминаний:", error);
        return [];
    }
}

function renderReminders() {
    const remindersList = document.getElementById("remindersList");
    const reminders = getReminders();

    if (reminders.length === 0) {
        remindersList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💗</div>
                <h2>Напоминаний пока нет</h2>
                <p>Создай первое напоминание, и оно появится здесь</p>
            </div>
        `;
        return;
    }

    reminders.sort((a, b) => {
        const first = new Date(`${a.date}T${a.time}`);
        const second = new Date(`${b.date}T${b.time}`);
        return first - second;
    });

    remindersList.innerHTML = reminders.map(reminder => `
        <div class="reminder-card">
            <div class="reminder-info">
                <div class="reminder-text">${escapeHtml(reminder.text)}</div>
                <div class="reminder-date">${formatDate(reminder.date)} · ${reminder.time}</div>
            </div>
            <button class="delete-button" data-id="${reminder.id}" aria-label="Удалить напоминание">×</button>
        </div>
    `).join("");

    document.querySelectorAll(".delete-button").forEach(button => {
        button.addEventListener("click", () => {
            const id = Number(button.dataset.id);
            deleteReminder(id);
        });
    });
}

function deleteReminder(id) {
    let reminders = getReminders();
    reminders = reminders.filter(reminder => reminder.id !== id);
    localStorage.setItem("reminders", JSON.stringify(reminders));
    renderReminders();
}

function formatDate(dateString) {
    const date = new Date(dateString + "T00:00:00");

    return date.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function showMessage(message) {
    if (tg && typeof tg.showAlert === "function") {
        tg.showAlert(message);
    } else {
        alert(message);
    }
}
