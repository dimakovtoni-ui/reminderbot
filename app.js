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


// --------------------
// ВКЛАДКИ
// --------------------

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


// --------------------
// СОЗДАНИЕ
// --------------------

saveButton.addEventListener("click", () => {
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

    const reminder = {
        id: Date.now(),
        text: text,
        date: date,
        time: time
    };

    const reminders = getReminders();

    reminders.push(reminder);

    localStorage.setItem(
        "reminders",
        JSON.stringify(reminders)
    );

    // очищаем форму
    textInput.value = "";
    dateInput.value = "";
    timeInput.value = "";

    showMessage("Напоминание создано 🔔");

    // сразу переходим в список
    showRemindersPage();
});


// --------------------
// ПОЛУЧЕНИЕ ИЗ ПАМЯТИ
// --------------------

function getReminders() {
    try {
        const saved = localStorage.getItem("reminders");

        if (!saved) {
            return [];
        }

        const reminders = JSON.parse(saved);

        return Array.isArray(reminders)
            ? reminders
            : [];

    } catch (error) {
        console.error("Ошибка чтения напоминаний:", error);
        return [];
    }
}


// --------------------
// ПОКАЗ СПИСКА
// --------------------

function renderReminders() {
    const remindersList =
        document.getElementById("remindersList");

    const reminders = getReminders();

    if (reminders.length === 0) {
        remindersList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔔</div>

                <h2>Напоминаний пока нет</h2>

                <p>
                    Создай первое напоминание,
                    и оно появится здесь
                </p>
            </div>
        `;

        return;
    }

    reminders.sort((a, b) => {
        const first =
            new Date(`${a.date}T${a.time}`);

        const second =
            new Date(`${b.date}T${b.time}`);

        return first - second;
    });

    remindersList.innerHTML =
        reminders.map(reminder => `
            <div class="reminder-card">

                <div class="reminder-info">

                    <div class="reminder-text">
                        ${escapeHtml(reminder.text)}
                    </div>

                    <div class="reminder-date">
                        ${formatDate(reminder.date)}
                        ·
                        ${reminder.time}
                    </div>

                </div>

                <button
                    class="delete-button"
                    data-id="${reminder.id}"
                >
                    ×
                </button>

            </div>
        `).join("");

    document
        .querySelectorAll(".delete-button")
        .forEach(button => {

            button.addEventListener("click", () => {

                const id =
                    Number(button.dataset.id);

                deleteReminder(id);
            });

        });
}


// --------------------
// УДАЛЕНИЕ
// --------------------

function deleteReminder(id) {
    let reminders = getReminders();

    reminders =
        reminders.filter(reminder =>
            reminder.id !== id
        );

    localStorage.setItem(
        "reminders",
        JSON.stringify(reminders)
    );

    renderReminders();
}


// --------------------
// ДАТА
// --------------------

function formatDate(dateString) {
    const date =
        new Date(dateString + "T00:00:00");

    return date.toLocaleDateString(
        "ru-RU",
        {
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );
}


// --------------------
// БЕЗОПАСНЫЙ ВЫВОД ТЕКСТА
// --------------------

function escapeHtml(text) {
    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


// --------------------
// СООБЩЕНИЯ
// --------------------

function showMessage(message) {
    if (tg && typeof tg.showAlert === "function") {
        tg.showAlert(message);
    } else {
        alert(message);
    }
}
