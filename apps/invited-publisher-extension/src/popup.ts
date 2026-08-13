import { createAppPass } from "@serp-apps-pass/sdk";

const APP_ID = "app_invited_pilot_real";
declare const APP_PASS_AUTHORITY_URL: string;
const AUTHORITY = APP_PASS_AUTHORITY_URL;
const runtimeId = chrome.runtime.id;
const client = createAppPass({ appId: APP_ID, runtimeId, authorityBaseUrl: AUTHORITY });

const runtimeElement = document.querySelector<HTMLElement>("#runtime-id");
const identityElement = document.querySelector<HTMLElement>("#identity-status");
const entitlementElement = document.querySelector<HTMLElement>("#entitlement-status");
const linkButton = document.querySelector<HTMLButtonElement>("#link-access");
const checkButton = document.querySelector<HTMLButtonElement>("#check-access");
const restartButton = document.querySelector<HTMLButtonElement>("#restart-link");
const messageElement = document.querySelector<HTMLElement>("#action-message");

if (!runtimeElement || !identityElement || !entitlementElement || !linkButton || !checkButton || !restartButton || !messageElement) throw new Error("Popup markup is incomplete");
runtimeElement.textContent = runtimeId;

async function refreshLinkState() {
  const state = await client.linkState();
  linkButton.textContent = state.status === "pending" ? "Finish linking after approval" : state.status === "linked" ? "Apps Pass linked" : "Link with Apps Pass";
  linkButton.disabled = state.status === "linked";
  restartButton.hidden = state.status !== "pending";
  return state;
}

void fetch(`${AUTHORITY}/api/app-pass/apps/${APP_ID}/distributions/${runtimeId}`)
  .then((response) => {
    identityElement.textContent = response.ok ? "Approved by Apps Pass" : "Not yet approved";
  })
  .catch(() => {
    identityElement.textContent = "Authority unavailable";
  });

void refreshLinkState();

linkButton.addEventListener("click", async () => {
  linkButton.disabled = true;
  messageElement.textContent = "";
  try {
    const state = await client.linkState();
    if (state.status === "pending") {
      await client.finishLink();
      messageElement.textContent = "Linked. Apps Pass access can now be checked.";
    } else if (state.status === "unlinked") {
      const link = await client.beginLink();
      await chrome.tabs.create({ url: link.activationUrl });
      messageElement.textContent = "Approve the verified App in the new Apps Pass tab, then reopen this popup.";
    }
  } catch (error) {
    messageElement.textContent = error instanceof Error ? error.message : "Linking could not be completed.";
  }
  await refreshLinkState();
});

restartButton.addEventListener("click", async () => {
  await client.resetLink();
  messageElement.textContent = "The previous request was cleared. Start a new activation when ready.";
  await refreshLinkState();
});

checkButton.addEventListener("click", async () => {
  checkButton.disabled = true;
  const entitlement = await client.check();
  entitlementElement.textContent = entitlement.status;
  messageElement.textContent = entitlement.status === "active"
    ? "Premium feature access is active."
    : entitlement.status === "inactive"
      ? "This App is linked, but this Subscriber does not currently have paid-through Apps Pass access."
      : entitlement.status === "unauthenticated"
        ? "Link this extension before checking access."
        : entitlement.status === "revoked"
          ? "This App session or App has been revoked."
          : "Apps Pass is temporarily unavailable; access was not reported as inactive.";
  if (entitlement.status === "revoked" || (entitlement.status === "unauthenticated" && entitlement.reason === "session_expired")) {
    restartButton.hidden = false;
    restartButton.textContent = "Relink Apps Pass";
  }
  checkButton.disabled = false;
});
