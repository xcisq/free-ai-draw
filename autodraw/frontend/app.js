const jobForm = document.getElementById("jobForm");
const submitBtn = document.getElementById("submitBtn");
const downloadBtn = document.getElementById("downloadBtn");
const jobIdEl = document.getElementById("jobId");
const jobStatusEl = document.getElementById("jobStatus");
const jobErrorEl = document.getElementById("jobError");
const responseBox = document.getElementById("responseBox");
const artifactList = document.getElementById("artifactList");

let currentJobId = null;
let currentBackendUrl = null;
let pollTimer = null;

jobForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const backendUrl = normalizeBaseUrl(document.getElementById("backendUrl").value);
  const payload = {
    method_text: document.getElementById("methodText").value.trim(),
    provider: document.getElementById("provider").value,
    api_key: emptyToNull(document.getElementById("apiKey").value),
    image_size: document.getElementById("imageSize").value,
    sam_backend: document.getElementById("samBackend").value,
    sam_api_url: emptyToNull(document.getElementById("samApiUrl").value),
    sam_api_key: emptyToNull(document.getElementById("samApiKey").value),
    optimize_iterations: parseInteger(document.getElementById("optimizeIterations").value, 0),
  };

  if (!payload.method_text) {
    renderError("method_text 不能为空");
    return;
  }

  clearPoll();
  currentJobId = null;
  currentBackendUrl = backendUrl;
  updateJobMeta({ jobId: "-", status: "submitting", error: "-" });
  artifactList.innerHTML = "";
  downloadBtn.disabled = true;
  submitBtn.disabled = true;

  try {
    const response = await fetch(`${backendUrl}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await parseJson(response);
    if (!response.ok) {
      throw new Error(extractError(data));
    }

    currentJobId = data.job_id;
    updateJobMeta({ jobId: data.job_id, status: data.status, error: "-" });
    renderJson(data);
    startPolling();
  } catch (error) {
    renderError(error.message || "提交任务失败");
    updateJobMeta({ jobId: "-", status: "failed", error: error.message || "提交任务失败" });
  } finally {
    submitBtn.disabled = false;
  }
});

downloadBtn.addEventListener("click", () => {
  if (!currentBackendUrl || !currentJobId) {
    return;
  }
  window.open(`${currentBackendUrl}/api/jobs/${encodeURIComponent(currentJobId)}/bundle`, "_blank");
});

function startPolling() {
  fetchJobStatus();
  pollTimer = window.setInterval(fetchJobStatus, 3000);
}

async function fetchJobStatus() {
  if (!currentBackendUrl || !currentJobId) {
    return;
  }

  try {
    const response = await fetch(
      `${currentBackendUrl}/api/jobs/${encodeURIComponent(currentJobId)}`
    );
    const data = await parseJson(response);
    if (!response.ok) {
      throw new Error(extractError(data));
    }

    renderJson(data);
    updateJobMeta({
      jobId: data.job_id || currentJobId,
      status: data.status || "-",
      error: data.error_message || "-",
    });
    renderArtifacts(data.artifacts || []);

    const canDownload = Boolean(data.bundle_url) && data.status === "succeeded";
    downloadBtn.disabled = !canDownload;

    if (data.status === "succeeded" || data.status === "failed") {
      clearPoll();
    }
  } catch (error) {
    updateJobMeta({
      jobId: currentJobId,
      status: "poll_error",
      error: error.message || "轮询失败",
    });
    renderError(error.message || "轮询失败");
    clearPoll();
  }
}

function renderArtifacts(artifacts) {
  artifactList.innerHTML = "";
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    const item = document.createElement("li");
    item.textContent = "暂无产物";
    artifactList.appendChild(item);
    return;
  }

  for (const artifact of artifacts) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `${currentBackendUrl}${artifact.download_url}`;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = `${artifact.kind}: ${artifact.path}`;
    item.appendChild(link);
    artifactList.appendChild(item);
  }
}

function updateJobMeta({ jobId, status, error }) {
  jobIdEl.textContent = jobId;
  jobStatusEl.textContent = status;
  jobErrorEl.textContent = error;
}

function renderJson(value) {
  responseBox.textContent = JSON.stringify(value, null, 2);
}

function renderError(message) {
  responseBox.textContent = `Error: ${message}`;
}

function clearPoll() {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

function normalizeBaseUrl(value) {
  return (value || "").trim().replace(/\/+$/, "");
}

function emptyToNull(value) {
  const normalized = (value || "").trim();
  return normalized ? normalized : null;
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    return { raw: text };
  }
}

function extractError(data) {
  if (data && typeof data.detail === "string") {
    return data.detail;
  }
  if (data && typeof data.error_message === "string") {
    return data.error_message;
  }
  if (data && typeof data.raw === "string") {
    return data.raw;
  }
  return "请求失败";
}
