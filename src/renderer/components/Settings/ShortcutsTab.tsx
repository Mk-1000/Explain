interface ShortcutsTabProps {
  shortcut: string;
  onShortcutChange: (shortcut: string) => void;
  onSave: () => Promise<boolean>;
}

export default function ShortcutsTab({
  shortcut,
  onShortcutChange,
  onSave,
}: ShortcutsTabProps) {
  return (
    <div className="settings-section">
      <h3>Keyboard Shortcuts</h3>
      <div className="shortcut-item">
        <label>Trigger enhancement</label>
        <input
          type="text"
          value={shortcut}
          onChange={(e) => onShortcutChange(e.target.value)}
          placeholder="e.g. CommandOrControl+Shift+Space"
        />
        <p className="help-text">
          Use: CommandOrControl, Alt, Shift. Example: CommandOrControl+Shift+Space
        </p>
      </div>
      <button type="button" className="btn-primary" onClick={() => onSave()}>
        Save shortcut
      </button>
    </div>
  );
}
