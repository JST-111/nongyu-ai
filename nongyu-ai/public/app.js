const copyForm = document.getElementById("copyForm");
const productNameInput = document.getElementById("productName");
const placeInput = document.getElementById("place");
const featuresInput = document.getElementById("features");
const styleSelect = document.getElementById("style");
const exampleButton = document.getElementById("exampleButton");
const generateButton = document.getElementById("generateButton");

const resultSubtitle = document.getElementById("resultSubtitle");
const emptyState = document.getElementById("emptyState");
const resultList = document.getElementById("resultList");
const copyAllButton = document.getElementById("copyAllButton");

const scorePanel = document.getElementById("scorePanel");
const overallScore = document.getElementById("overallScore");
const scoreList = document.getElementById("scoreList");
const scoreAdvice = document.getElementById("scoreAdvice");

const toast = document.getElementById("toast");
const connectionState = document.getElementById("connectionState");
const connectionText = connectionState.querySelector(".connection-text");

const defaultGenerateButtonText = generateButton.innerHTML;
let currentCopies = [];
let toastTimer;
let isGenerating = false;

function setConnectionState(state, message) {
  connectionState.dataset.state = state;
  connectionText.textContent = message;
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function setBusy(busy) {
  isGenerating = busy;
  generateButton.disabled = busy;
  generateButton.setAttribute("aria-busy", String(busy));
  generateButton.innerHTML = busy
    ? '<span aria-hidden="true">⏳</span> 正在生成，请稍候'
    : defaultGenerateButtonText;
}

async function requestGeneration(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      credentials: "same-origin",
      signal: controller.signal
    });

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("服务器返回了无法识别的内容");
    }

    if (!response.ok || !result.ok) {
      const message =
        result?.error?.message ?? `生成失败（HTTP ${response.status}）`;
      const error = new Error(message);
      error.status = response.status;
      error.fields = result?.error?.fields;
      throw error;
    }

    return result;
  } finally {
    clearTimeout(timeout);
  }
}

function createCopyCard(copy, index, styleLabel) {
  const card = document.createElement("article");
  card.className = "copy-card";

  const header = document.createElement("div");
  header.className = "copy-card-head";

  const versionTag = document.createElement("span");
  versionTag.className = "version-tag";
  versionTag.textContent = `${styleLabel} · 版本 ${index + 1}`;

  const copyButton = document.createElement("button");
  copyButton.className = "copy-button";
  copyButton.type = "button";
  copyButton.dataset.index = String(index);
  copyButton.textContent = "复制";

  const copyText = document.createElement("p");
  copyText.className = "copy-text";
  copyText.textContent = copy;

  header.append(versionTag, copyButton);
  card.append(header, copyText);
  return card;
}

function renderResults(styleLabel, copies) {
  emptyState.hidden = true;
  resultList.hidden = false;
  copyAllButton.disabled = copies.length === 0;
  resultList.replaceChildren(
    ...copies.map((copy, index) => createCopyCard(copy, index, styleLabel))
  );
}

function createScoreItem(item) {
  const value = Math.max(0, Math.min(100, Number(item.value) || 0));
  const container = document.createElement("div");
  container.className = "score-item";

  const labelRow = document.createElement("div");
  labelRow.className = "score-label";
  const label = document.createElement("span");
  label.textContent = item.label;
  const score = document.createElement("strong");
  score.textContent = String(value);
  labelRow.append(label, score);

  const track = document.createElement("div");
  track.className = "score-track";
  const fill = document.createElement("div");
  fill.className = "score-fill";
  fill.style.width = `${value}%`;
  track.append(fill);

  const note = document.createElement("p");
  note.className = "score-note";
  note.textContent = item.note;

  container.append(labelRow, track, note);
  return container;
}

function renderEvaluation(evaluation) {
  scorePanel.hidden = false;
  overallScore.textContent = String(evaluation.overall);
  scoreAdvice.textContent = `💡 ${evaluation.advice}`;
  scoreList.replaceChildren(
    ...evaluation.items.map((item) => createScoreItem(item))
  );
}

async function copyText(text, clickedButton = null) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const temporaryInput = document.createElement("textarea");
    temporaryInput.value = text;
    temporaryInput.style.position = "fixed";
    temporaryInput.style.left = "-9999px";
    document.body.appendChild(temporaryInput);
    temporaryInput.select();
    document.execCommand("copy");
    temporaryInput.remove();
  }

  showToast("文案已复制，可以直接粘贴使用");

  if (clickedButton) {
    const originalText = clickedButton.textContent;
    clickedButton.textContent = "已复制 ✓";
    clickedButton.classList.add("copied");
    setTimeout(() => {
      clickedButton.textContent = originalText;
      clickedButton.classList.remove("copied");
    }, 1300);
  }
}

async function generateCopy(event) {
  event.preventDefault();
  if (isGenerating) {
    return;
  }

  if (!copyForm.reportValidity()) {
    return;
  }

  const payload = {
    productName: productNameInput.value,
    place: placeInput.value,
    features: featuresInput.value,
    style: styleSelect.value
  };

  setBusy(true);
  resultSubtitle.textContent = "正在请求后端生成文案并计算传播评分…";

  try {
    const result = await requestGeneration(payload);
    currentCopies = result.copies;
    renderResults(result.styleLabel, result.copies);
    renderEvaluation(result.evaluation);
    resultSubtitle.textContent =
      `当前渠道：${result.styleLabel} · 由本站后端生成 · 再点一次可换一批`;
    setConnectionState("online", "前后端连接正常，可继续生成");
  } catch (error) {
    const message =
      error.name === "AbortError"
        ? "请求超时，请检查网络后重试"
        : error.message || "生成失败，请稍后重试";

    resultSubtitle.textContent = "生成失败，请检查连接后重试。";
    showToast(message);

    if (!navigator.onLine || error.status === 429) {
      setConnectionState(
        "offline",
        error.status === 429 ? "请求过于频繁，请稍后再试" : "网络连接已断开"
      );
    }
  } finally {
    setBusy(false);
  }
}

async function checkBackend() {
  setConnectionState("checking", "正在连接本站后端…");

  try {
    const response = await fetch("/api/health", {
      cache: "no-store",
      credentials: "same-origin"
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error("health check failed");
    }

    setConnectionState("online", "前后端连接正常，可开始生成");
  } catch {
    setConnectionState(
      "offline",
      "未连接后端，请通过服务器网址打开，不要直接双击 HTML 文件"
    );
    resultSubtitle.textContent =
      "后端未连接。若你在本机运行，请执行 npm start 后访问显示的网址。";
  }
}

copyForm.addEventListener("submit", generateCopy);

copyAllButton.addEventListener("click", () => {
  if (currentCopies.length > 0) {
    copyText(currentCopies.join("\n\n---\n\n"));
  }
});

resultList.addEventListener("click", (event) => {
  const button = event.target.closest(".copy-button");
  if (!button) {
    return;
  }

  const index = Number(button.dataset.index);
  const copy = currentCopies[index];
  if (typeof copy === "string") {
    copyText(copy, button);
  }
});

exampleButton.addEventListener("click", () => {
  productNameInput.value = "烟台苹果";
  placeInput.value = "山东烟台";
  featuresInput.value = "脆甜多汁、生态种植、产地直发";
  styleSelect.value = "short";
  productNameInput.focus();
});

checkBackend();
