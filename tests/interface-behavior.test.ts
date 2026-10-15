// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/renderer/App";
import type {
  AccountSummary,
  LazaVaultApi,
  VaultSnapshot,
} from "../src/shared/contracts";

const account: AccountSummary = {
  id: "0123456789abcdef01234567",
  name: "Test account",
  hostname: "account.test",
  website: "https://account.test",
  username: "person@account.test",
  risk: "high",
  strengthScore: 4,
  findings: [
    {
      code: "reused",
      label: "Reused password",
      detail: "Shared by two accounts.",
      severity: "high",
    },
  ],
  reusedCount: 2,
  breachState: "unknown",
  breachCount: null,
  hasReplacement: false,
  checklist: {
    passwordUpdated: false,
    mfaReviewed: false,
    passkeyReviewed: false,
    managerUpdated: false,
  },
  completedSteps: 0,
  secured: false,
  websiteUrl: "https://account.test",
  changePasswordUrl: "https://account.test/.well-known/change-password",
  mfaRecommendation: "Review authentication settings.",
  passkeyRecommendation: "Check support.",
  passkeyKnown: false,
};

const empty: VaultSnapshot = {
  accounts: [],
  source: null,
  stats: {
    accounts: 0,
    critical: 0,
    weak: 0,
    reused: 0,
    exposed: 0,
    secured: 0,
    completionPercent: 0,
  },
};
const imported: VaultSnapshot = {
  accounts: [account],
  source: {
    fileName: "passwords.csv",
    importedAt: "2026-10-14T12:00:00Z",
    rowCount: 1,
    sourceInTrash: false,
  },
  stats: {
    accounts: 1,
    critical: 0,
    weak: 0,
    reused: 1,
    exposed: 0,
    secured: 0,
    completionPercent: 0,
  },
};
const generatedValue = "GeneratedOnlyForTest!1234";
let api: LazaVaultApi;
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  api = {
    getSnapshot: vi.fn().mockResolvedValue(empty),
    importCsv: vi
      .fn()
      .mockResolvedValue({ cancelled: false, snapshot: imported }),
    clearVault: vi.fn().mockResolvedValue(empty),
    trashSource: vi.fn().mockResolvedValue(imported),
    revealPassword: vi
      .fn()
      .mockResolvedValue({
        value: "ImportedOnlyForTest!1234",
        kind: "imported",
      }),
    copyPassword: vi.fn().mockResolvedValue({ clearsInSeconds: 45 }),
    copyGenerated: vi.fn().mockResolvedValue({ clearsInSeconds: 45 }),
    generatePassword: vi
      .fn()
      .mockResolvedValue({ value: generatedValue, strengthScore: 4 }),
    generateForAccount: vi.fn().mockResolvedValue({
      generated: { value: generatedValue, strengthScore: 4 },
      snapshot: {
        ...imported,
        accounts: [
          {
            ...account,
            hasReplacement: true,
            risk: "healthy",
            reusedCount: 1,
            findings: [],
          },
        ],
      },
    }),
    setReplacement: vi.fn().mockResolvedValue(imported),
    discardReplacement: vi.fn().mockResolvedValue(imported),
    updateChecklist: vi.fn().mockResolvedValue(imported),
    checkBreaches: vi.fn().mockResolvedValue(imported),
    checkAccountBreach: vi.fn().mockResolvedValue(imported),
    exportPasswordManagerCsv: vi.fn().mockResolvedValue({ cancelled: true }),
    exportSecurityReport: vi.fn().mockResolvedValue({ cancelled: true }),
    openExternal: vi.fn().mockResolvedValue(undefined),
    onBreachProgress: vi.fn().mockReturnValue(() => {}),
  };
  window.lazaVault = api;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

async function mount(snapshot = empty) {
  vi.mocked(api.getSnapshot).mockResolvedValue(snapshot);
  await act(async () => root.render(createElement(App)));
}

