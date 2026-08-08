import { createFreighterMock } from "./adapter.js";
import { WalletController } from "./controller.js";
import type { FreighterMockApi, WalletControllerOptions } from "./types.js";

export type FreighterModuleMock = FreighterMockApi & {
  default: FreighterMockApi;
  __controller: WalletController;
};

/**
 * Creates plain functions suitable for `vi.mock`, `jest.mock`, or any loader
 * hook. No test runner is imported or required.
 */
export function createFreighterModuleMock(
  optionsOrController: WalletControllerOptions | WalletController = {},
): FreighterModuleMock {
  const controller =
    optionsOrController instanceof WalletController
      ? optionsOrController
      : new WalletController(optionsOrController);
  const api = createFreighterMock(controller);
  return { ...api, default: api, __controller: controller };
}
