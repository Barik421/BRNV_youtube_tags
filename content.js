const BLOCK_ID = "brnv-youtube-tags-block";
let currentVideoId = "";
let updateTimer = 0;

document.addEventListener("yt-navigate-finish", scheduleUpdate);
window.addEventListener("popstate", scheduleUpdate);
scheduleUpdate();

function scheduleUpdate() {
  window.clearTimeout(updateTimer);
  updateTimer = window.setTimeout(updateForCurrentPage, 250);
}

async function updateForCurrentPage() {
  const videoId = getWatchVideoId();

  if (!videoId) {
    currentVideoId = "";
    removeExistingBlock();
    return;
  }

  if (videoId === currentVideoId && document.getElementById(BLOCK_ID)) {
    return;
  }

  currentVideoId = videoId;
  removeExistingBlock();

  const mountTarget = await waitForMountTarget();
  if (!mountTarget || currentVideoId !== videoId) {
    return;
  }

  const tags = await requestTags(videoId);
  if (currentVideoId !== videoId) {
    return;
  }

  mountTarget.insertAdjacentElement("afterend", createTagsBlock(tags));
}

function getWatchVideoId() {
  if (location.pathname !== "/watch") {
    return "";
  }

  const videoId = new URLSearchParams(location.search).get("v") || "";
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : "";
}

function removeExistingBlock() {
  const existing = document.getElementById(BLOCK_ID);
  if (existing) {
    existing.remove();
  }
}

async function waitForMountTarget() {
  for (let index = 0; index < 30; index += 1) {
    const target = findMountTarget();
    if (target) {
      return target;
    }
    await delay(200);
  }
  return null;
}

function findMountTarget() {
  return document.querySelector("ytd-watch-metadata #bottom-row")
    || document.querySelector("ytd-watch-metadata #description")
    || document.querySelector("ytd-watch-metadata");
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function requestTags(videoId) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_TAGS", videoId }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("BRNV YouTube Tags:", chrome.runtime.lastError.message);
        resolve([]);
        return;
      }

      resolve(response && Array.isArray(response.tags) ? response.tags : []);
    });
  });
}

function createTagsBlock(tags) {
  const block = document.createElement("section");
  block.id = BLOCK_ID;
  block.className = "brnv-tags";

  if (!tags.length) {
    const label = document.createElement("span");
    label.className = "brnv-tags__label";
    label.textContent = "Tags";

    const empty = document.createElement("span");
    empty.className = "brnv-tags__empty";
    empty.textContent = "No tags found";

    block.append(label, empty);
    return block;
  }

  const header = document.createElement("div");
  header.className = "brnv-tags__header";

  const label = document.createElement("span");
  label.className = "brnv-tags__label";
  label.textContent = `Tags · ${tags.length}`;

  const preview = document.createElement("button");
  preview.className = "brnv-tags__preview";
  preview.type = "button";
  preview.textContent = tags.join(", ");

  const copyButton = document.createElement("button");
  copyButton.className = "brnv-tags__copy";
  copyButton.type = "button";
  copyButton.textContent = "Copy all";

  const arrow = document.createElement("button");
  arrow.className = "brnv-tags__arrow";
  arrow.type = "button";
  arrow.textContent = "↓";
  arrow.setAttribute("aria-label", "Expand tags");

  const expandedList = document.createElement("div");
  expandedList.className = "brnv-tags__list";
  expandedList.textContent = tags.join(", ");

  function setExpanded(isExpanded) {
    block.classList.toggle("brnv-tags--expanded", isExpanded);
    preview.setAttribute("aria-expanded", String(isExpanded));
    arrow.setAttribute("aria-expanded", String(isExpanded));
    arrow.textContent = isExpanded ? "↑" : "↓";
    arrow.setAttribute("aria-label", isExpanded ? "Collapse tags" : "Expand tags");
  }

  preview.setAttribute("aria-expanded", "false");
  arrow.setAttribute("aria-expanded", "false");

  preview.addEventListener("click", () => {
    setExpanded(!block.classList.contains("brnv-tags--expanded"));
  });

  arrow.addEventListener("click", () => {
    setExpanded(!block.classList.contains("brnv-tags--expanded"));
  });

  copyButton.addEventListener("click", async (event) => {
    await copyTags(tags);
    copyButton.textContent = "Copied";
    window.setTimeout(() => {
      copyButton.textContent = "Copy all";
    }, 1300);
  });

  header.append(label, preview, copyButton, arrow);
  block.append(header, expandedList);
  return block;
}

async function copyTags(tags) {
  const text = tags.join(", ");
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error("BRNV YouTube Tags:", error);
  }
}
