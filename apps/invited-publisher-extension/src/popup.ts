import { createAppPass } from "@serp-apps-pass/sdk";

const APP_ID = "app_invited_pilot_real";
const AUTHORITY = "https://serp-apps-pass-staging.serpcompany.workers.dev";
const runtimeId = chrome.runtime.id;
const client = createAppPass({ appId: APP_ID, runtimeId, authorityBaseUrl: AUTHORITY });

const runtimeElement = document.querySelector<HTMLElement>("#runtime-id");
const identityElement = document.querySelector<HTMLElement>("#identity-status");
const entitlementElement = document.querySelector<HTMLElement>("#entitlement-status");
const checkButton = document.querySelector<HTMLButtonElement>("#check-access");

if (!runtimeElement || !identityElement || !entitlementElement || !checkButton) throw new Error("Popup markup is incomplete");
runtimeElement.textContent = runtimeId;

void fetch(`${AUTHORITY}/api/app-pass/apps/${APP_ID}/distributions/${runtimeId}`)
  .then((response) => {
    identityElement.textContent = response.ok ? "Approved by Apps Pass" : "Not yet approved";
  })
  .catch(() => {
    identityElement.textContent = "Authority unavailable";
  });

checkButton.addEventListener("click", async () => {
  checkButton.disabled = true;
  const entitlement = await client.check();
  entitlementElement.textContent = entitlement.status;
  checkButton.disabled = false;
});
