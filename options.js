const apiKeyInput = document.getElementById("api-key");
const saveButton = document.getElementById("save-key");
const statusText = document.getElementById("status");

document.addEventListener("DOMContentLoaded", loadApiKey);
saveButton.addEventListener("click", saveApiKey);

function loadApiKey() {
  chrome.runtime.sendMessage({ type: "GET_API_KEY" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("BRNV YouTube Tags:", chrome.runtime.lastError.message);
      return;
    }

    apiKeyInput.value = response && typeof response.apiKey === "string" ? response.apiKey : "";
  });
}

function saveApiKey() {
  chrome.runtime.sendMessage({ type: "SAVE_API_KEY", apiKey: apiKeyInput.value }, (response) => {
    if (chrome.runtime.lastError || !response || !response.ok) {
      console.error("BRNV YouTube Tags:", chrome.runtime.lastError && chrome.runtime.lastError.message);
      setStatus("Не вдалося зберегти");
      return;
    }

    setStatus("Збережено");
  });
}

function setStatus(text) {
  statusText.textContent = text;
  window.setTimeout(() => {
    statusText.textContent = "";
  }, 1800);
}
