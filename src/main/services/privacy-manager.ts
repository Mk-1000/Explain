const SENSITIVE_PATTERNS = [
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
];

class PrivacyManagerClass {
  private excludedApps: Set<string> = new Set([
    '1Password',
    'LastPass',
    'Bitwarden',
    'KeePass',
  ]);

  containsSensitiveData(text: string): boolean {
    return SENSITIVE_PATTERNS.some((p) => p.test(text));
  }

  getExcludedApps(): string[] {
    return Array.from(this.excludedApps);
  }

  addExcludedApp(appName: string): void {
    this.excludedApps.add(appName);
  }

  removeExcludedApp(appName: string): void {
    this.excludedApps.delete(appName);
  }

  setExcludedApps(apps: string[]): void {
    this.excludedApps = new Set(apps);
  }

  shouldProcessText(_appName: string): boolean {
    return !this.excludedApps.has(_appName);
  }
}

const PrivacyManager = new PrivacyManagerClass();
export default PrivacyManager;
