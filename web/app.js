const state = {
  authenticated: false,
  health: null,
  latestRun: null,
  recentRuns: [],
  selectedBatchIndex: null,
  loading: false,
};

const elements = {
  loginPanel: document.querySelector("#loginPanel"),
  loginForm: document.querySelector("#loginForm"),
  loginError: document.querySelector("#loginError"),
  logoutButton: document.querySelector("#logoutButton"),
  dashboard: document.querySelector("#dashboard"),
  sessionBadge: document.querySelector("#sessionBadge"),
  generateButton: document.querySelector("#generateButton"),
  loadLatestButton: document.querySelector("#loadLatestButton"),
  runStatus: document.querySelector("#runStatus"),
  runMeta: document.querySelector("#runMeta"),
  metricCards: document.querySelector("#metricCards"),
  batchList: document.querySelector("#batchList"),
  previewTitle: document.querySelector("#previewTitle"),
  batchMeta: document.querySelector("#batchMeta"),
  previewFrame: document.querySelector("#previewFrame"),
  copyBatchButton: document.querySelector("#copyBatchButton"),
  openBatchLink: document.querySelector("#openBatchLink"),
  articleList: document.querySelector("#articleList"),
  skippedList: document.querySelector("#skippedList"),
  skipSummary: document.querySelector("#skipSummary"),
  historyList: document.querySelector("#historyList"),
};

const formFields = {
  search: document.querySelector("#searchInput"),
  collectionId: document.querySelector("#collectionIdInput"),
  sort: document.querySelector("#sortInput"),
  nested: document.querySelector("#nestedInput"),
  maxArticles: document.querySelector("#maxArticlesInput"),
  maxMinutes: document.querySelector("#maxMinutesInput"),
  wordsPerMinute: document.querySelector("#wordsPerMinuteInput"),
  concurrency: document.querySelector("#concurrencyInput"),
  timeoutMs: document.querySelector("#timeoutMsInput"),
  maxHtmlBytes: document.querySelector("#maxHtmlBytesInput"),
};

boot().catch((error) => {
  console.error(error);
  setRunStatus("Failed to load the dashboard.", error.message || "Unexpected error.");
});

elements.loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.loginError.textContent = "";

  const formData = new FormData(elements.loginForm);
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");

  try {
    await api("/api/session", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    elements.loginForm.reset();
    await boot();
  } catch (error) {
    elements.loginError.textContent = error.message;
  }
});

elements.logoutButton?.addEventListener("click", async () => {
  await fetch("/api/session", {
    method: "DELETE",
    credentials: "same-origin",
  });

  state.authenticated = false;
  state.latestRun = null;
  state.recentRuns = [];
  render();
});

