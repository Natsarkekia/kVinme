// app.js

function setupWebSocketCounter() {
    const userCounterEl = document.getElementById("userCounter");
    if (!userCounterEl) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${protocol}://${window.location.host}`);

    ws.onopen = () => {
        console.log("WebSocket connected for user count");
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "userCount") {
            userCounterEl.innerText = `Users online: ${data.totalUsers}`;
        }
    };

    ws.onerror = () => {
        userCounterEl.innerText = "Users online: unavailable";
    };
}

function waitingPageLogic() {
    if (performance.getEntriesByType("navigation")[0]?.type === "reload") {
        window.location.href = "/";
        return;
    }
    if (!sessionStorage.getItem('fromIndex')) {
        window.location.href = "/";
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get("username");
    if (!username) {
        alert("No username provided. Redirecting...");
        window.location.href = "/";
        return;
    }

    const ws = new WebSocket(`ws://${window.location.host}`);

    ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", username }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "match") {
            // Set flag allowing access to chat.html
            sessionStorage.setItem('fromWaiting', 'true');

            window.location.href = `chat.html?username=${encodeURIComponent(
                username
            )}&partner=${encodeURIComponent(data.username)}`;
        }
    };

    ws.onerror = () => {
        alert("WebSocket error. Try refreshing.");
    };
}

function chatPageLogic() {
    if (performance.getEntriesByType("navigation")[0]?.type === "reload") {
        window.location.href = "/";
        return;
    }

    // Redirect if not coming from waiting page
    if (!sessionStorage.getItem('fromWaiting')) {
        window.location.href = "/";
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get("username");
    const partner = urlParams.get("partner");

    if (!username || !partner) {
        alert("Missing chat info. Please start again.");
        window.location.href = "/";
        return;
    }

    const statusDiv = document.getElementById("status");
    const chatArea = document.getElementById("chat");
    const input = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");

    statusDiv.innerText = `Chatting with ${partner}`;

    const ws = new WebSocket(`ws://${window.location.host}`);

    ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", username }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "message") {
            appendMessage(data.from, data.text);
        }
        if (data.type === "partner_left") {
            window.location.href = "/";
        }
    };

    ws.onclose = () => {
        statusDiv.innerText = "Connection closed.";
    };

    sendBtn.onclick = () => {
        const text = input.value.trim();
        if (text === "") return;
        ws.send(JSON.stringify({ type: "message", text }));
        appendMessage("You", text);
        input.value = "";
    };

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            sendBtn.click();
        }
    });

    function appendMessage(sender, text) {
        const message = document.createElement("div");
        message.classList.add("chat-message");
        message.innerText = text; // removed sender name display
        message.classList.add(sender === "You" ? "right" : "left");
        chatArea.appendChild(message);
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    // Clear access flag when leaving chat page
    window.addEventListener('beforeunload', () => {
        sessionStorage.removeItem('fromWaiting');
    });
}

document.addEventListener("DOMContentLoaded", () => {
    setupWebSocketCounter();

    if (window.location.pathname.endsWith("waiting.html")) {
        waitingPageLogic();
    } else if (window.location.pathname.endsWith("chat.html")) {
        chatPageLogic();
    } else if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") {
        // On main index page, set 'fromIndex' flag
        sessionStorage.setItem('fromIndex', 'true');
    }
});