function button(
  label: string,
  scope: ParentNode = container,
): HTMLButtonElement {
  const found = [...scope.querySelectorAll("button")].find(
    (item) =>
      item.getAttribute("aria-label") === label ||
      item.textContent?.trim() === label,
  );
  if (!found) throw new Error("Button not found: " + label);
  return found;
}

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

describe("desktop interface behavior", () => {
  it("opens an empty workspace and allows generation without importing credentials", async () => {
    await mount();
    expect(container.textContent).toContain("Import a password export");
    expect(container.textContent).not.toMatch(/demo/i);
    await click(button("Generator"));
    await click(button("Generate password"));
    expect(api.importCsv).not.toHaveBeenCalled();
    expect(api.generatePassword).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain(generatedValue);
    await click(button("Reveal generated password"));
    expect(container.textContent).toContain(generatedValue);
    await click(button("Hide generated password"));
    expect(container.textContent).not.toContain(generatedValue);
  });

  it("does not request an account password until an explicit reveal action", async () => {
    await mount();
    await click(button("Select CSV file"));
    await click(button("Review Test account"));
    expect(api.revealPassword).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("ImportedOnlyForTest!1234");
    await click(button("Reveal password"));
    expect(api.revealPassword).toHaveBeenCalledWith(account.id);
    expect(container.textContent).toContain("ImportedOnlyForTest!1234");
    await click(button("Hide password"));
    expect(container.textContent).not.toContain("ImportedOnlyForTest!1234");
  });

  it("stages a replacement without opening the website or marking the password changed", async () => {
    await mount(imported);
    await click(button("Review Test account"));
    await click(button("Generate 24 character replacement"));
    expect(api.generateForAccount).toHaveBeenCalledWith(
      account.id,
      expect.objectContaining({ length: 24 }),
    );
    expect(api.openExternal).not.toHaveBeenCalled();
    expect(api.updateChecklist).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain(generatedValue);
    expect(container.textContent).toContain("Staged password");
  });

  it("requires confirmation before clearing a session and preserves it on cancel", async () => {
    await mount(imported);
    await click(button("Close session"));
    expect(api.clearVault).not.toHaveBeenCalled();
    await click(button("Cancel"));
    expect(container.textContent).toContain("passwords.csv");
    expect(api.clearVault).not.toHaveBeenCalled();
    await click(button("Close session"));
    const actions = container.querySelector(".confirm-actions")!;
    await click(button("Close session", actions));
    expect(api.clearVault).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Import a password export");
  });

  it("traps dialog keyboard focus and returns focus after Escape", async () => {
    await mount(imported);
    const trigger = button("Review Test account");
    trigger.focus();
    await click(trigger);
    const dialog = container.querySelector('[role="dialog"]')!;
    const close = button("Close account details");
    expect(dialog.contains(document.activeElement)).toBe(true);
    close.focus();
    await act(async () =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          shiftKey: true,
          bubbles: true,
        }),
      ),
    );
    expect(document.activeElement).toBe(button("Change password"));
    await act(async () =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("requires explicit selection before exporting unchanged imported passwords", async () => {
    await mount(imported);
    await click(button("Export results"));
    const save = button("Save password CSV");
    expect(save.disabled).toBe(true);
    expect(api.exportPasswordManagerCsv).not.toHaveBeenCalled();
    await click(
      container.querySelector(".export-include input") as HTMLInputElement,
    );
    expect(save.disabled).toBe(false);
    await click(save);
    expect(api.exportPasswordManagerCsv).toHaveBeenCalledWith(true);
  });

  it("reports partial breach check failures instead of claiming success", async () => {
    vi.mocked(api.checkBreaches).mockResolvedValue({
      ...imported,
      accounts: [{ ...account, breachState: "error" }],
    });
    await mount(imported);
    await click(button("Check breaches"));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "1 accounts could not be checked",
    );
  });
});
