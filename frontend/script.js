const API_BASE = "http://127.0.0.1:8000";

const travelForm = document.getElementById("travelForm");
const travelInput = document.getElementById("travelInput");
const charCount = document.getElementById("charCount");
const planBtn = document.getElementById("planBtn");
const planBtnText = document.getElementById("planBtnText");
const planBtnIcon = document.getElementById("planBtnIcon");
const planSpinner = document.getElementById("planSpinner");
const resultsSection = document.getElementById("resultsSection");
const aiAnswer = document.getElementById("aiAnswer");
const flightResults = document.getElementById("flightResults");
const hotelResults = document.getElementById("hotelResults");
const itineraryResults = document.getElementById("itineraryResults");
const errorBox = document.getElementById("errorBox");
const errorMessage = document.getElementById("errorMessage");
const copyBtn = document.getElementById("copyBtn");
const newTripBtn = document.getElementById("newTripBtn");
const quickPrompts = document.querySelectorAll(".quick-prompt");

let threadId = null;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    updateCharacterCount();
    await createNewSession();
}

async function createNewSession() {
    try {
        const response = await fetch(`${API_BASE}/api/new-session`);

        if (!response.ok) {
            throw new Error("Unable to create a new session.");
        }

        const data = await response.json();
        threadId = data.thread_id;
    } catch (error) {
        showError(error.message);
    }
}

travelInput.addEventListener("input", updateCharacterCount);

function updateCharacterCount() {
    charCount.textContent = `${travelInput.value.length}/8000`;
}

quickPrompts.forEach(prompt => {
    prompt.addEventListener("click", () => {
        travelInput.value = prompt.dataset.prompt || prompt.textContent.trim();
        updateCharacterCount();
        travelInput.focus();
    });
});

travelForm.addEventListener("submit", async event => {
    event.preventDefault();

    const message = travelInput.value.trim();

    if (!message) {
        showError("Please enter your travel requirements.");
        travelInput.focus();
        return;
    }

    hideError();
    setLoadingState(true);

    try {
        const response = await fetch(`${API_BASE}/api/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message,
                thread_id: threadId
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail || "Unable to process your travel request."
            );
        }

        threadId = data.thread_id;
        displayResults(data);
    } catch (error) {
        showError(error.message);
    } finally {
        setLoadingState(false);
    }
});

function setLoadingState(isLoading) {
    planBtn.disabled = isLoading;

    if (isLoading) {
        planBtnText.textContent = "Planning...";
        planBtnIcon.classList.add("d-none");
        planSpinner.classList.remove("d-none");
    } else {
        planBtnText.textContent = "Plan My Trip";
        planBtnIcon.classList.remove("d-none");
        planSpinner.classList.add("d-none");
    }
}

function displayResults(data) {
    aiAnswer.innerHTML = renderMarkdown(
        data.answer || "No travel plan available."
    );

    flightResults.innerHTML = renderMarkdown(
        data.flight_results || "No flight information available."
    );

    hotelResults.innerHTML = renderMarkdown(
        data.hotel_results || "No hotel information available."
    );

    itineraryResults.innerHTML = renderMarkdown(
        data.itinerary || "No itinerary information available."
    );

    resultsSection.classList.remove("d-none");

    resultsSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function renderMarkdown(text) {
    if (!text) {
        return "No information available.";
    }

    if (typeof marked !== "undefined") {
        const rendered = marked.parse(text, {
            breaks: true,
            gfm: true
        });

        return typeof DOMPurify !== "undefined"
            ? DOMPurify.sanitize(rendered)
            : rendered;
    }

    return renderPlainMarkdown(text);
}

function renderPlainMarkdown(text) {
    const lines = text.split(/\r?\n/);
    const renderedLines = [];
    let listType = null;

    const closeList = () => {
        if (listType) {
            renderedLines.push(`</${listType}>`);
            listType = null;
        }
    };

    lines.forEach(line => {
        const heading = line.match(/^#{1,4}\s+(.+)$/);
        const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
        const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);

        if (heading) {
            closeList();
            const level = line.match(/^#+/)[0].length;
            renderedLines.push(`<h${level}>${formatInlineMarkdown(heading[1])}</h${level}>`);
        } else if (bullet || numbered) {
            const nextListType = bullet ? "ul" : "ol";
            if (listType !== nextListType) {
                closeList();
                renderedLines.push(`<${nextListType}>`);
                listType = nextListType;
            }
            renderedLines.push(`<li>${formatInlineMarkdown((bullet || numbered)[1])}</li>`);
        } else if (line.trim()) {
            closeList();
            renderedLines.push(`<p>${formatInlineMarkdown(line)}</p>`);
        } else {
            closeList();
        }
    });

    closeList();
    return renderedLines.join("");
}

function formatInlineMarkdown(text) {
    return escapeHtml(text)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/__(.+?)__/g, "<strong>$1</strong>")
        .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
        .replace(/_([^_\n]+)_/g, "<em>$1</em>");
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    errorMessage.textContent = message;
    errorBox.classList.remove("d-none");
}

function hideError() {
    errorBox.classList.add("d-none");
    errorMessage.textContent = "";
}

copyBtn.addEventListener("click", async () => {
    const text = aiAnswer.innerText.trim();

    if (!text) {
        return;
    }

    try {
        await navigator.clipboard.writeText(text);

        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = "Copied!";

        setTimeout(() => {
            copyBtn.innerHTML = originalText;
        }, 1500);
    } catch (error) {
        showError("Unable to copy the travel plan.");
    }
});

newTripBtn.addEventListener("click", async () => {
    travelInput.value = "";
    updateCharacterCount();
    hideError();

    resultsSection.classList.add("d-none");

    aiAnswer.innerHTML = "";
    flightResults.innerHTML = "";
    hotelResults.innerHTML = "";
    itineraryResults.innerHTML = "";

    await createNewSession();

    travelInput.focus();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
});