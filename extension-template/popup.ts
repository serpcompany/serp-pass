import { createAppPass } from "@serp-apps-pass/sdk";

declare const APP_PASS_CONFIG: {
  appId: string;
  authorityBaseUrl: string;
};

const client = createAppPass({
  appId: APP_PASS_CONFIG.appId,
  runtimeId: chrome.runtime.id,
  authorityBaseUrl: APP_PASS_CONFIG.authorityBaseUrl,
});

const appId = document.querySelector<HTMLElement>("#app-id")!;
const requestId = document.querySelector<HTMLElement>("#request-id")!;
const result = document.querySelector<HTMLElement>("#result")!;
appId.textContent = APP_PASS_CONFIG.appId;

async function action(operation: () => Promise<unknown>) {
  try {
    result.dataset.status = "pending";
    const value = await operation();
    if (result.dataset.status === "pending") result.dataset.status = "success";
    result.textContent = JSON.stringify(value);
    return value;
  } catch (error) {
    result.dataset.status = "error";
    result.textContent = error instanceof Error ? error.message : String(error);
    throw error;
  }
}

document.querySelector("#begin-link")!.addEventListener("click", () => void action(async () => {
  const link = await client.beginLink();
  requestId.dataset.requestId = link.requestId;
  requestId.textContent = link.requestId;
  return link;
}));

document.querySelector("#finish-link")!.addEventListener("click", () => void action(async () => {
  await client.finishLink();
  return { linked: true };
}));

document.querySelector("#check-access")!.addEventListener("click", () => void action(async () => {
  const entitlement = await client.check();
  result.dataset.status = entitlement.status;
  result.textContent = JSON.stringify(entitlement);
  return entitlement;
}));
