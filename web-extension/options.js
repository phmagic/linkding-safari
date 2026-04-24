const extensionApi = globalThis.browser ?? globalThis.chrome;

const elements = {
  status: document.querySelector("#status"),
  form: document.querySelector("#settingsForm"),
  baseUrl: document.querySelector("#baseUrl"),
  token: document.querySelector("#token"),
  defaultTags: document.querySelector("#defaultTags"),
  markUnread: document.querySelector("#markUnread"),
  markArchived: document.querySelector("#markArchived"),
  shared: document.querySelector("#shared"),
  test: document.querySelector("#test")
};

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

function readForm() {
  return {
    baseUrl: elements.baseUrl.value.trim(),
    token: elements.token.value.trim(),
    defaultTags: elements.defaultTags.value.trim(),
    markUnread: elements.markUnread.checked,
    markArchived: elements.markArchived.checked,
    shared: elements.shared.checked
  };
}

function fillForm(settings) {
  elements.baseUrl.value = settings.baseUrl || "";
  elements.token.value = settings.token || "";
  elements.defaultTags.value = settings.defaultTags || "";
  elements.markUnread.checked = Boolean(settings.markUnread);
  elements.markArchived.checked = Boolean(settings.markArchived);
  elements.shared.checked = Boolean(settings.shared);
}

async function saveSettings() {
  await message("save-settings", { settings: readForm() });
  setStatus("Settings saved.", "success");
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await saveSettings();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

elements.test.addEventListener("click", async () => {
  elements.test.disabled = true;
  try {
    await saveSettings();
    await message("test-connection");
    setStatus("Connection works.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    elements.test.disabled = false;
  }
});

message("get-settings")
  .then(fillForm)
  .catch((error) => setStatus(error.message, "error"));
