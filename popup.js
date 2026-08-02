const urlInput = document.getElementById("video-url");
const getTagsButton = document.getElementById("get-tags");
const copyAllButton = document.getElementById("copy-all");
const tagCount = document.getElementById("tag-count");
const statusMessage = document.getElementById("status-message");
const tagsList = document.getElementById("tags-list");
let currentTags = [];
let activeTab = null;

document.addEventListener("DOMContentLoaded", initializePopup);
getTagsButton.addEventListener("click", handleGetTags);
copyAllButton.addEventListener("click", handleCopyAll);

async function initializePopup() {
  activeTab = await getActiveTab();
  const activeUrl = activeTab && activeTab.url ? activeTab.url : "";
  if (activeUrl && extractVideoId(activeUrl)) {
    urlInput.value = activeUrl;
    handleGetTags();
  }
}

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error("BRNV YouTube Tags:", chrome.runtime.lastError.message);
        resolve(null);
        return;
      }
      resolve(tabs && tabs[0] ? tabs[0] : null);
    });
  });
}

async function handleGetTags() {
  const videoId = extractVideoId(urlInput.value.trim());
  if (!videoId) {
    renderTags([]);
    setStatus("Paste a valid YouTube video link.");
    return;
  }

  getTagsButton.disabled = true;
  getTagsButton.textContent = "Loading";

  const pageTags = await requestPageTags(videoId);
  const result = pageTags.length ? { tags: pageTags, reason: "" } : await requestTags(videoId);
  const tags = result.tags;
  renderTags(tags);
  setStatus(result.reason === "missing-api-key" ? "Add your YouTube Data API key in extension options first." : "");

  getTagsButton.disabled = false;
  getTagsButton.textContent = "Get tags";
}

function extractVideoId(input) {
  let url;
  try {
    url = new URL(input);
  } catch (error) {
    return "";
  }

  const host = url.hostname.replace(/^www\./, "");
  const pathParts = url.pathname.split("/").filter(Boolean);

  if ((host === "youtube.com" || host === "m.youtube.com") && url.pathname === "/watch") {
    return normalizeVideoId(url.searchParams.get("v"));
  }

  if (host === "youtu.be") {
    return normalizeVideoId(pathParts[0]);
  }

  if ((host === "youtube.com" || host === "m.youtube.com") && (pathParts[0] === "embed" || pathParts[0] === "live")) {
    return normalizeVideoId(pathParts[1]);
  }

  return "";
}

function normalizeVideoId(videoId) {
  return typeof videoId === "string" && /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : "";
}

function requestTags(videoId) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_TAGS", videoId }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("BRNV YouTube Tags:", chrome.runtime.lastError.message);
        resolve({ tags: [], reason: "runtime-error" });
        return;
      }
      resolve({
        tags: response && Array.isArray(response.tags) ? response.tags : [],
        reason: response && typeof response.reason === "string" ? response.reason : ""
      });
    });
  });
}

function requestPageTags(videoId) {
  return new Promise((resolve) => {
    if (!activeTab || !activeTab.id || extractVideoId(activeTab.url || "") !== videoId) {
      resolve([]);
      return;
    }

    chrome.tabs.sendMessage(activeTab.id, { type: "GET_PAGE_TAGS", videoId }, (response) => {
      if (chrome.runtime.lastError) {
        resolve([]);
        return;
      }

      resolve(response && Array.isArray(response.tags) ? response.tags : []);
    });
  });
}

function renderTags(tags) {
  currentTags = tags;
  tagsList.textContent = "";
  tagCount.textContent = `${tags.length} ${tags.length === 1 ? "tag" : "tags"}`;
  copyAllButton.disabled = tags.length === 0;

  tags.forEach((tag) => {
    const item = document.createElement("span");
    item.className = "tag";
    item.textContent = tag;
    tagsList.append(item);
  });
}

function setStatus(text) {
  statusMessage.textContent = text;
}

async function handleCopyAll() {
  if (!currentTags.length) {
    return;
  }

  try {
    await navigator.clipboard.writeText(currentTags.join(", "));
    copyAllButton.textContent = "Copied";
    window.setTimeout(() => {
      copyAllButton.textContent = "Copy all";
    }, 1300);
  } catch (error) {
    console.error("BRNV YouTube Tags:", error);
  }
}
