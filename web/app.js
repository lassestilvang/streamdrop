const CONFIG_QUERY_KEYS = {
  collectionId: "collectionId",
  search: "search",
  sort: "sort",
  nested: "nested",
  maxArticles: "maxArticles",
  maxMinutes: "maxMinutes",
  wordsPerMinute: "wordsPerMinute",
  extractionConcurrency: "concurrency",
  fetchTimeoutMs: "timeoutMs",
  maxHtmlBytes: "maxHtmlBytes",
};

const state = {
  authenticated: false,
  health: null,
  latestRun: null,
  recentRuns: [],
  selectedBatchIndex: null,
  loading: false,
  publicBatchLink: null,
  publicBatchLinkExpiresAt: null,
  compareRunId: null,
  expandedHistoryRunId: null,
  runDetails: {},
  initialized: false,
};

const elements = {
  bootPanel: document.querySelector("#bootPanel"),
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
  historySummary: document.querySelector("#historySummary"),
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
  state.initialized = true;
  document.body.classList.remove("app-loading");
  setRunStatus("Failed to load the dashboard.", error.message || "Unexpected error.");
  render();
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
  state.publicBatchLink = null;
  state.publicBatchLinkExpiresAt = null;
  state.compareRunId = null;
  state.expandedHistoryRunId = null;
  state.runDetails = {};
  render();
});

