const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const historyList = document.getElementById("historyList");
const newChatBtn = document.getElementById("newChatBtn");

const messagesContainer = document.getElementById("messagesContainer");
const welcomeScreen = document.getElementById("welcomeScreen");
const loadingIndicator = document.getElementById("loadingIndicator");
const messagesEnd = document.getElementById("messagesEnd");
const sendButton = document.getElementById("sendButton");
const chatViewport = document.getElementById("chatViewport");


let currentThreadId = null;
let isGenerating = false;


// =========================================================
// UTILITY FUNCTIONS
// =========================================================

function escapeHtml(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


function renderMarkdown(text) {

    if (!text) {
        return "";
    }

    const rawHtml = marked.parse(text);

    return DOMPurify.sanitize(rawHtml);
}


function scrollToBottom(smooth = true) {

    setTimeout(() => {

        messagesEnd.scrollIntoView({
            behavior: smooth ? "smooth" : "auto",
            block: "end"
        });

    }, 50);
}


function showWelcome() {

    if (messagesContainer.children.length === 0) {

        welcomeScreen.style.display = "block";

    } else {

        welcomeScreen.style.display = "none";

    }
}


function setLoading(loading) {

    isGenerating = loading;

    loadingIndicator.style.display =
        loading ? "block" : "none";

    sendButton.disabled = loading;
    messageInput.disabled = loading;

    if (!loading) {
        messageInput.focus();
    }
}


// =========================================================
// LOAD THREADS
// =========================================================

async function loadThreads() {

    try {

        const response = await fetch("/threads");

        if (!response.ok) {
            throw new Error("Failed to load conversations.");
        }

        const threads = await response.json();

        historyList.innerHTML = "";


        if (threads.length === 0) {

            const emptyMessage =
                document.createElement("div");

            emptyMessage.className =
                "empty-history";

            emptyMessage.textContent =
                "No conversations yet.";

            historyList.appendChild(emptyMessage);

            return;
        }


        threads.forEach(thread => {

            const item =
                document.createElement("div");

            item.className =
                "history-item";


            if (thread.id === currentThreadId) {

                item.classList.add("active");

            }


            // Thread title

            const title =
                document.createElement("button");

            title.type = "button";

            title.className =
                "history-title";

            title.textContent =
                thread.title;

            title.title =
                thread.title;


            title.addEventListener("click", () => {

                switchThread(thread.id);

            });


            // Delete button

            const deleteButton =
                document.createElement("button");

            deleteButton.type = "button";

            deleteButton.className =
                "delete-btn";

            deleteButton.setAttribute(
                "aria-label",
                "Delete conversation"
            );

            deleteButton.innerHTML = `
                <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            `;


            deleteButton.addEventListener(
                "click",
                (event) => {

                    event.stopPropagation();

                    deleteThread(
                        thread.id
                    );

                }
            );


            item.appendChild(title);
            item.appendChild(deleteButton);

            historyList.appendChild(item);

        });


    } catch (error) {

        console.error(
            "Thread loading error:",
            error
        );

    }
}


// =========================================================
// SWITCH THREAD
// =========================================================

async function switchThread(id) {

    if (isGenerating) {
        return;
    }


    try {

        currentThreadId = id;

        welcomeScreen.style.display =
            "none";


        messagesContainer.innerHTML = "";


        const response = await fetch(
            `/threads/${encodeURIComponent(id)}/messages`
        );


        if (!response.ok) {

            throw new Error(
                "Unable to load conversation."
            );

        }


        const messages =
            await response.json();


        messages.forEach(message => {

            addMessageToUI(
                message.role,
                message.content
            );

        });


        await loadThreads();

        scrollToBottom(false);


    } catch (error) {

        console.error(
            "Thread switch error:",
            error
        );

        showErrorMessage(
            "Unable to load this conversation."
        );

    }

}


// =========================================================
// DELETE THREAD
// =========================================================

async function deleteThread(id) {

    if (isGenerating) {
        return;
    }


    try {

        const response = await fetch(
            `/threads/${encodeURIComponent(id)}`,
            {
                method: "DELETE"
            }
        );


        if (!response.ok) {

            throw new Error(
                "Failed to delete conversation."
            );

        }


        if (currentThreadId === id) {

            startNewChat();

        } else {

            await loadThreads();

        }


    } catch (error) {

        console.error(
            "Delete error:",
            error
        );

        showErrorMessage(
            "Unable to delete this conversation."
        );

    }

}


// =========================================================
// START NEW CHAT
// =========================================================

function startNewChat() {

    if (isGenerating) {
        return;
    }


    currentThreadId = null;

    messagesContainer.innerHTML = "";

    welcomeScreen.style.display =
        "block";

    messageInput.value = "";

    loadThreads();

    messageInput.focus();

}


// =========================================================
// ADD MESSAGE TO UI
// =========================================================

function addMessageToUI(role, content) {

    const messageWrapper =
        document.createElement("div");


    messageWrapper.className =
        "message";


    if (role === "user") {

        messageWrapper.classList.add(
            "user-message-style"
        );

    } else {

        messageWrapper.classList.add(
            "ai-message-style"
        );

    }


    const messageText =
        document.createElement("div");


    messageText.className =
        "message-text";


    if (role === "user") {

        messageText.innerHTML =
            escapeHtml(content);

    } else {

        messageText.innerHTML =
            renderMarkdown(content);

    }


    messageWrapper.appendChild(
        messageText
    );


    messagesContainer.appendChild(
        messageWrapper
    );

}


// =========================================================
// ERROR MESSAGE
// =========================================================

function showErrorMessage(message) {

    const errorWrapper =
        document.createElement("div");

    errorWrapper.className =
        "message ai-message-style";


    const errorText =
        document.createElement("div");

    errorText.className =
        "message-text error-message";


    errorText.textContent =
        message;


    errorWrapper.appendChild(
        errorText
    );


    messagesContainer.appendChild(
        errorWrapper
    );


    scrollToBottom();

}


// =========================================================
// TEXTAREA AUTO RESIZE
// =========================================================

function resizeTextarea() {

    messageInput.style.height =
        "auto";


    messageInput.style.height =
        Math.min(
            messageInput.scrollHeight,
            140
        ) + "px";

}


messageInput.addEventListener(
    "input",
    resizeTextarea
);


// =========================================================
// ENTER TO SEND
// =========================================================

messageInput.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            chatForm.requestSubmit();

        }

    }
);


