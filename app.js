const tg = window.Telegram.WebApp;

tg.ready();
tg.expand();

const addButton = document.getElementById("addReminder");
const remindersContainer = document.getElementById("reminders");

addButton.addEventListener("click", () => {
    showReminderForm();
});

function showReminderForm() {
    remindersContainer.innerHTML = `
        <div class="reminder-form">
            <input
                type="text"
                id="reminderText"
                placeholder="Что напомнить?"
            >

            <input
                type="date"
                id="reminderDate"
            >

            <input
                type="time"
                id="reminderTime"
            >

            <button id="saveReminder">
                Сохранить напоминание
            </button>
        </div>
    `;

    addButton.style.display = "none";

    const saveButton = document.getElementById("saveReminder");

    saveButton.addEventListener("click", saveReminder);
}

function saveReminder() {
    const text = document.getElementById("reminderText").value;
    const date = document.getElementById("reminderDate").value;
    const time = document.getElementById("reminderTime").value;

    if (!text || !date || !time) {
        tg.showAlert("Заполни все поля");
        return;
    }

    const reminder = {
        text: text,
        date: date,
        time: time
    };

    console.log("Новое напоминание:", reminder);

    showCreatedReminder(reminder);
}

function showCreatedReminder(reminder) {
    remindersContainer.innerHTML = `
        <div class="reminder-card">
            <div class="reminder-text">
                🔔 ${reminder.text}
            </div>

            <div class="reminder-date">
                ${reminder.date} в ${reminder.time}
            </div>
        </div>
    `;

    addButton.style.display = "block";
}