elements.generateButton?.addEventListener("click", async () => {
  if (state.loading) {
    return;
  }

  state.loading = true;
  setRunStatus("Queue generation started.", "Creating a run and polling for completion.");
  render();

  try {
    const query = buildQueryString();
    const createResponse = await api(`/api/runs${query}`, { method: "POST" });
    const { run, links } = createResponse;

    setRunStatus("Run queued.", `Run ${run.id} is being processed.`);

    const processPromise = fetch(links.process, {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => null);

    const completedRun = await pollRun(links.status, run.id);
    await processPromise;

    if (!completedRun.result) {
      throw new Error(completedRun.error?.message || "Run finished without a result payload.");
    }

    state.latestRun = completedRun;
    state.selectedBatchIndex = completedRun.result.batches[0]?.index ?? null;
    setRunStatus("Queue ready.", `Stored run ${completedRun.id} finished successfully.`);
    await refreshHistory();
    render();
  } catch (error) {
    setRunStatus("Generation failed.", error.message || "Unexpected error during generation.");
  } finally {
    state.loading = false;
    render();
  }
});

elements.loadLatestButton?.addEventListener("click", async () => {
  if (state.loading) {
    return;
  }

  state.loading = true;
  setRunStatus("Loading stored queue.", "Fetching the latest queue for the current configuration.");
  render();

  try {
    await loadLatestQueue();
    setRunStatus(
      "Stored queue loaded.",
      state.latestRun ? `Run ${state.latestRun.id} is active.` : "No stored queue matched this configuration.",
    );
  } catch (error) {
    setRunStatus("Could not load the latest queue.", error.message);
  } finally {
    state.loading = false;
    render();
  }
});

elements.copyBatchButton?.addEventListener("click", async () => {
  const batch = getSelectedBatch();

  if (!batch) {
    return;
  }

  try {
    await navigator.clipboard.writeText(batch.html);
    setRunStatus("Batch HTML copied.", `Batch ${batch.index} is in the clipboard.`);
  } catch (error) {
    setRunStatus("Clipboard write failed.", error.message || "The browser blocked clipboard access.");
  }
});

async function boot() {
  const session = await api("/api/session");
  state.authenticated = Boolean(session.authenticated);

  if (!state.authenticated) {
    render();
    return;
  }

  await loadHealth();
  await Promise.all([loadLatestQueue(), refreshHistory()]);
  render();
}

async function loadHealth() {
  const payload = await api("/api/health");
  state.health = payload;

  if (payload.configuration?.ok) {
    hydrateForm(payload.configuration);
  }
}

async function loadLatestQueue() {
  try {
    const payload = await api(`/api/queue/latest${buildQueryString()}`);
    state.latestRun = {
      id: payload.runId,
      status: "succeeded",
      createdAt: payload.generatedAt,
      startedAt: payload.generatedAt,
      completedAt: payload.generatedAt,
      generatedAt: payload.generatedAt,
      config: payload.config,
      totals: payload.totals,
      error: null,
      result: payload,
    };
    state.selectedBatchIndex = payload.batches[0]?.index ?? null;
  } catch (error) {
    if (error.status === 404) {
      state.latestRun = null;
      state.selectedBatchIndex = null;
      return;
    }

    throw error;
  }
}

async function refreshHistory() {
  try {
    const payload = await api("/api/runs?limit=12");
    state.recentRuns = payload.runs || [];
  } catch (error) {
    state.recentRuns = [];
    console.error(error);
  }
}

function hydrateForm(configuration) {
  formFields.search.value = configuration.search ?? "";
  formFields.collectionId.value = String(configuration.collectionId ?? 0);
  formFields.sort.value = configuration.sort ?? "-created";
  formFields.nested.value = String(configuration.nested ?? true);
  formFields.maxArticles.value = String(configuration.maxArticles ?? 20);
  formFields.maxMinutes.value = String(configuration.maxMinutes ?? 45);
  formFields.wordsPerMinute.value = String(configuration.wordsPerMinute ?? 180);
  formFields.concurrency.value = String(configuration.extractionConcurrency ?? 4);
  formFields.timeoutMs.value = String(configuration.fetchTimeoutMs ?? 12000);
  formFields.maxHtmlBytes.value = String(configuration.maxHtmlBytes ?? 750000);
}

function render() {
  elements.loginPanel.classList.toggle("hidden", state.authenticated);
  elements.dashboard.classList.toggle("hidden", !state.authenticated);
  elements.logoutButton.classList.toggle("hidden", !state.authenticated);
  elements.sessionBadge.textContent = state.authenticated ? "Signed in" : "Signed out";
  elements.generateButton.disabled = state.loading;
  elements.loadLatestButton.disabled = state.loading;

  renderMetrics();
  renderBatches();
  renderPreview();
  renderSkipped();
  renderHistory();
}

function renderMetrics() {
  const run = state.latestRun?.result;
  const recentRuns = state.recentRuns;
  const succeededRuns = recentRuns.filter((item) => item.status === "succeeded");
  const successRate = recentRuns.length
    ? Math.round((succeededRuns.length / recentRuns.length) * 100)
    : 0;
  const streak = countSuccessStreak(recentRuns);
  const topSkipReason = findTopSkipReason(run?.skipped || []);
  const extractionRate =
    run?.totals?.fetched && run?.totals?.extracted !== undefined
      ? Math.round((run.totals.extracted / run.totals.fetched) * 100)
      : 0;
  const averageBatchMinutes =
    run?.totals?.batches && run?.totals?.estimatedMinutes
      ? Math.round(run.totals.estimatedMinutes / run.totals.batches)
      : 0;

  const cards = [
    {
      label: "Ready minutes",
      value: `${run?.totals?.estimatedMinutes ?? 0}m`,
      detail: run
        ? `${run.totals.words.toLocaleString()} words across ${run.totals.batches} batches.`
        : "Generate or load a queue to see listening inventory.",
    },
    {
      label: "Extraction rate",
      value: `${extractionRate}%`,
      detail: run
        ? `${run.totals.extracted}/${run.totals.fetched} fetched articles made it into the queue.`
        : "No current run loaded.",
    },
    {
      label: "Recent success rate",
      value: `${successRate}%`,
      detail: recentRuns.length
        ? `${succeededRuns.length} of the last ${recentRuns.length} runs completed successfully.`
        : "Run history will appear here after the first stored run.",
    },
    {
      label: "Skip pressure",
      value: topSkipReason ? topSkipReason.count : "0",
      detail: topSkipReason
        ? `Most common latest skip reason: ${topSkipReason.reason}.`
        : "The current run has no skipped articles.",
    },
    {
      label: "Batch cadence",
      value: averageBatchMinutes ? `${averageBatchMinutes}m` : "0m",
      detail: run
        ? "Average listening time per batch in the current queue."
        : "Load a queue to inspect pacing.",
    },
    {
      label: "Success streak",
      value: String(streak),
      detail: streak
        ? "Consecutive successful runs from newest backwards."
        : "The newest recorded run is not a success.",
    },
  ];

  elements.metricCards.innerHTML = cards
    .map(
      (card) => `
        <article class="metric-card">
          <div class="label">${escapeHtml(card.label)}</div>
          <div class="value">${escapeHtml(String(card.value))}</div>
          <div class="detail">${escapeHtml(card.detail)}</div>
        </article>
      `,
    )
    .join("");
}

function renderBatches() {
  const run = state.latestRun?.result;

  if (!run?.batches?.length) {
    elements.batchList.innerHTML = '<div class="muted">No batches loaded.</div>';
    return;
  }

  elements.batchList.innerHTML = run.batches
    .map((batch) => {
      const active = batch.index === state.selectedBatchIndex;
      return `
        <article class="batch-card ${active ? "active" : ""}">
          <div class="batch-card-header">
            <span class="batch-pill">Batch ${batch.index}</span>
            <span class="muted">${batch.articleCount} articles</span>
          </div>
          <h3>${escapeHtml(batch.wordCount.toLocaleString())} words · ${escapeHtml(String(batch.estimatedMinutes))} minutes</h3>
          <p class="batch-summary">${escapeHtml(batch.articles.map((article) => article.title).join(" • "))}</p>
          <div class="batch-actions">
            <button class="ghost-button" type="button" data-select-batch="${batch.index}">Preview</button>
            <button class="ghost-button" type="button" data-copy-batch="${batch.index}">Copy HTML</button>
          </div>
        </article>
      `;
    })
    .join("");

  elements.batchList.querySelectorAll("[data-select-batch]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedBatchIndex = Number(button.getAttribute("data-select-batch"));
      render();
    });
  });

  elements.batchList.querySelectorAll("[data-copy-batch]").forEach((button) => {
    button.addEventListener("click", async () => {
      const batchIndex = Number(button.getAttribute("data-copy-batch"));
      const batch = state.latestRun?.result?.batches.find((item) => item.index === batchIndex);

      if (!batch) {
        return;
      }

      await navigator.clipboard.writeText(batch.html);
      setRunStatus("Batch HTML copied.", `Batch ${batch.index} is in the clipboard.`);
    });
  });
}

