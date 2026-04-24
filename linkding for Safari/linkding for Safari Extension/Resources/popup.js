const extensionApi = globalThis.browser ?? globalThis.chrome;

const elements = {
  status: document.querySelector("#status"),
  setup: document.querySelector("#setup"),
  saving: document.querySelector("#saving"),
  saved: document.querySelector("#saved"),
  savedTitle: document.querySelector("#savedTitle"),
  error: document.querySelector("#error"),
  errorMessage: document.querySelector("#errorMessage"),
  editBookmark: document.querySelector("#editBookmark"),
  closePopup: document.querySelector("#closePopup"),
  retrySave: document.querySelector("#retrySave"),
  openOptions: document.querySelector("#openOptions"),
  openOptionsFromError: document.querySelector("#openOptionsFromError")
};

let savedBookmark = null;

function message(type, payload = {}) {
  return new Promise((resolve, reject) => {
    extensionApi.runtime.sendMessage({ type, ...payload }, (response) => {
      const error = extensionApi.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Extension request failed."));
        return;
      }
      resolve(response.result);
    });
  });
}

function setStatus(text, tone = "") {
  elements.status.textContent = text;
  elements.status.dataset.tone = tone;
}

function showOnly(section) {
  for (const element of [elements.setup, elements.saving, elements.saved, elements.error]) {
    element.classList.toggle("hidden", element !== section);
  }
}

function isConfigured(settings) {
  return Boolean(settings.baseUrl?.trim() && settings.token?.trim());
}

async function saveCurrentTab() {
  showOnly(elements.saving);
  setStatus("Saving...");

  try {
    savedBookmark = await message("save-current-tab");
    elements.savedTitle.textContent = savedBookmark?.title || savedBookmark?.url || "The current page was saved.";
    showOnly(elements.saved);
    setStatus("Bookmark saved.", "success");
  } catch (error) {
    elements.errorMessage.textContent = error.message;
    showOnly(elements.error);
    setStatus("Save failed.", "error");
  }
}

async function load() {
  const settings = await message("get-settings");
  if (!isConfigured(settings)) {
    showOnly(elements.setup);
    setStatus("Settings required", "warning");
    return;
  }

  await saveCurrentTab();
}

elements.editBookmark.addEventListener("click", async () => {
  const path = savedBookmark?.id ? `/bookmarks/${savedBookmark.id}/edit` : "";
  await message("open-linkding", { path });
  window.close();
});

elements.closePopup.addEventListener("click", () => {
  window.close();
});

elements.retrySave.addEventListener("click", saveCurrentTab);

elements.openOptions.addEventListener("click", () => {
  extensionApi.runtime.openOptionsPage();
});

elements.openOptionsFromError.addEventListener("click", () => {
  extensionApi.runtime.openOptionsPage();
});

load().catch((error) => {
  elements.errorMessage.textContent = error.message;
  showOnly(elements.error);
  setStatus("Save failed.", "error");
});
