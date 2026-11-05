
const API_BASE_URL = "http://127.0.0.1:8000";
const MIN_PROMPT_LENGTH = 3;
const MAX_PROMPT_LENGTH = 2000;
const REQUEST_TIMEOUT = 30000;

// DOM Elements
const form = document.querySelector("#travel-form");
const promptInput = document.querySelector("#travel-prompt");
const submitButton = document.querySelector("#submit-button");
const submitLabel = document.querySelector("#submit-label");
const results = document.querySelector("#results");
const welcome = document.querySelector("#welcome");
const inspiration = document.querySelector("#inspiration");
const sessionStatus = document.querySelector("#session-status");

// Session State
let threadId = null;
let isSubmitting = false;
let isStartingSession = false;

// API Request Handler
async function apiRequest(endpoint, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw new Error("Unable to connect to the server. Check your internet connection.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok) {
    const message = typeof data.detail === "string"
      ? data.detail
      : "Something went wrong. Please try again.";

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

// Refresh Icons
function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

// Session Management
async function startSession() {
  if (isStartingSession) return false;
  isStartingSession = true;

  try {
    const data = await apiRequest("/api/chat");

    if (!data.thread_id || typeof data.thread_id !== "string") {
      throw new Error("Invalid session received from server.");
    }

    threadId = data.thread_id;
    sessionStatus.textContent = "Ready when you are";
    return true;
  } catch (error) {
    threadId = null;
    console.error("Session creation error:", error);
    sessionStatus.textContent = "Unable to start session";
    return false;
  } finally {
    isStartingSession = false;
  }
}

// HTML Escaping
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// Markdown Rendering
function markdownToHtml(markdown) {
  if (!window.marked) {
    return `<p>${escapeHtml(markdown).replace(/\n/g, "<br>")}</p>`;
  }

  const rendered = window.marked.parse(markdown, { breaks: true });

  return window.DOMPurify
    ? window.DOMPurify.sanitize(rendered)
    : `<p>${escapeHtml(markdown).replace(/\n/g, "<br>")}</p>`;
}

// Input Validation
function validatePrompt(message) {
  if (!message) return "Please enter your travel requirements.";
  if (message.length < MIN_PROMPT_LENGTH) return "Please enter at least 3 characters.";
  if (message.length > MAX_PROMPT_LENGTH) return "Your travel prompt cannot exceed 2000 characters.";
  return null;
}

// Error Display
function showError(message) {
  results.innerHTML = `
        <div class="rounded-2xl border border-[#f1d4ca] bg-[#fff8f5] p-4 text-sm leading-6 text-[#855548]" role="alert">
            <div class="flex items-start gap-3">
                <i data-lucide="circle-alert" class="mt-0.5 h-4 w-4 shrink-0 text-coral"></i>
                <div>
                    <strong class="font-semibold">We couldn’t finish that plan.</strong>
                    <p class="mt-1">${escapeHtml(message)}</p>
                    <button id="retry-session" class="mt-2 font-bold underline underline-offset-2">Try again</button>
                </div>
            </div>
        </div>
    `;

  results.classList.remove("hidden");
  document.querySelector("#retry-session").addEventListener("click", () => form.requestSubmit());
  refreshIcons();
}

// Render Travel Plan
function renderPlan(data, originalPrompt) {
  const answer = typeof data.answer === "string" && data.answer.trim()
    ? data.answer
    : "I couldn't find a complete plan for that request. Try adding a destination, dates, or a budget.";

  results.innerHTML = `
        <div class="fade-up overflow-hidden rounded-[20px] border border-[#e2e7dd] bg-white shadow-[0_15px_45px_-35px_rgba(24,51,46,.4)]">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0e9] bg-[#fbfcf8] px-5 py-4 sm:px-7">
                <div class="flex items-center gap-3">
                    <span class="grid h-9 w-9 place-items-center rounded-xl bg-lime/70 text-ink">
                        <i data-lucide="sparkles" class="h-[17px] w-[17px]"></i>
                    </span>
                    <div>
                        <p class="font-display text-sm font-extrabold">Your trip, taking shape</p>
                        <p class="mt-0.5 max-w-[56vw] truncate text-[11px] text-[#829087]">${escapeHtml(originalPrompt)}</p>
                    </div>
                </div>
                <span class="flex items-center gap-1.5 rounded-full bg-[#edf3e9] px-2.5 py-1 text-[10px] font-semibold text-moss">
                    <span class="h-1.5 w-1.5 rounded-full bg-[#79a879]"></span>
                    Plan ready
                </span>
            </div>
            <div class="prose-trip px-5 py-5 text-[13px] text-[#53665d] sm:px-7 sm:py-7 sm:text-sm">
                ${markdownToHtml(answer)}
            </div>
            <div class="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0e9] px-5 py-3.5 sm:px-7">
                <span class="flex items-center gap-1.5 text-[10px] text-[#89948c]">
                    <i data-lucide="info" class="h-3.5 w-3.5"></i>
                    Confirm details and live prices before booking.
                </span>
                <button id="copy-plan" class="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-moss transition hover:bg-[#f0f3ec]">
                    <i data-lucide="copy" class="h-3.5 w-3.5"></i>
                    Copy plan
                </button>
            </div>
        </div>
    `;

  results.classList.remove("hidden");
  const copyButton = document.querySelector("#copy-plan");

  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(answer);
      copyButton.innerHTML = '<i data-lucide="check" class="h-3.5 w-3.5"></i> Copied';
      refreshIcons();
    } catch {
      copyButton.textContent = "Select and copy the plan";
    }
  });

  refreshIcons();
}

