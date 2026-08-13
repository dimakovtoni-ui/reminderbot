const secretInput = document.getElementById("adminSecret");
const textInput = document.getElementById("broadcastText");
const sendButton = document.getElementById("sendBroadcast");
const result = document.getElementById("result");
const charCount = document.getElementById("charCount");

textInput.addEventListener("input", () => {
    charCount.textContent = textInput.value.length;
});

sendButton.addEventListener("click", async () => {
    const secret = secretInput.value.trim();
    const text = textInput.value.trim();

    result.classList.add("hidden");

    if (!secret) {
        showResult("Введи пароль администратора.");
        return;
    }

    if (!text) {
        showResult("Напиши сообщение для рассылки.");
        return;
    }

    const confirmed = confirm(`Отправить это сообщение всем пользователям?\n\n${text}`);
    if (!confirmed) return;

    sendButton.disabled = true;
    sendButton.textContent = "Отправляю…";

    try {
        const response = await fetch("/api/broadcast", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ secret, text })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            showResult(data?.error || "Не удалось отправить рассылку.");
            return;
        }

        showResult(`Готово ❤️ Отправлено: ${data.sent}. Не доставлено: ${data.failed}. Всего пользователей: ${data.total}.`);
        textInput.value = "";
        charCount.textContent = "0";
    } catch (error) {
        console.error(error);
        showResult("Ошибка сети. Попробуй ещё раз.");
    } finally {
        sendButton.disabled = false;
        sendButton.textContent = "Отправить всем ♥";
    }
});

function showResult(message) {
    result.textContent = message;
    result.classList.remove("hidden");
}
