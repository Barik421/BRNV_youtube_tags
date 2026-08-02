try {
  importScripts("local-api-key.js");
} catch (error) {
  // Optional local-only API key file is not required.
}

const API_KEY_STORAGE_KEY = "youtubeApiKey";
const CACHE_STORAGE_KEY = "videoTagsCache";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const LOCAL_API_KEY = typeof self.BRNV_YOUTUBE_API_KEY === "string"
  ? self.BRNV_YOUTUBE_API_KEY
  : "";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return false;
  }

  if (message.type === "GET_TAGS") {
    handleGetTags(message.videoId)
      .then(sendResponse)
      .catch((error) => {
        console.error("BRNV YouTube Tags:", error);
        sendResponse({ ok: false, tags: [] });
      });
    return true;
  }

  if (message.type === "GET_API_KEY") {
    getStoredApiKey()
      .then((apiKey) => sendResponse({ ok: true, apiKey }))
      .catch((error) => {
        console.error("BRNV YouTube Tags:", error);
        sendResponse({ ok: false, apiKey: "" });
      });
    return true;
  }

  if (message.type === "SAVE_API_KEY") {
    saveApiKey(message.apiKey)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.error("BRNV YouTube Tags:", error);
        sendResponse({ ok: false });
      });
    return true;
  }

  return false;
});

async function handleGetTags(videoId) {
  if (!isValidVideoId(videoId)) {
    return { ok: false, tags: [] };
  }

  const cachedTags = await getCachedTags(videoId);
  if (cachedTags) {
    return { ok: true, tags: cachedTags };
  }

  const apiKey = await getStoredApiKey();
  if (!apiKey) {
    console.error("BRNV YouTube Tags: YouTube Data API key is not set.");
    return { ok: false, reason: "missing-api-key", tags: [] };
  }

  const tags = await fetchVideoTags(videoId, apiKey);
  await setCachedTags(videoId, tags);
  return { ok: true, tags };
}

function isValidVideoId(videoId) {
  return typeof videoId === "string" && /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

async function fetchVideoTags(videoId, apiKey) {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`YouTube Data API request failed with status ${response.status}`);
  }

  const data = await response.json();
  const tags = data && data.items && data.items[0] && data.items[0].snippet
    ? data.items[0].snippet.tags
    : [];

  return Array.isArray(tags) ? tags.filter((tag) => typeof tag === "string") : [];
}

async function getStoredApiKey() {
  const data = await chrome.storage.local.get(API_KEY_STORAGE_KEY);
  const storedApiKey = typeof data[API_KEY_STORAGE_KEY] === "string" ? data[API_KEY_STORAGE_KEY] : "";
  return storedApiKey || LOCAL_API_KEY;
}

async function saveApiKey(apiKey) {
  const value = typeof apiKey === "string" ? apiKey.trim() : "";
  await chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: value });
}

async function getCachedTags(videoId) {
  const data = await chrome.storage.local.get(CACHE_STORAGE_KEY);
  const cache = data[CACHE_STORAGE_KEY] && typeof data[CACHE_STORAGE_KEY] === "object"
    ? data[CACHE_STORAGE_KEY]
    : {};
  const entry = cache[videoId];

  if (!entry || !Array.isArray(entry.tags) || typeof entry.savedAt !== "number") {
    return null;
  }

  if (Date.now() - entry.savedAt > CACHE_TTL_MS) {
    delete cache[videoId];
    await chrome.storage.local.set({ [CACHE_STORAGE_KEY]: cache });
    return null;
  }

  return entry.tags;
}

async function setCachedTags(videoId, tags) {
  const data = await chrome.storage.local.get(CACHE_STORAGE_KEY);
  const cache = data[CACHE_STORAGE_KEY] && typeof data[CACHE_STORAGE_KEY] === "object"
    ? data[CACHE_STORAGE_KEY]
    : {};

  cache[videoId] = {
    tags,
    savedAt: Date.now()
  };

  await chrome.storage.local.set({ [CACHE_STORAGE_KEY]: cache });
}