function renderPreview() {
  const batch = getSelectedBatch();

  if (!batch || !state.latestRun?.result) {
    elements.previewTitle.textContent = "Select a batch";
    elements.batchMeta.textContent = "Choose a batch to inspect the rendered HTML and article lineup.";
    elements.previewFrame.srcdoc = "";
    elements.copyBatchButton.disabled = true;
    elements.openBatchLink.classList.add("disabled-link");
    elements.articleList.innerHTML = "";
    return;
  }

  elements.previewTitle.textContent = `Batch ${batch.index} preview`;
  elements.batchMeta.textContent = `${batch.articleCount} articles · ${batch.wordCount.toLocaleString()} words · ${batch.estimatedMinutes} minutes`;
  elements.previewFrame.srcdoc = batch.html;
  elements.copyBatchButton.disabled = false;
  elements.openBatchLink.href = `/api/runs/${state.latestRun.id}/html?batch=${batch.index}`;
  elements.openBatchLink.classList.remove("disabled-link");
  elements.articleList.innerHTML = batch.articles
    .map(
      (article) => `
        <article class="article-row">
          <strong>${escapeHtml(article.title)}</strong>
          <p>${escapeHtml(String(article.wordCount))} words · ${escapeHtml(String(article.estimatedMinutes))} minutes</p>
          <a href="${escapeAttribute(article.sourceUrl)}" target="_blank" rel="noreferrer">Open source</a>
        </article>
      `,
    )
    .join("");
}

