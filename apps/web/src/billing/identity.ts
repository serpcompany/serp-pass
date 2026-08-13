export function billingRecordId(kind: string, mode: string, externalId: string) {
  return `${kind}:${mode}:${externalId}`;
}