elements.generateButton?.addEventListener("click", async () => {
  await executeRun(buildQueryString(), {
    start: "Queue generation started.",
    startMeta: "Creating a run and polling for completion.",
    queued: "Run queued.",
    success: "Queue ready.",
    successMeta: (run) => `Stored run ${run.id} finished successfully.`,
    failure: "Generation failed.",
  });
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
  try {
    const session = await api("/api/session");
    state.authenticated = Boolean(session.authenticated);

    if (!state.authenticated) {
      state.initialized = true;
      render();
      return;
    }

    await loadHealth();
    await Promise.all([loadLatestQueue(), refreshHistory()]);
    state.initialized = true;
    render();
  } finally {
    document.body.classList.remove("app-loading");
  }
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
    const run = toRunRecordFromLatestPayload(payload);
    cacheRun(run);
    useRun(run, { hydrate: false, preserveComparison: false });
  } catch (error) {
    if (error.status === 404) {
      state.latestRun = null;
      state.selectedBatchIndex = null;
      state.publicBatchLink = null;
      state.publicBatchLinkExpiresAt = null;
      state.compareRunId = null;
      state.expandedHistoryRunId = null;
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
  document.body.classList.toggle("app-loading", !state.initialized);
  elements.bootPanel.classList.toggle("hidden", state.initialized);
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
  const run = state.latestRun;
  const result = run?.result || null;
  const totals = result?.totals || run?.totals || null;
  const recentRuns = state.recentRuns;
  const succeededRuns = recentRuns.filter((item) => item.status === "succeeded");
  const successRate = recentRuns.length
    ? Math.round((succeededRuns.length / recentRuns.length) * 100)
    : 0;
  const streak = countSuccessStreak(recentRuns);
  const topSkipReason = findTopSkipReason(result?.skipped || []);
  const extractionRate =
    totals?.fetched && totals?.extracted !== undefined
      ? Math.round((totals.extracted / totals.fetched) * 100)
      : 0;
  const averageBatchMinutes =
    totals?.batches && totals?.estimatedMinutes
      ? Math.round(totals.estimatedMinutes / totals.batches)
      : 0;

  const cards = [
    {
      label: "Ready minutes",
      value: `${totals?.estimatedMinutes ?? 0}m`,
      detail: totals
        ? `${totals.words.toLocaleString()} words across ${totals.batches} batches.`
        : "Generate or load a queue to see listening inventory.",
    },
    {
      label: "Extraction rate",
      value: `${extractionRate}%`,
      detail: totals
        ? `${totals.extracted}/${totals.fetched} fetched articles made it into the queue.`
        : run?.status === "failed"
          ? run.error?.message || "The active run failed before extraction completed."
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
        : result
          ? "The current run has no skipped articles."
          : "Load a successful run to inspect skip patterns.",
    },
    {
      label: "Batch cadence",
      value: averageBatchMinutes ? `${averageBatchMinutes}m` : "0m",
      detail: totals
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
      state.publicBatchLink = null;
      state.publicBatchLinkExpiresAt = null;
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
    elements.openBatchLink.href = "/";
    elements.openBatchLink.classList.add("disabled-link");
    elements.articleList.innerHTML = "";
    return;
  }

  elements.previewTitle.textContent = `Batch ${batch.index} preview`;
  elements.batchMeta.textContent = `${batch.articleCount} articles · ${batch.wordCount.toLocaleString()} words · ${batch.estimatedMinutes} minutes`;
  elements.previewFrame.srcdoc = batch.html;
  elements.copyBatchButton.disabled = false;
  renderPublicBatchLink(batch.index);
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
  elements.historySummary.textContent = buildHistorySummary();

  if (!state.recentRuns.length) {
    elements.historyList.innerHTML = '<div class="muted">No stored runs yet.</div>';
    return;
  }

  elements.historyList.innerHTML = state.recentRuns
    .map((run) => {
      const detailedRun = getRunDetail(run.id);
      const when = formatDate(run.generatedAt || run.completedAt || run.createdAt);
      const totals = run.totals
        ? `${run.totals.words.toLocaleString()} words · ${run.totals.estimatedMinutes} minutes`
        : run.error?.message || "Run has no totals yet.";
      const isActive = state.latestRun?.id === run.id;
      const isCompareTarget = state.compareRunId === run.id;
      const isExpanded = state.expandedHistoryRunId === run.id;
      const comparison = isCompareTarget ? compareRuns(state.latestRun, detailedRun || run) : null;

      return `
        <article class="history-card ${isActive ? "active" : ""} ${isCompareTarget ? "compare-target" : ""}">
          <div class="history-header">
            <strong>${escapeHtml(when)}</strong>
            <span class="history-status ${escapeHtml(run.status)}">${escapeHtml(run.status)}</span>
          </div>
          <p class="history-summary">${escapeHtml(totals)}</p>
          <p class="history-summary">Config: ${escapeHtml(compactConfig(run.config))}</p>
          <div class="history-actions">
            <button class="ghost-button" type="button" data-load-run="${escapeAttribute(run.id)}">Load</button>
            <button class="ghost-button" type="button" data-rerun-run="${escapeAttribute(run.id)}" ${state.loading ? "disabled" : ""}>Rerun</button>
            ${state.latestRun && state.latestRun.id !== run.id ? `<button class="ghost-button" type="button" data-compare-run="${escapeAttribute(run.id)}">${isCompareTarget ? "Clear compare" : "Compare"}</button>` : ""}
            <button class="ghost-button" type="button" data-details-run="${escapeAttribute(run.id)}">${isExpanded ? "Hide details" : "Details"}</button>
          </div>
          ${renderHistoryDiagnostics(run, detailedRun, comparison, isExpanded)}
        </article>
      `;
    })
    .join("");

  attachHistoryHandlers();
}

function renderHistoryDiagnostics(run, detailedRun, comparison, isExpanded) {
  if (!isExpanded) {
    return "";
  }

  const detailRun = detailedRun || run;
  const topSkipReason = findTopSkipReason(detailRun.result?.skipped || []);
  const details = [];

  if (detailRun.totals) {
    details.push(`${detailRun.totals.fetched} fetched`);
    details.push(`${detailRun.totals.extracted} extracted`);
    details.push(`${detailRun.totals.skipped} skipped`);
    details.push(`${detailRun.totals.batches} batches`);
  }

  if (detailRun.startedAt && detailRun.completedAt) {
    details.push(`runtime ${formatDuration(detailRun.startedAt, detailRun.completedAt)}`);
  }

  const detailChips = details.length
    ? `<div class="history-diagnostics">${details
        .map((detail) => `<span class="detail-chip">${escapeHtml(detail)}</span>`)
        .join("")}</div>`
    : "";

  const diagnostics = [];

  if (detailRun.status === "failed" && detailRun.error) {
    diagnostics.push(
      `<p><strong>Failure:</strong> ${escapeHtml(detailRun.error.code)} · ${escapeHtml(detailRun.error.message)}</p>`,
    );

    if (detailRun.error.details !== undefined) {
      diagnostics.push(
        `<p><strong>Context:</strong> ${escapeHtml(compactValue(detailRun.error.details))}</p>`,
      );
    }
  } else if (detailRun.result) {
    diagnostics.push(
      `<p><strong>Queue shape:</strong> ${escapeHtml(describeBatchMix(detailRun.result))}</p>`,
    );

    diagnostics.push(
      `<p><strong>Skip diagnostics:</strong> ${escapeHtml(
        topSkipReason
          ? `${detailRun.result.skipped.length} skipped, dominated by "${topSkipReason.reason}" (${topSkipReason.count}).`
          : "No skipped articles in this run.",
      )}</p>`,
    );

    if (detailRun.result.processed) {
      diagnostics.push(
        `<p><strong>Processed move:</strong> ${escapeHtml(describeProcessedMove(detailRun.result.processed))}</p>`,
      );
    }
  } else {
    diagnostics.push(
      `<p><strong>Status:</strong> ${escapeHtml(detailRun.status)}. This run does not have stored output yet.</p>`,
    );
  }

  if (comparison) {
    diagnostics.push(
      `<p><strong>Comparison vs active:</strong> ${escapeHtml(comparison.summary)}</p>`,
    );

    if (comparison.deltas.length) {
      diagnostics.push(
        `<div class="delta-list">${comparison.deltas
          .map((delta) => `<span class="detail-chip">${escapeHtml(delta)}</span>`)
          .join("")}</div>`,
      );
    }
  }

  return `
    <div class="history-detail">
      ${detailChips}
      ${diagnostics.join("")}
    </div>
  `;
}

function attachHistoryHandlers() {
  elements.historyList.querySelectorAll("[data-load-run]").forEach((button) => {
    button.addEventListener("click", () => {
      void handleLoadRun(button.getAttribute("data-load-run"));
    });
  });

  elements.historyList.querySelectorAll("[data-rerun-run]").forEach((button) => {
    button.addEventListener("click", () => {
      void handleRerunRun(button.getAttribute("data-rerun-run"));
    });
  });

  elements.historyList.querySelectorAll("[data-compare-run]").forEach((button) => {
    button.addEventListener("click", () => {
      void handleCompareRun(button.getAttribute("data-compare-run"));
    });
  });

  elements.historyList.querySelectorAll("[data-details-run]").forEach((button) => {
    button.addEventListener("click", () => {
      void handleToggleRunDetails(button.getAttribute("data-details-run"));
    });
  });
}

async function handleLoadRun(runId) {
  if (!runId) {
    return;
  }

  try {
    const run = await fetchRun(runId);
    useRun(run, { hydrate: true, preserveComparison: false });
    state.expandedHistoryRunId = run.id;
    setRunStatus("Run loaded from history.", `Run ${run.id} is now active.`);
    render();
  } catch (error) {
    setRunStatus("Could not load historical run.", error.message || "Unexpected error.");
  }
}

async function handleRerunRun(runId) {
  if (!runId || state.loading) {
    return;
  }

  const run = state.recentRuns.find((item) => item.id === runId);

  if (!run) {
    return;
  }

  hydrateForm(run.config);

  await executeRun(buildQueryStringFromConfig(run.config), {
    start: "Rerun started.",
    startMeta: `Replaying the saved configuration from run ${run.id}.`,
    queued: "Rerun queued.",
    success: "Rerun finished.",
    successMeta: (completedRun) => `Run ${completedRun.id} completed from saved config ${run.id}.`,
    failure: "Rerun failed.",
  });
}

async function handleCompareRun(runId) {
  if (!runId || !state.latestRun) {
    return;
  }

  if (state.compareRunId === runId) {
    state.compareRunId = null;
    setRunStatus("Comparison cleared.", `Run ${state.latestRun.id} remains active.`);
    render();
    return;
  }

  try {
    await fetchRun(runId);
    state.compareRunId = runId;
    state.expandedHistoryRunId = runId;
    setRunStatus("Comparison ready.", `Comparing active run ${state.latestRun.id} against ${runId}.`);
    render();
  } catch (error) {
    setRunStatus("Could not load comparison run.", error.message || "Unexpected error.");
  }
}

async function handleToggleRunDetails(runId) {
  if (!runId) {
    return;
  }

  if (state.expandedHistoryRunId === runId) {
    state.expandedHistoryRunId = null;
    render();
    return;
  }

  try {
    await fetchRun(runId);
    state.expandedHistoryRunId = runId;
    render();
  } catch (error) {
    setRunStatus("Could not load run diagnostics.", error.message || "Unexpected error.");
  }
}

function buildHistorySummary() {
  const comparisonRun = getRunDetail(state.compareRunId);

  if (state.latestRun && comparisonRun) {
    const comparison = compareRuns(state.latestRun, comparisonRun);

    if (comparison) {
      return comparison.summary;
    }
  }

  if (state.latestRun) {
    return `Active run ${state.latestRun.id} is loaded. Use history to load another run, rerun its config, inspect diagnostics, or compare against the active run.`;
  }

  return "Use history to load a stored run, rerun with the same config, inspect diagnostics, or compare against the active run.";
}

async function executeRun(queryString, messages) {
  if (state.loading) {
    return;
  }

  state.loading = true;
  setRunStatus(messages.start, messages.startMeta);
  render();

  try {
    const createResponse = await api(`/api/runs${queryString}`, { method: "POST" });
    const { run, links } = createResponse;

    setRunStatus(messages.queued, `Run ${run.id} is being processed.`);

    const processPromise = fetch(links.process, {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => null);

    const completedRun = cacheRun(await pollRun(links.status, run.id));
    await processPromise;
    await refreshHistory();

    useRun(completedRun, { hydrate: false, preserveComparison: false });
    state.expandedHistoryRunId = completedRun.id;

    if (!completedRun.result) {
      throw new Error(completedRun.error?.message || "Run finished without a result payload.");
    }

    setRunStatus(messages.success, messages.successMeta(completedRun));
  } catch (error) {
    setRunStatus(messages.failure, error.message || "Unexpected error during generation.");
  } finally {
    state.loading = false;
    render();
  }
}

async function fetchRun(runId) {
  const cached = getRunDetail(runId);

  if (cached?.result || cached?.error || cached?.status === "queued" || cached?.status === "running") {
    return cached;
  }

  const payload = await api(`/api/runs/${encodeURIComponent(runId)}`);
  return cacheRun(payload.run);
}

function useRun(run, { hydrate = true, preserveComparison = false } = {}) {
  state.latestRun = cacheRun(run);
  state.selectedBatchIndex = run.result?.batches[0]?.index ?? null;
  state.publicBatchLink = null;
  state.publicBatchLinkExpiresAt = null;

  if (!preserveComparison) {
    state.compareRunId = null;
  } else if (state.compareRunId === run.id) {
    state.compareRunId = null;
  }

  if (hydrate) {
    hydrateForm(run.config);
  }
}

function cacheRun(run) {
  state.runDetails[run.id] = run;
  return run;
}

function getRunDetail(runId) {
  if (!runId) {
    return null;
  }

  return state.runDetails[runId] || null;
}

function toRunRecordFromLatestPayload(payload) {
  return {
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

function buildQueryStringFromConfig(config) {
  const params = new URLSearchParams();

  for (const [configKey, queryKey] of Object.entries(CONFIG_QUERY_KEYS)) {
    const value = config[configKey];

    if (value !== undefined && value !== null && value !== "") {
      params.set(queryKey, String(value));
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

function getSelectedBatch() {
  return state.latestRun?.result?.batches.find((batch) => batch.index === state.selectedBatchIndex) || null;
}

function renderPublicBatchLink(batchIndex) {
  const hasCurrentLink =
    typeof state.publicBatchLink === "string" &&
    state.publicBatchLink.includes(`/api/runs/${state.latestRun.id}/html?`) &&
    state.publicBatchLink.includes(`batch=${batchIndex}`);

  if (hasCurrentLink) {
    elements.openBatchLink.href = state.publicBatchLink;
    elements.openBatchLink.classList.remove("disabled-link");
    return;
  }

  elements.openBatchLink.href = "/";
  elements.openBatchLink.classList.add("disabled-link");
  void loadPublicBatchLink(batchIndex);
}

async function loadPublicBatchLink(batchIndex) {
  if (!state.latestRun) {
    return;
  }

  try {
    const payload = await api(`/api/runs/${state.latestRun.id}/html-link?batch=${batchIndex}`);

    if (!state.latestRun || state.selectedBatchIndex !== batchIndex) {
      return;
    }

    state.publicBatchLink = payload.publicUrl;
    state.publicBatchLinkExpiresAt = payload.expiresAt;
    elements.openBatchLink.href = payload.publicUrl;
    elements.openBatchLink.classList.remove("disabled-link");
  } catch (error) {
    console.error(error);
    setRunStatus("Could not mint a public batch link.", error.message || "Unexpected error.");
  }
}

function compareRuns(activeRun, otherRun) {
  if (!activeRun || !otherRun || activeRun.id === otherRun.id) {
    return null;
  }

  if (!activeRun.totals || !otherRun.totals) {
    if (activeRun.error || otherRun.error) {
      return {
        summary: `Active run ${activeRun.id} and run ${otherRun.id} cannot be compared by totals because at least one run failed.`,
        deltas: [],
      };
    }

    return null;
  }

  const deltas = [
    formatDelta("minutes", activeRun.totals.estimatedMinutes - otherRun.totals.estimatedMinutes),
    formatDelta("articles", activeRun.totals.extracted - otherRun.totals.extracted),
    formatDelta("skips", activeRun.totals.skipped - otherRun.totals.skipped),
    formatDelta("batches", activeRun.totals.batches - otherRun.totals.batches),
  ];

  return {
    summary: `Comparing active run ${activeRun.id} against ${otherRun.id}: ${deltas.join(", ")}.`,
    deltas,
  };
}

function describeBatchMix(result) {
  if (!result.batches.length) {
    return "No batches were generated.";
  }

  const longestBatch = [...result.batches].sort((left, right) => right.wordCount - left.wordCount)[0];
  return `${result.batches.length} batches, averaging ${Math.round(result.totals.estimatedMinutes / result.totals.batches)} minutes. Largest batch: ${longestBatch.articleCount} articles and ${longestBatch.estimatedMinutes} minutes.`;
}

function describeProcessedMove(processed) {
  if (processed.failed > 0) {
    return `${processed.moved}/${processed.attempted} articles moved to collection ${processed.destinationCollectionId}. ${processed.failed} move failures remain.`;
  }

  return `${processed.moved}/${processed.attempted} articles moved to collection ${processed.destinationCollectionId}.`;
}

function compactValue(value) {
  try {
    const normalized =
      typeof value === "string" ? value : JSON.stringify(value);

    return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
  } catch {
    return String(value);
  }
}

function formatDelta(label, value) {
  if (value === 0) {
    return `${label} unchanged`;
  }

  return `${label} ${value > 0 ? "+" : ""}${value}`;
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

function formatDuration(startedAt, completedAt) {
  const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return "under 1s";
  }

  const seconds = Math.round(durationMs / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainderSeconds = seconds % 60;

  return remainderSeconds ? `${minutes}m ${remainderSeconds}s` : `${minutes}m`;
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