function renderSkipped() {
  const skipped = state.latestRun?.result?.skipped || [];

  if (!skipped.length) {
    elements.skipSummary.textContent = "No skipped articles for the current run.";
    elements.skippedList.innerHTML = "";
    return;
  }

  const topSkipReason = findTopSkipReason(skipped);
  elements.skipSummary.textContent = topSkipReason
    ? `${skipped.length} skipped articles. Most common reason: ${topSkipReason.reason} (${topSkipReason.count}).`
    : `${skipped.length} skipped articles.`;

  elements.skippedList.innerHTML = skipped
    .map(
      (item) => `
        <article class="skip-card">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.reason)}</p>
          <a href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">Open source</a>
        </article>
      `,
    )
    .join("");
}

function renderHistory() {
  if (!state.recentRuns.length) {
    elements.historyList.innerHTML = '<div class="muted">No stored runs yet.</div>';
    return;
  }

  elements.historyList.innerHTML = state.recentRuns
    .map((run) => {
      const when = formatDate(run.generatedAt || run.completedAt || run.createdAt);
      const totals = run.totals
        ? `${run.totals.words.toLocaleString()} words · ${run.totals.estimatedMinutes} minutes`
        : run.error?.message || "Run has no totals yet.";

      return `
        <article class="history-card">
          <div class="history-header">
            <strong>${escapeHtml(when)}</strong>
            <span class="history-status ${escapeHtml(run.status)}">${escapeHtml(run.status)}</span>
          </div>
          <p class="history-summary">${escapeHtml(totals)}</p>
          <p class="history-summary">Config: ${escapeHtml(compactConfig(run.config))}</p>
        </article>
      `;
    })
    .join("");
}

function buildQueryString() {
  const params = new URLSearchParams();

  for (const [key, field] of Object.entries(formFields)) {
    const value = String(field.value ?? "").trim();

    if (value !== "") {
      params.set(key, value);
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

function getSelectedBatch() {
  return state.latestRun?.result?.batches.find((batch) => batch.index === state.selectedBatchIndex) || null;
}

function countSuccessStreak(runs) {
  let streak = 0;

  for (const run of runs) {
    if (run.status !== "succeeded") {
      break;
    }

    streak += 1;
  }

  return streak;
}

function findTopSkipReason(skipped) {
  const counts = new Map();

  for (const item of skipped) {
    counts.set(item.reason, (counts.get(item.reason) || 0) + 1);
  }

  const [reason, count] =
    [...counts.entries()].sort((left, right) => right[1] - left[1])[0] || [];

  return reason ? { reason, count } : null;
}

function setRunStatus(status, meta = "") {
  elements.runStatus.textContent = status;
  elements.runMeta.textContent = meta;
}

async function pollRun(path, runId) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const payload = await api(path);
    const run = payload.run;

    if (run.status === "succeeded" || run.status === "failed") {
      return run;
    }

    setRunStatus(`Run ${runId} is ${run.status}.`, "Polling for completion.");
    await wait(1500);
  }

  throw new Error(`Timed out while waiting for run ${runId} to complete.`);
}

async function api(path, init = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
    ...init,
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(body?.error?.message || response.statusText);
    error.status = response.status;
    throw error;
  }

  return body;
}

function compactConfig(config) {
  return [
    config.search ? `search=${config.search}` : "search=all",
    `articles=${config.maxArticles}`,
    `minutes=${config.maxMinutes}`,
    `wpm=${config.wordsPerMinute}`,
  ].join(" · ");
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
