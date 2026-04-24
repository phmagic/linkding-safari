const extensionApi = globalThis.browser ?? globalThis.chrome;

const DEFAULT_SETTINGS = {
  baseUrl: "",
  token: "",
  defaultTags: "",
  markUnread: false,
  markArchived: false,
  shared: false
};

function storageGet(keys) {
  return new Promise((resolve) => extensionApi.storage.sync.get(keys, resolve));
}

function storageSet(values) {
  return new Promise((resolve) => extensionApi.storage.sync.set(values, resolve));
}

function queryTabs(query) {
  return new Promise((resolve) => extensionApi.tabs.query(query, resolve));
}

function createTab(createProperties) {
  return new Promise((resolve) => extensionApi.tabs.create(createProperties, resolve));
}

function updateTab(tabId, updateProperties) {
  return new Promise((resolve) => extensionApi.tabs.update(tabId, updateProperties, resolve));
}

function sendResponseAsync(handler, sendResponse) {
  handler()
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
}

function normalizeBaseUrl(value) {
  const trimmed = (value || "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("Set your linkding URL in extension settings.");
  }
  const url = new URL(trimmed);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("The linkding URL must start with http:// or https://.");
  }
  return url.toString().replace(/\/+$/, "");
}

async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...(await storageGet(DEFAULT_SETTINGS)) };
}

function assertConfigured(settings) {
  normalizeBaseUrl(settings.baseUrl);
  if (!settings.token.trim()) {
    throw new Error("Set your linkding API token in extension settings.");
  }
}

async function linkdingRequest(path, options = {}) {
  const settings = await getSettings();
  assertConfigured(settings);
  const baseUrl = normalizeBaseUrl(settings.baseUrl);
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Accept": "application/json",
      "Authorization": `Token ${settings.token.trim()}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`linkding returned ${response.status}: ${body || response.statusText}`);
  }

  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function parseTags(value) {
  return (value || "")
    .split(/[,\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

async function currentTab() {
  const tabs = await queryTabs({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !tab.url) {
    throw new Error("No active Safari tab found.");
  }
  return {
    id: tab.id,
    title: tab.title || "",
    url: tab.url
  };
}

async function checkBookmark(url) {
  return linkdingRequest(`/api/bookmarks/check/?url=${encodeURIComponent(url)}`);
}

async function saveBookmark(input) {
  const settings = await getSettings();
  const tagNames = [
    ...parseTags(settings.defaultTags),
    ...parseTags(input.tags)
  ];

  const payload = {
    url: input.url,
    title: input.title || "",
    notes: input.notes || "",
    is_archived: Boolean(input.isArchived),
    unread: Boolean(input.unread),
    shared: Boolean(input.shared),
    tag_names: [...new Set(tagNames)]
  };

  return linkdingRequest("/api/bookmarks/", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function saveCurrentTabWithDefaults() {
  const tab = await currentTab();
  const settings = await getSettings();
  return saveBookmark({
    url: tab.url,
    title: tab.title,
    tags: "",
    notes: "",
    isArchived: settings.markArchived,
    unread: settings.markUnread,
    shared: settings.shared
  });
}

async function searchBookmarks(query) {
  const data = await linkdingRequest(`/api/bookmarks/?q=${encodeURIComponent(query)}&limit=10`);
  return data.results || [];
}

async function openLinkding(path = "") {
  const settings = await getSettings();
  const baseUrl = normalizeBaseUrl(settings.baseUrl);
  return createTab({ url: `${baseUrl}${path}` });
}

extensionApi.runtime.onInstalled.addListener(() => {
  extensionApi.contextMenus.create({
    id: "save-to-linkding",
    title: "Save page to linkding",
    contexts: ["page", "link"]
  });
});

extensionApi.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "save-to-linkding") {
    return;
  }
  const url = info.linkUrl || info.pageUrl || tab?.url;
  const title = info.linkText || tab?.title || "";
  saveBookmark({ url, title, tags: "", notes: "" }).catch(console.error);
});

extensionApi.commands?.onCommand.addListener((command) => {
  if (command === "search-linkding") {
    openLinkding("/bookmarks").catch(console.error);
  }
});

extensionApi.omnibox?.onInputChanged.addListener((text, suggest) => {
  searchBookmarks(text)
    .then((bookmarks) => {
      suggest(bookmarks.map((bookmark) => ({
        content: bookmark.url,
        description: `${bookmark.title || bookmark.url} - ${bookmark.url}`
      })));
    })
    .catch(() => suggest([]));
});

extensionApi.omnibox?.onInputEntered.addListener((text) => {
  if (/^https?:\/\//.test(text)) {
    createTab({ url: text });
    return;
  }
  searchBookmarks(text)
    .then((bookmarks) => {
      if (bookmarks[0]?.url) {
        return createTab({ url: bookmarks[0].url });
      }
      return openLinkding(`/bookmarks?q=${encodeURIComponent(text)}`);
    })
    .catch(console.error);
});

extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case "get-current-tab":
      return sendResponseAsync(currentTab, sendResponse);
    case "get-settings":
      return sendResponseAsync(getSettings, sendResponse);
    case "save-settings":
      return sendResponseAsync(() => storageSet(message.settings).then(getSettings), sendResponse);
    case "test-connection":
      return sendResponseAsync(() => linkdingRequest("/api/user/profile/"), sendResponse);
    case "check-bookmark":
      return sendResponseAsync(() => checkBookmark(message.url), sendResponse);
    case "save-current-tab":
      return sendResponseAsync(saveCurrentTabWithDefaults, sendResponse);
    case "save-bookmark":
      return sendResponseAsync(() => saveBookmark(message.bookmark), sendResponse);
    case "search-bookmarks":
      return sendResponseAsync(() => searchBookmarks(message.query || ""), sendResponse);
    case "open-linkding":
      return sendResponseAsync(() => openLinkding(message.path || ""), sendResponse);
    case "focus-or-open":
      return sendResponseAsync(() => updateTab(message.tabId, { active: true }), sendResponse);
    default:
      return false;
  }
});
