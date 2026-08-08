import { createFreighterModuleMock, scenario } from "../src/index.js";

// In a Vitest setup file:
// vi.mock("@stellar/freighter-api", () => freighter);
export const freighter = createFreighterModuleMock(scenario("user-rejection"));

export async function rejectionExample(): Promise<string | undefined> {
  const result = await freighter.requestAccess();
  return result.error?.code;
}