// Submit Travel Request
async function submitTrip(event) {
  event.preventDefault();
  if (isSubmitting) return;

  const message = promptInput.value.trim();
  const validationError = validatePrompt(message);

  if (validationError) {
    promptInput.focus();
    showError(validationError);
    return;
  }

  isSubmitting = true;
  submitButton.disabled = true;
  submitLabel.textContent = "Planning your trip...";
  sessionStatus.textContent = "Creating your plan...";

  results.classList.remove("hidden");
  results.innerHTML = `
        <div class="flex items-center gap-3 rounded-2xl border border-[#e2e7dd] bg-white px-5 py-6 text-sm text-[#738178]">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-[#edf3e9]">
                <i data-lucide="loader-circle" class="h-4 w-4 animate-spin text-moss"></i>
            </span>
            <span>Creating your plan...</span>
        </div>
    `;
  refreshIcons();

  try {
    if (!threadId) {
      const sessionCreated = await startSession();
      if (!sessionCreated) {
        throw new Error("Unable to start your session. Please try again.");
      }
    }

    let data;

    try {
      data = await apiRequest("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message,
          thread_id: threadId,
        }),
      });
    } catch (error) {
      if (error.status === 404) {
        threadId = null;

        const sessionCreated = await startSession();
        if (!sessionCreated) {
          throw new Error("Unable to restore your session. Please try again.");
        }

        data = await apiRequest("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: message,
            thread_id: threadId,
          }),
        });
      } else {
        throw error;
      }
    }

    if (!data.thread_id || typeof data.thread_id !== "string") {
      throw new Error("Invalid session response from server.");
    }

    if (typeof data.answer !== "string" || !data.answer.trim()) {
      throw new Error("The server did not return a valid travel plan.");
    }

    threadId = data.thread_id;
    inspiration.classList.add("hidden");
    renderPlan(data, message);
    sessionStatus.textContent = "Your plan is ready";
    promptInput.value = "";

    results.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } catch (error) {
    console.error("Travel planner error:", error);
    showError(error.message || "Please check your connection and try again.");
    sessionStatus.textContent = "Ready when you are";
  } finally {
    isSubmitting = false;
    submitButton.disabled = false;
    submitLabel.textContent = "Make it a trip";
  }
}

// Reset Travel Planner
async function resetPlanner() {
  if (isSubmitting) return;

  threadId = null;
  results.classList.add("hidden");
  results.innerHTML = "";
  welcome.classList.remove("hidden");
  inspiration.classList.remove("hidden");
  promptInput.value = "";
  sessionStatus.textContent = "Starting a new session...";

  await startSession();

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

// Event Listeners
form.addEventListener("submit", submitTrip);
document.querySelector("#new-trip").addEventListener("click", resetPlanner);
document.querySelector("#mobile-new-trip").addEventListener("click", resetPlanner);

document.querySelectorAll(".prompt-chip, .destination-card").forEach((button) => {
  button.addEventListener("click", () => {
    if (isSubmitting) return;

    promptInput.value = button.dataset.prompt || "";
    promptInput.focus();

    promptInput.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  });
});

// Enforce Character Limit
promptInput.setAttribute("maxlength", MAX_PROMPT_LENGTH);

// Initialize Application
refreshIcons();
startSession();
