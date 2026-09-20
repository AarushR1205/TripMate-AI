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

let threadId = localStorage.getItem("tripmate_thread_id");

async function createNewSession() {
    try {
        const response = await fetch(`${API_BASE}/api/new-session`);

        if (!response.ok) {
            throw new Error("Unable to create a new session.");
        }

        const data = await response.json();
        threadId = data.thread_id;
        localStorage.setItem("tripmate_thread_id", threadId);
    } catch (error) {
        console.error("Session error:", error);
        threadId = `user_${crypto.randomUUID()}`;
        localStorage.setItem("tripmate_thread_id", threadId);
    }
}

if (!threadId) {
    createNewSession();
}

travelInput.addEventListener("input", () => {
    const length = travelInput.value.length;
    charCount.textContent = `${length} / 8000`;
});

quickPrompts.forEach(button => {
    button.addEventListener("click", () => {
        const prompt = button.dataset.prompt;
        travelInput.value = prompt;
        travelInput.dispatchEvent(new Event("input"));
        travelInput.focus();
        travelInput.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    });
});

function setLoading(isLoading) {
    planBtn.disabled = isLoading;

    if (isLoading) {
        planBtnText.textContent = "Planning...";
        planBtnIcon.classList.add("d-none");
        planSpinner.classList.remove("d-none");
    } else {
        planBtnText.textContent = "Plan my trip";
        planBtnIcon.classList.remove("d-none");
        planSpinner.classList.add("d-none");
    }
}