// =========================================================
// NEW CHAT BUTTON
// =========================================================

newChatBtn.addEventListener(
    "click",
    startNewChat
);


// =========================================================
// CHAT SUBMISSION
// =========================================================

chatForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        if (isGenerating) {
            return;
        }


        const message =
            messageInput.value.trim();


        if (!message) {
            return;
        }


        // Hide welcome screen
        welcomeScreen.style.display =
            "none";


        // Immediately show user's message
        addMessageToUI(
            "user",
            message
        );


        // Clear input
        messageInput.value = "";

        resizeTextarea();

        scrollToBottom();


        // Show loading
        setLoading(true);


        try {

            const response = await fetch(
                "/generate",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        message: message,
                        thread_id:
                            currentThreadId
                    })
                }
            );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "Something went wrong."
                );

            }


            // Store thread ID
            currentThreadId =
                data.thread_id;


            // Add AI response
            addMessageToUI(
                "assistant",
                data.response_text
            );


            // Refresh sidebar
            await loadThreads();


            scrollToBottom();


        } catch (error) {

            console.error(
                "Generation error:",
                error
            );


            showErrorMessage(
                `Error: ${error.message}`
            );


        } finally {

            setLoading(false);

        }

    }
);


// =========================================================
// INITIALIZE APPLICATION
// =========================================================

async function initializeApp() {

    await loadThreads();

    messageInput.focus();

}


initializeApp();