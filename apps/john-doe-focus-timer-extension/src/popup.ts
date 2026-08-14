import { createAppPass, type Entitlement } from "@serp-apps-pass/sdk";

declare const APP_PASS_APP_ID: string;
const APP_ID = APP_PASS_APP_ID;
declare const APP_PASS_AUTHORITY_URL: string;
const AUTHORITY = APP_PASS_AUTHORITY_URL;
const runtimeId = chrome.runtime.id;
const client = createAppPass({ appId: APP_ID, runtimeId, authorityBaseUrl: AUTHORITY });

const required = <T extends HTMLElement>(selector: string) => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Popup markup is missing ${selector}`);
  return element;
};

const timerElement = required<HTMLOutputElement>("#timer");
const runtimeElement = required<HTMLElement>("#runtime-id");
const identityElement = required<HTMLElement>("#identity-status");
const entitlementElement = required<HTMLElement>("#entitlement-status");
const linkButton = required<HTMLButtonElement>("#link-access");
const checkButton = required<HTMLButtonElement>("#check-access");
const restartButton = required<HTMLButtonElement>("#restart-link");
const premiumButton = required<HTMLButtonElement>("#start-premium");
const messageElement = required<HTMLElement>("#action-message");

runtimeElement.textContent = runtimeId;

let timerInterval: number | undefined;

function renderRemaining(endAt: number | null, fallbackSeconds = 300) {
  const seconds = endAt === null ? fallbackSeconds : Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  timerElement.value = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  if (seconds === 0 && timerInterval !== undefined) window.clearInterval(timerInterval);
}

async function startTimer(minutes: number) {
  const endAt = Date.now() + minutes * 60_000;
  await chrome.storage.local.set({ "john-doe-focus-timer:end-at": endAt });
  if (timerInterval !== undefined) window.clearInterval(timerInterval);
  renderRemaining(endAt);
  timerInterval = window.setInterval(() => renderRemaining(endAt), 1_000);
}

async function restoreTimer() {
  const stored = await chrome.storage.local.get("john-doe-focus-timer:end-at");
  const endAt = stored["john-doe-focus-timer:end-at"];
  if (typeof endAt === "number" && endAt > Date.now()) {
    renderRemaining(endAt);
    timerInterval = window.setInterval(() => renderRemaining(endAt), 1_000);
  }
}

function applyEntitlement(entitlement: Entitlement) {
  entitlementElement.textContent = entitlement.status;
  entitlementElement.classList.toggle("active", entitlement.status === "active");
  premiumButton.disabled = entitlement.status !== "active";
  messageElement.textContent = entitlement.status === "active"
    ? "Apps Pass is active. John’s premium 25-minute timer is unlocked."
    : entitlement.status === "inactive"
      ? "This extension is linked, but the Subscriber has no current paid-through access."
      : entitlement.status === "unauthenticated"
        ? "Link this extension to a Subscriber before checking access."
        : entitlement.status === "revoked"
          ? "This App session or App has been revoked."
          : "Apps Pass is temporarily unavailable; this is not reported as inactive access.";
}

async function refreshLinkState() {
  const state = await client.linkState();
  linkButton.textContent = state.status === "pending" ? "Finish linking after approval" : state.status === "linked" ? "Apps Pass linked" : "Link with Apps Pass";
  linkButton.disabled = state.status === "linked";
  restartButton.hidden = state.status !== "pending";
  return state;
}

void client.verifyConnection()
  .then((connection) => {
    identityElement.textContent = connection.status === "connected" ? "Connected to Apps Pass" : "Apps Pass connection suspended";
  })
  .catch((error) => {
    identityElement.textContent = error instanceof Error ? error.message : "Apps Pass connection unavailable";
  });

void restoreTimer();
void refreshLinkState();

required<HTMLButtonElement>("#start-free").addEventListener("click", () => void startTimer(5));
premiumButton.addEventListener("click", () => void startTimer(25));
required<HTMLButtonElement>("#reset-timer").addEventListener("click", async () => {
  await chrome.storage.local.remove("john-doe-focus-timer:end-at");
  if (timerInterval !== undefined) window.clearInterval(timerInterval);
  renderRemaining(null);
});

linkButton.addEventListener("click", async () => {
  linkButton.disabled = true;
  messageElement.textContent = "";
  try {
    const state = await client.linkState();
    if (state.status === "pending") {
      await client.finishLink();
      messageElement.textContent = "Linked. Check Apps Pass access to unlock the premium timer.";
    } else if (state.status === "unlinked") {
      const link = await client.beginLink();
      await chrome.tabs.create({ url: link.activationUrl });
      messageElement.textContent = "Approve John Doe Focus Timer in the new Apps Pass tab, then reopen this popup.";
    }
  } catch (error) {
    messageElement.textContent = error instanceof Error ? error.message : "Linking could not be completed.";
  }
  await refreshLinkState();
});

restartButton.addEventListener("click", async () => {
  await client.resetLink();
  applyEntitlement({ status: "unauthenticated", reason: "not_linked" });
  await refreshLinkState();
});

checkButton.addEventListener("click", async () => {
  checkButton.disabled = true;
  applyEntitlement(await client.check());
  checkButton.disabled = false;
});