function showError(message) {
    errorMessage.textContent = message;
    errorBox.classList.remove("d-none");
    errorBox.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

function hideError() {
    errorBox.classList.add("d-none");
    errorMessage.textContent = "";
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function cleanMarkdown(text) {
    if (!text) {
        return "";
    }

    return text
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/^#{1,6}\s*/gm, "")
        .replace(/^>\s?/gm, "")
        .trim();
}

function renderMarkdown(text) {
    if (!text) {
        return `
            <div class="text-muted">
                No information available.
            </div>
        `;
    }

    let cleaned = text
        .replace(/^\s*(---+|\*\*\*+|___+)\s*$/gm, "")
        .trim();

    const lines = cleaned.split("\n");
    let html = "";
    let insideList = false;

    lines.forEach(rawLine => {
        const line = rawLine.trim();

        if (!line) {
            if (insideList) {
                html += "</ul>";
                insideList = false;
            }
            return;
        }

        if (/^###\s+/.test(line)) {
            if (insideList) {
                html += "</ul>";
                insideList = false;
            }

            const title = cleanMarkdown(line.replace(/^###\s+/, ""));

            html += `
                <h5 class="fw-bold mt-4 mb-2">
                    ${escapeHtml(title)}
                </h5>
            `;
            return;
        }

        if (/^##\s+/.test(line)) {
            if (insideList) {
                html += "</ul>";
                insideList = false;
            }

            const title = cleanMarkdown(line.replace(/^##\s+/, ""));

            html += `
                <h4 class="fw-bold mt-4 mb-2">
                    ${escapeHtml(title)}
                </h4>
            `;
            return;
        }

        if (/^#\s+/.test(line)) {
            if (insideList) {
                html += "</ul>";
                insideList = false;
            }

            const title = cleanMarkdown(line.replace(/^#\s+/, ""));

            html += `
                <h4 class="fw-bold mt-4 mb-2">
                    ${escapeHtml(title)}
                </h4>
            `;
            return;
        }

        if (/^[-*•]\s+/.test(line)) {
            if (!insideList) {
                html += `<ul class="mb-3 ps-4">`;
                insideList = true;
            }

            const item = cleanMarkdown(line.replace(/^[-*•]\s+/, ""));

            html += `
                <li class="mb-1">
                    ${escapeHtml(item)}
                </li>
            `;
            return;
        }

        if (insideList) {
            html += "</ul>";
            insideList = false;
        }

        let formatted = escapeHtml(line);

        formatted = formatted.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );

        html += `
            <p class="mb-2">
                ${formatted}
            </p>
        `;
    });

    if (insideList) {
        html += "</ul>";
    }

    return html;
}

function renderItinerary(text) {
    if (!text) {
        return `
            <div class="text-muted">
                No itinerary information available.
            </div>
        `;
    }

    const cleaned = text
        .replace(/\r/g, "")
        .replace(/^\s*(---+|\*\*\*+|___+)\s*$/gm, "")
        .trim();

    const lines = cleaned
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const dayRegex = /^(?:#{1,6}\s*)?(?:\*\*)?\s*DAY\s+(\d+)(.*?)(?:\*\*)?\s*$/i;
    const timeRegex = /^((?:\d{1,2}:\d{2}\s*(?:am|pm)?)(?:\s*[–—-]\s*(?:\d{1,2}:\d{2}\s*(?:am|pm)?))?)\s*(.*)$/i;

    const days = [];
    let currentDay = null;

    lines.forEach(line => {
        const cleanLine = cleanMarkdown(line);
        const dayMatch = cleanLine.match(dayRegex);

        if (dayMatch) {
            if (currentDay) {
                days.push(currentDay);
            }

            currentDay = {
                title: `Day ${dayMatch[1]}`,
                subtitle: dayMatch[2]
                    ? dayMatch[2].replace(/^[\s:–—-]+/, "").trim()
                    : "",
                activities: []
            };

            return;
        }

        if (!currentDay) {
            return;
        }

        const timeMatch = cleanLine.match(timeRegex);

        if (timeMatch) {
            currentDay.activities.push({
                time: timeMatch[1].trim(),
                text: timeMatch[2].replace(/^[-–—:]\s*/, "").trim(),
                details: []
            });

            return;
        }

        if (currentDay.activities.length > 0) {
            currentDay.activities[
                currentDay.activities.length - 1
            ].details.push(cleanLine);
        }
    });

    if (currentDay) {
        days.push(currentDay);
    }

    if (days.length === 0) {
        return renderMarkdown(text);
    }

    let html = "";

    days.forEach((day, index) => {
        const subtitle = day.subtitle || "";

        html += `
            <div class="card border-0 shadow-sm mb-4 overflow-hidden">
                <div class="card-header bg-primary text-white py-3 px-4">
                    <div class="d-flex align-items-center gap-3">
                        <div
                            class="rounded-circle bg-white text-primary d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                            style="width:42px;height:42px;"
                        >
                            ${index + 1}
                        </div>
                        <div>
                            <div class="fw-bold fs-5">
                                ${escapeHtml(day.title)}
                            </div>
                            ${subtitle
                ? `
                                        <div class="small opacity-75">
                                            ${escapeHtml(subtitle)}
                                        </div>
                                    `
                : ""
            }
                        </div>
                    </div>
                </div>
                <div class="card-body p-0">
        `;

        day.activities.forEach(activity => {
            const activityText = cleanMarkdown(activity.text);
            const lower = activityText.toLowerCase();

            let icon = "bi-geo-alt";

            if (lower.includes("flight") || lower.includes("airport")) {
                icon = "bi-airplane";
            } else if (
                lower.includes("train") ||
                lower.includes("narita express") ||
                lower.includes("metro")
            ) {
                icon = "bi-train-front";
            } else if (
                lower.includes("hotel") ||
                lower.includes("check-in") ||
                lower.includes("check out") ||
                lower.includes("check-out")
            ) {
                icon = "bi-building";
            } else if (
                lower.includes("breakfast") ||
                lower.includes("lunch") ||
                lower.includes("dinner") ||
                lower.includes("ramen") ||
                lower.includes("sushi") ||
                lower.includes("food")
            ) {
                icon = "bi-cup-hot";
            } else if (
                lower.includes("shopping") ||
                lower.includes("shop") ||
                lower.includes("market")
            ) {
                icon = "bi-bag";
            } else if (
                lower.includes("museum") ||
                lower.includes("shrine") ||
                lower.includes("temple") ||
                lower.includes("tower")
            ) {
                icon = "bi-bank";
            } else if (
                lower.includes("walk") ||
                lower.includes("stroll")
            ) {
                icon = "bi-person-walking";
            } else if (
                lower.includes("cruise") ||
                lower.includes("boat")
            ) {
                icon = "bi-water";
            } else if (
                lower.includes("arcade") ||
                lower.includes("anime") ||
                lower.includes("game")
            ) {
                icon = "bi-controller";
            }

            html += `
                <div class="d-flex gap-3 p-3 border-bottom">
                    <div
                        class="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0 text-primary"
                        style="width:42px;height:42px;"
                    >
                        <i class="bi ${icon}"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div class="small text-primary fw-semibold mb-1">
                            ${escapeHtml(activity.time)}
                        </div>
                        <div class="fw-semibold text-dark">
                            ${escapeHtml(activityText)}
                        </div>
            `;

            if (activity.details.length > 0) {
                const details = activity.details
                    .filter(detail => {
                        const cleanDetail = cleanMarkdown(detail);

                        return (
                            !cleanDetail.includes("|") &&
                            !/^[-–—_]+$/.test(cleanDetail)
                        );
                    })
                    .map(detail => `
                        <div class="mb-1">
                            ${escapeHtml(cleanMarkdown(detail))}
                        </div>
                    `)
                    .join("");

                if (details) {
                    html += `
                        <div class="text-muted small mt-1">
                            ${details}
                        </div>
                    `;
                }
            }

            html += `
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    const budgetHtml = renderBudgetTable(text);

    if (budgetHtml) {
        html += budgetHtml;
    }

    return html;
}

function renderBudgetTable(text) {
    const lines = text
        .replace(/\r/g, "")
        .split("\n")
        .map(line => line.trim());

    const tableLines = lines.filter(
        line =>
            line.includes("|") &&
            !/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(line)
    );

    if (tableLines.length < 2) {
        return "";
    }

    const budgetKeywords = [
        "flight",
        "accommodation",
        "transport",
        "meals",
        "attractions",
        "miscellaneous",
        "total"
    ];

    const relevantRows = tableLines.filter(line => {
        const lower = line.toLowerCase();

        return budgetKeywords.some(keyword =>
            lower.includes(keyword)
        );
    });

    if (relevantRows.length === 0) {
        return "";
    }

    let rowsHtml = "";

    relevantRows.forEach(row => {
        const cells = row
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map(cell => cleanMarkdown(cell.trim()));

        if (cells.length < 2) {
            return;
        }

        const category = cells[0];
        const amount = cells[cells.length - 1];
        const isTotal = category.toLowerCase().includes("total");

        rowsHtml += `
            <div
                class="d-flex justify-content-between align-items-center py-3 border-bottom ${isTotal ? "fw-bold fs-5" : ""
            }"
            >
                <span>${escapeHtml(category)}</span>
                <span class="${isTotal ? "text-primary" : "fw-semibold"}">
                    ${escapeHtml(amount)}
                </span>
            </div>
        `;
    });

    if (!rowsHtml) {
        return "";
    }

    return `
        <div class="card border-0 shadow-sm mb-4">
            <div class="card-header bg-light border-0 py-3 px-4">
                <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-wallet2 text-primary"></i>
                    <span class="fw-bold">Estimated Budget</span>
                </div>
                <div class="small text-muted mt-1">
                    Approximate cost per person
                </div>
            </div>
            <div class="card-body px-4">
                ${rowsHtml}
            </div>
        </div>
    `;
}

function displayResults(data) {
    aiAnswer.innerHTML = renderMarkdown(data.answer);

    flightResults.innerHTML = renderMarkdown(
        data.flight_results || "No flight information available."
    );

    hotelResults.innerHTML = renderMarkdown(
        data.hotel_results || "No hotel information available."
    );

    itineraryResults.innerHTML = renderItinerary(
        data.itinerary || "No itinerary information available."
    );

    resultsSection.classList.remove("d-none");

    resultsSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

travelForm.addEventListener("submit", async event => {
    event.preventDefault();
    hideError();

    const message = travelInput.value.trim();

    if (!message) {
        showError("Please describe your travel plans first.");
        return;
    }

    setLoading(true);

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

        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error("The server returned an invalid response.");
        }

        if (!response.ok) {
            throw new Error(
                data.detail || "Unable to process your travel request."
            );
        }

        if (data.thread_id) {
            threadId = data.thread_id;

            localStorage.setItem(
                "tripmate_thread_id",
                threadId
            );
        }

        displayResults(data);
    } catch (error) {
        console.error("TripMate error:", error);

        showError(
            error.message ||
            "Something went wrong while planning your trip."
        );
    } finally {
        setLoading(false);
    }
});

copyBtn.addEventListener("click", async () => {
    const text = aiAnswer.innerText.trim();

    if (!text) {
        return;
    }

    try {
        await navigator.clipboard.writeText(text);

        const original = copyBtn.innerHTML;

        copyBtn.innerHTML =
            `<i class="bi bi-check2 me-1"></i> Copied`;

        copyBtn.classList.remove("btn-outline-secondary");
        copyBtn.classList.add("btn-success");

        setTimeout(() => {
            copyBtn.innerHTML = original;
            copyBtn.classList.remove("btn-success");
            copyBtn.classList.add("btn-outline-secondary");
        }, 1800);
    } catch (error) {
        console.error("Copy failed:", error);
        showError("Unable to copy the travel plan.");
    }
});

newTripBtn.addEventListener("click", async () => {
    travelInput.value = "";
    charCount.textContent = "0 / 8000";
    aiAnswer.innerHTML = "";
    flightResults.innerHTML = "No flight information available.";
    hotelResults.innerHTML = "No hotel information available.";
    itineraryResults.innerHTML = "Your itinerary will appear here.";

    resultsSection.classList.add("d-none");

    hideError();

    await createNewSession();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    travelInput.focus();
});