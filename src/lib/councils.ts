// Council display names, keyed by COUNCIL_ID (matches the RLS role suffix).
// Used by the printable bill and anywhere a friendly name is needed.
export const COUNCIL_NAMES: Record<string, string> = {
  adweso: "Adweso Zonal Council",
  srodae: "Srodae Zonal Council",
  oldestate: "Old Estate Zonal Council",
  newtown: "New Town Zonal Council",
  ogua: "Oguaa Zonal Council",
  nkukwao: "Nkukwao Zonal Council",
  betom: "Betom Zonal Council",
  anlotown: "Anlo Town Zonal Council",
};

export function councilName(id: string): string {
  return COUNCIL_NAMES[id] ?? "Zonal Council";
}