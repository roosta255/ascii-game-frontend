import { savedAccount } from "./AuthContext";

// A storage holding `value` under currentAccount.
function storageWith(value: string | null) {
  return { getItem: (key: string) => (key === 'currentAccount' ? value : null) };
}

describe("savedAccount", () => {
  it("returns the stored account when it exists", () => {
    expect(savedAccount(storageWith('alice'))).toBe('alice');
  });

  it("returns null when storage returns null", () => {
    expect(savedAccount(storageWith(null))).toBeNull();
  });

  it("returns null when storage returns empty string", () => {
    expect(savedAccount(storageWith(''))).toBeNull();
  });
});