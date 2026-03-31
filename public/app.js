// app.js
let ws;

function setupWebSocketCounter() {
    const userCounterEl = document.getElementById("userCounter");
    if (!userCounterEl) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const counterWS = new WebSocket(`${protocol}://${window.location.host}`);

    counterWS.onopen = () => {
        console.log("WebSocket connected for user count");
    };

    counterWS.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "userCount") {
            userCounterEl.innerText = `Users online: ${data.totalUsers}`;
        }
    };

    counterWS.onerror = () => {
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

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${protocol}://${window.location.host}`);

    ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", username }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "match") {
            sessionStorage.setItem('fromWaiting', 'true');
            window.location.href = `chat.html?username=${encodeURIComponent(username)}&partner=${encodeURIComponent(data.username)}`;
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
    const gifInput = document.getElementById("gif-search");
    const gifResults = document.getElementById("gif-results");

    statusDiv.innerText = `${username} is chatting with ${partner}`;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${protocol}://${window.location.host}`);

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
        if (e.key === "Enter") sendBtn.click();
    });

    function appendMessage(sender, text) {
        const message = document.createElement("div");
        message.classList.add("chat-message");
        message.innerHTML = text;
        message.classList.add(sender === "You" ? "right" : "left");
        chatArea.appendChild(message);
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    window.addEventListener('beforeunload', () => {
        sessionStorage.removeItem('fromWaiting');
    });

    const GIPHY_API_KEY = 'uhVSwNC2iCseHNMz92EEIC3SSQg2vsQw';
    gifInput?.addEventListener('input', async function () {
        const query = this.value.trim();
        if (!query) { gifResults.innerHTML = ''; return; }
        try {
            const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=10`);
            const data = await res.json();
            gifResults.innerHTML = '';
            data.data.forEach(gif => {
                const img = document.createElement('img');
                img.src = gif.images.fixed_height_small.url;
                img.style.cursor = 'pointer';
                img.onclick = () => {
                    ws.send(JSON.stringify({ type: "message", text: `<img src='${gif.images.original.url}' class='gif'>` }));
                    appendMessage("You", `<img src='${gif.images.original.url}' class='gif'>`);
                };
                gifResults.appendChild(img);
            });
        } catch (err) { console.error('GIF search failed:', err); }
    });
}

function groupPageLogic() {
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

    const statusDiv = document.getElementById("status");
    const chatArea = document.getElementById("chat");
    const input = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");
    const gifInput = document.getElementById("gif-search");
    const gifResults = document.getElementById("gif-results");

    statusDiv.innerText = `Group Chat - chatting as ${username}`;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${protocol}://${window.location.host}`);

    ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join_group", username }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "group_message") {
            appendMessage(data.from, data.text, false);
        }
        if (data.type === "user_joined") {
            appendJoinNotice(data.username);
        }
        if (data.type === "userCount") {
            const el = document.getElementById("userCounter");
            if (el) el.innerText = `Users online: ${data.totalUsers}`;
        }
    };

    ws.onclose = () => {
        statusDiv.innerText = "Connection closed.";
    };

    sendBtn.onclick = () => {
        const text = input.value.trim();
        if (text === "") return;
        ws.send(JSON.stringify({ type: "group_message", text }));
        appendMessage(username, text, true);
        input.value = "";
    };

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendBtn.click();
    });

    function appendMessage(sender, text, isYou) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("chat-message");
        wrapper.classList.add(isYou ? "right" : "left");

        const nameTag = document.createElement("span");
        nameTag.classList.add("sender-name");
        nameTag.innerText = isYou ? "You" : sender;

        const bubble = document.createElement("div");
        bubble.innerHTML = text;

        wrapper.appendChild(nameTag);
        wrapper.appendChild(bubble);
        chatArea.appendChild(wrapper);
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    function appendJoinNotice(name) {
        const notice = document.createElement("div");
        notice.classList.add("join-notice");
        notice.innerText = `${name} joined the chat`;
        chatArea.appendChild(notice);
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    const GIPHY_API_KEY = 'uhVSwNC2iCseHNMz92EEIC3SSQg2vsQw';
    gifInput?.addEventListener('input', async function () {
        const query = this.value.trim();
        if (!query) { gifResults.innerHTML = ''; return; }
        try {
            const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=10`);
            const data = await res.json();
            gifResults.innerHTML = '';
            data.data.forEach(gif => {
                const img = document.createElement('img');
                img.src = gif.images.fixed_height_small.url;
                img.style.cursor = 'pointer';
                img.onclick = () => {
                    ws.send(JSON.stringify({ type: "group_message", text: `<img src='${gif.images.original.url}' class='gif'>` }));
                    appendMessage(username, `<img src='${gif.images.original.url}' class='gif'>`, true);
                };
                gifResults.appendChild(img);
            });
        } catch (err) { console.error('GIF search failed:', err); }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    setupWebSocketCounter();

    if (window.location.pathname.endsWith("waiting.html")) {
        waitingPageLogic();
    } else if (window.location.pathname.endsWith("chat.html")) {
        chatPageLogic();
    } else if (window.location.pathname.endsWith("group.html")) {
        groupPageLogic();
    } else if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") {
        sessionStorage.setItem('fromIndex', 'true');
    }
});

const toggleGifBtn = document.getElementById("toggle-gif-search");
const gifModal = document.getElementById("gif-modal");
const gifInput = document.getElementById("gif-search");
const gifResults = document.getElementById("gif-results");
const closeGifModal = document.getElementById("close-gif-modal");

toggleGifBtn?.addEventListener("click", () => {
    gifModal.style.display = "block";
    gifInput.focus();
});

closeGifModal?.addEventListener("click", () => {
    gifModal.style.display = "none";
    gifInput.value = "";
    gifResults.innerHTML = "";
});