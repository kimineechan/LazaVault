import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileJson,
  FileKey,
  FolderOpen,
  Info,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import type {
  AccountSummary,
  ChecklistPatch,
  PasswordOptions,
  RiskLevel,
  VaultSnapshot,
} from "../shared/contracts";

type View = "overview" | "accounts" | "generator" | "threat-model";
type ToastState = { message: string; tone?: "success" | "warning" } | null;
type SetToast = (toast: ToastState) => void;

const EMPTY_SNAPSHOT: VaultSnapshot = {
  accounts: [],
  stats: {
    accounts: 0,
    critical: 0,
    weak: 0,
    reused: 0,
    exposed: 0,
    secured: 0,
    completionPercent: 0,
  },
  source: null,
};

const DEFAULT_OPTIONS: PasswordOptions = {
  length: 24,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  avoidAmbiguous: true,
};

function readableError(error: unknown): string {
  if (!(error instanceof Error))
    return "The action could not be completed. Please try again.";
  return error.message.replace(
    /^Error invoking remote method '[^']+': Error: /,
    "",
  );
}

function App() {
  const [snapshot, setSnapshot] = useState<VaultSnapshot>(EMPTY_SNAPSHOT);
  const [view, setView] = useState<View>("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"clear" | "import" | null>(
    null,
  );
  const [breachProgress, setBreachProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    void window.lazaVault
      .getSnapshot()
      .then(setSnapshot)
      .catch((error: unknown) => {
        setToast({ message: readableError(error), tone: "warning" });
      });
    return window.lazaVault.onBreachProgress((progress) => {
      setSnapshot(progress.snapshot);
      setBreachProgress({
        completed: progress.completed,
        total: progress.total,
      });
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 7_000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const importCsv = async () => {
    setBusy("import");
    try {
      const result = await window.lazaVault.importCsv();
      if (!result.cancelled && result.snapshot) {
        setSnapshot(result.snapshot);
        setSelectedId(null);
        setView("overview");
        setToast({
          message: result.snapshot.stats.accounts + " accounts imported.",
          tone: "success",
        });
      }
    } catch (error) {
      setToast({ message: readableError(error), tone: "warning" });
    } finally {
      setBusy(null);
    }
  };

  const clearVault = async () => {
    setBusy("clear");
    try {
      setSnapshot(await window.lazaVault.clearVault());
      setSelectedId(null);
      setView("overview");
      setToast({
        message:
          "Session closed. Imported data and staged passwords were cleared.",
        tone: "success",
      });
    } catch (error) {
      setToast({ message: readableError(error), tone: "warning" });
    } finally {
      setBusy(null);
    }
  };

  const requestImport = () => {
    if (snapshot.source) setPendingAction("import");
    else void importCsv();
  };

  const checkAll = async () => {
    setBusy("breaches");
    setBreachProgress({ completed: 0, total: 0 });
    try {
      const result = await window.lazaVault.checkBreaches();
      setSnapshot(result);
      const failed = result.accounts.filter(
        (account) => account.breachState === "error",
      ).length;
      setToast(
        failed
          ? {
              message:
                "Breach check finished. " +
                failed +
                " accounts could not be checked.",
              tone: "warning",
            }
          : { message: "Breach check complete.", tone: "success" },
      );
    } catch (error) {
      setToast({ message: readableError(error), tone: "warning" });
    } finally {
      setBusy(null);
      setBreachProgress(null);
    }
  };

  const selected =
    snapshot.accounts.find((account) => account.id === selectedId) ?? null;

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        setView={setView}
        snapshot={snapshot}
        busy={Boolean(busy)}
        onClear={() => setPendingAction("clear")}
      />
      <main className="main-stage">
        <Topbar
          snapshot={snapshot}
          onImport={requestImport}
          busy={Boolean(busy)}
        />
        <div className="page-wrap">
          {(view === "overview" || view === "accounts") && !snapshot.source && (
            <ImportWorkspace
              onImport={requestImport}
              busy={Boolean(busy)}
              onSecurity={() => setView("threat-model")}
            />
          )}
          {view === "overview" && snapshot.source && (
            <Overview
              snapshot={snapshot}
              onSelect={setSelectedId}
              onCheckAll={checkAll}
              checking={busy === "breaches"}
              busy={Boolean(busy)}
              breachProgress={breachProgress}
              onExport={() => setExportOpen(true)}
              onSnapshot={setSnapshot}
              setToast={setToast}
              onAccounts={() => setView("accounts")}
            />
          )}
          {view === "accounts" && snapshot.source && (
            <Accounts
              snapshot={snapshot}
              onSelect={setSelectedId}
              onExport={() => setExportOpen(true)}
              busy={Boolean(busy)}
            />
          )}
          {view === "generator" && <GeneratorPanel setToast={setToast} />}
          {view === "threat-model" && <ThreatModel />}
        </div>
        <footer className="statusbar">
          <span>
            <Shield size={13} /> Local processing
          </span>
          <span>
            {snapshot.source
              ? "Session data is not saved automatically"
              : "No file imported"}
          </span>
          <span>Breach checks run only on request</span>
        </footer>
      </main>
      {selected && (
        <AccountDrawer
          key={selected.id}
          account={selected}
          onClose={() => setSelectedId(null)}
          onSnapshot={setSnapshot}
          setToast={setToast}
          sessionBusy={Boolean(busy)}
        />
      )}
      {exportOpen && (
        <ExportDialog
          accounts={snapshot.accounts}
          onClose={() => setExportOpen(false)}
          setToast={setToast}
        />
      )}
      {pendingAction && (
        <ConfirmDialog
          title={
            pendingAction === "clear"
              ? "Close this session?"
              : "Replace the current import?"
          }
          confirmLabel={
            pendingAction === "clear" ? "Close session" : "Select another CSV"
          }
          onClose={() => setPendingAction(null)}
          onConfirm={() => {
            const action = pendingAction;
            setPendingAction(null);
            if (action === "clear") void clearVault();
            else void importCsv();
          }}
        >
          <p>
            Staged passwords and checklist progress exist only in this session.
            Export anything you need before continuing.
          </p>
          {pendingAction === "import" && (
            <p>
              The current session is retained if you cancel the file picker.
            </p>
          )}
        </ConfirmDialog>
      )}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

function Brand() {
  return (
    <div className="brand">
      <LockKeyhole size={23} strokeWidth={1.8} />
      <span>LazaVault</span>
    </div>
  );
}

function Sidebar({
  view,
  setView,
  snapshot,
  busy,
  onClear,
}: {
  view: View;
  setView: (view: View) => void;
  snapshot: VaultSnapshot;
  busy: boolean;
  onClear: () => void;
}) {
  const links: Array<{ id: View; label: string; icon: ReactNode }> = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard size={18} /> },
    { id: "accounts", label: "Accounts", icon: <ListChecks size={18} /> },
    { id: "generator", label: "Generator", icon: <KeyRound size={18} /> },
    { id: "threat-model", label: "Security model", icon: <Shield size={18} /> },
  ];
  return (
    <aside className="sidebar">
      <Brand />
      <p className="brand-description">Password review utility</p>
      <nav aria-label="Main navigation">
        {links.map((link) => (
          <button
            key={link.id}
            className={view === link.id ? "nav-link active" : "nav-link"}
            aria-current={view === link.id ? "page" : undefined}
            onClick={() => setView(link.id)}
          >
            {link.icon}
            <span>{link.label}</span>
            {link.id === "accounts" && (
              <span className="nav-count">{snapshot.stats.accounts}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <div className="session-note">
        <span
          className={snapshot.source ? "status-dot active" : "status-dot"}
        />
        <div>
          <strong>
            {snapshot.source ? "Session open" : "No active session"}
          </strong>
          <span>In memory only</span>
        </div>
      </div>
      <button
        className="nav-link close-session"
        onClick={onClear}
        disabled={!snapshot.source || busy}
      >
        <LogOut size={17} /> Close session
      </button>
      <p className="version">
        v0.2.0 <span>MIT license</span>
      </p>
    </aside>
  );
}

function Topbar({
  snapshot,
  onImport,
  busy,
}: {
  snapshot: VaultSnapshot;
  onImport: () => void;
  busy: boolean;
}) {
  return (
    <header className="topbar">
      <div className="current-file">
        <FileKey size={17} />
        <div>
          <span>{snapshot.source ? "Current file" : "Password source"}</span>
          <strong title={snapshot.source?.fileName}>
            {snapshot.source?.fileName ?? "No file selected"}
          </strong>
        </div>
      </div>
      <div className="topbar-actions">
        {snapshot.source && (
          <span className="memory-state">
            {snapshot.stats.accounts.toLocaleString()} accounts
          </span>
        )}
        <button
          className="button button-secondary button-small"
          onClick={onImport}
          disabled={busy}
        >
          <FolderOpen size={16} />{" "}
          {snapshot.source ? "Replace import" : "Import CSV"}
        </button>
      </div>
    </header>
  );
}

function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading-row">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}

function ImportWorkspace({
  onImport,
  busy,
  onSecurity,
}: {
  onImport: () => void;
  busy: boolean;
  onSecurity: () => void;
}) {
  return (
    <div className="page-content import-page">
      <PageHeading
        title="Password health"
        description="Review a browser export and work through the accounts that need attention."
      />
      <div className="import-layout">
        <section className="panel import-panel">
          <FileKey size={30} strokeWidth={1.5} className="import-file-icon" />
          <h2>Import a password export</h2>
          <p>
            Select a CSV from Chrome or Firefox. Strength and reuse analysis run
            locally as soon as the file opens.
          </p>
          <button
            className="button button-primary"
            onClick={onImport}
            disabled={busy}
          >
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <FolderOpen size={17} />
            )}{" "}
            Select CSV file
          </button>
          <span className="import-supported">
            Chrome and Firefox CSV · Up to 25 MB
          </span>
        </section>
        <section className="import-guide" aria-labelledby="import-guide-title">
          <h2 id="import-guide-title">What happens next</h2>
          <ol>
            <li>
              <strong>Review findings</strong>
              <p>
                Identify weak and reused passwords. Run an optional HIBP breach
                check.
              </p>
            </li>
            <li>
              <strong>Update each account</strong>
              <p>
                Generate a replacement, open the website, and complete its
                password change flow.
              </p>
            </li>
            <li>
              <strong>Save and verify</strong>
              <p>
                Review MFA and passkeys, then save the updated credentials in
                your password manager.
              </p>
            </li>
          </ol>
          <p className="import-limit">
            LazaVault does not change passwords on websites automatically.
          </p>
        </section>
      </div>
      <div className="notice notice-warning">
        <AlertTriangle size={19} />
        <div>
          <strong>The exported CSV contains readable passwords.</strong>
          <p>
            Keep it on this computer. Delete it after verifying your password
            manager import.
          </p>
        </div>
      </div>
      <section className="security-boundary">
        <div>
          <Shield size={19} />
          <h2>Security boundary</h2>
        </div>
        <p>
          Imported passwords are never uploaded. Breach checks send only the
          first five characters of a locally computed hash. LazaVault cannot
          protect a computer controlled by malware, and cannot guarantee
          forensic memory erasure.
        </p>
        <button className="text-button" onClick={onSecurity}>
          Read the security model <ChevronRight size={15} />
        </button>
      </section>
    </div>
  );
}

function Overview({
  snapshot,
  onSelect,
  onCheckAll,
  checking,
  busy,
  breachProgress,
  onExport,
  onSnapshot,
  setToast,
  onAccounts,
}: {
  snapshot: VaultSnapshot;
  onSelect: (id: string) => void;
  onCheckAll: () => void;
  checking: boolean;
  busy: boolean;
  breachProgress: { completed: number; total: number } | null;
  onExport: () => void;
  onSnapshot: (snapshot: VaultSnapshot) => void;
  setToast: SetToast;
  onAccounts: () => void;
}) {
  const [trashing, setTrashing] = useState(false);
  const priority = [...snapshot.accounts]
    .filter((account) => !account.secured)
    .sort(
      (a, b) =>
        riskRank(a.risk) - riskRank(b.risk) ||
        b.findings.length - a.findings.length,
    )
    .slice(0, 6);
  const unchecked = snapshot.accounts.filter(
    (account) => account.breachState === "unknown",
  ).length;
  const failed = snapshot.accounts.filter(
    (account) => account.breachState === "error",
  ).length;
  const trashSource = async () => {
    setTrashing(true);
    try {
      onSnapshot(await window.lazaVault.trashSource());
      setToast({
        message:
          "Source CSV moved to the Recycle Bin or Trash. It is still recoverable.",
        tone: "success",
      });
    } catch (error) {
      setToast({ message: readableError(error), tone: "warning" });
    } finally {
      setTrashing(false);
    }
  };
  return (
    <div className="page-content">
      <PageHeading
        title="Password health"
        description="Review findings and track the changes you make to each account."
      >
        <button
          className="button button-secondary"
          onClick={onCheckAll}
          disabled={busy}
        >
          {checking ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <ShieldAlert size={16} />
          )}
          {checking ? "Checking passwords" : "Check breaches"}
        </button>
        <button
          className="button button-primary"
          onClick={onExport}
          disabled={busy}
        >
          <Download size={16} /> Export results
        </button>
      </PageHeading>
      <section className="summary-strip" aria-label="Password health summary">
        <SummaryMetric
          label="Critical findings"
          value={snapshot.stats.critical}
          note="Compromised or very weak"
          tone="critical"
        />
        <SummaryMetric
          label="Reused passwords"
          value={snapshot.stats.reused}
          note="Accounts sharing a password"
        />
        <SummaryMetric
          label="Weak passwords"
          value={snapshot.stats.weak}
          note="Accounts needing a replacement"
        />
        <article className="summary-metric">
          <span>Rotation checklist</span>
          <strong>
            {snapshot.stats.completionPercent}
            <small>%</small>
          </strong>
          <progress
            value={snapshot.stats.completionPercent}
            max={100}
            aria-label="Rotation checklist progress"
          />
          <p>
            {snapshot.stats.secured} of {snapshot.stats.accounts} accounts
            marked secured
          </p>
        </article>
      </section>
      <div className="breach-status-line" role="status">
        <Shield size={17} />
        {checking ? (
          <span>
            {breachProgress?.total
              ? breachProgress.completed +
                " of " +
                breachProgress.total +
                " unique passwords checked."
              : "Starting breach check."}
          </span>
        ) : (
          <span>
            {snapshot.stats.exposed} found in breach data
            {unchecked > 0 ? " · " + unchecked + " not checked" : ""}
            {failed > 0 ? " · " + failed + " checks failed" : ""}. Checks use
            the HIBP partial hash API.
          </span>
        )}
      </div>
      <section className="panel priority-panel">
        <div className="panel-heading">
          <div>
            <h2>Priority accounts</h2>
            <p>
              Ordered by current risk. Open an account to review its findings.
            </p>
          </div>
          <button className="text-button" onClick={onAccounts}>
            View all accounts <ChevronRight size={15} />
          </button>
        </div>
        <AccountTable accounts={priority} onSelect={onSelect} compact />
        {priority.length === 0 && (
          <div className="empty-filter">
            <CheckCircle2 size={25} />
            <strong>All checklists completed</strong>
            <span>
              Completed checklists record your actions. They do not
              independently verify website security.
            </span>
          </div>
        )}
      </section>
      <div className="overview-bottom">
        <section className="rotation-reference">
          <h2>Rotation sequence</h2>
          <ol>
            <li>Generate a replacement</li>
            <li>Change it on the website</li>
            <li>Review MFA and passkeys</li>
            <li>Save it in your manager</li>
          </ol>
          <p>
            Generated replacements do not change website passwords. Complete the
            site’s own process before marking an account updated.
          </p>
        </section>
        {snapshot.source && !snapshot.source.sourceInTrash ? (
          <section className="source-notice">
            <AlertTriangle size={19} />
            <div>
              <h2>Original export is still on disk</h2>
              <p>
                Move it to the Recycle Bin or Trash after verifying your
                password manager import.
              </p>
              <button
                className="text-button"
                onClick={trashSource}
                disabled={busy || trashing}
              >
                {trashing ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  <Trash2 size={15} />
                )}{" "}
                Move source to Trash
              </button>
            </div>
          </section>
        ) : (
          <section className="source-notice neutral">
            <Info size={19} />
            <div>
              <h2>Original export moved to Trash</h2>
              <p>
                It can still be recovered until you empty the Recycle Bin or
                Trash. Session data remains in memory until you close
                LazaVault.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  tone?: string;
}) {
  return (
    <article className={"summary-metric " + (tone ?? "")}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
      <p>{note}</p>
    </article>
  );
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const label =
    risk === "healthy"
      ? "No findings"
      : risk.charAt(0).toUpperCase() + risk.slice(1);
  return <span className={"risk-badge risk-" + risk}>{label}</span>;
}

function BreachStatus({ account }: { account: AccountSummary }) {
  const text = {
    unknown: "Not checked",
    checking: "Checking",
    safe: "Not found",
    exposed: "Found in breaches",
    error: "Check failed",
  }[account.breachState];
  return (
    <span className={"breach-state breach-" + account.breachState}>
      {account.breachState === "checking" && (
        <LoaderCircle size={13} className="spin" />
      )}
      {text}
    </span>
  );
}

function AccountTable({
  accounts,
  onSelect,
  compact = false,
}: {
  accounts: AccountSummary[];
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="table-scroll">
      <table className={compact ? "account-table compact" : "account-table"}>
        <thead>
          <tr>
            <th scope="col">Account</th>
            <th scope="col">Findings</th>
            {!compact && <th scope="col">Breach check</th>}
            <th scope="col">Checklist</th>
            <th scope="col">Risk</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr key={account.id}>
              <td>
                <button
                  className="account-link"
                  onClick={() => onSelect(account.id)}
                >
                  <strong>{account.name}</strong>
                  <span>{account.username || "No username"}</span>
                </button>
                <span className="account-host">{account.hostname}</span>
              </td>
              <td>
                <div className="account-findings">
                  {account.reusedCount > 1 && (
                    <span>Reused on {account.reusedCount} accounts</span>
                  )}
                  {account.breachState === "exposed" && (
                    <span className="text-critical">Found in breach data</span>
                  )}
                  {account.strengthScore <= 2 && <span>Weak password</span>}
                  {account.hasReplacement && (
                    <span className="text-accent">Replacement staged</span>
                  )}
                  {account.secured && (
                    <span className="text-success">Marked secured</span>
                  )}
                  {account.reusedCount <= 1 &&
                    account.breachState !== "exposed" &&
                    account.strengthScore > 2 &&
                    !account.hasReplacement &&
                    !account.secured && (
                      <span className="muted">No local findings</span>
                    )}
                </div>
              </td>
              {!compact && (
                <td>
                  <BreachStatus account={account} />
                </td>
              )}
              <td>
                <span className="checklist-count">
                  {account.completedSteps}
                  <span> / 4</span>
                </span>
              </td>
              <td>
                <RiskBadge risk={account.risk} />
              </td>
              <td>
                <button
                  className="review-button"
                  onClick={() => onSelect(account.id)}
                  aria-label={"Review " + account.name}
                >
                  <span>Review</span>
                  <ChevronRight size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Accounts({
  snapshot,
  onSelect,
  onExport,
  busy,
}: {
  snapshot: VaultSnapshot;
  onSelect: (id: string) => void;
  onExport: () => void;
  busy: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("risk");
  const filtered = useMemo(
    () =>
      snapshot.accounts
        .filter((account) => {
          const matchesQuery = (
            account.name +
            " " +
            account.username +
            " " +
            account.hostname
          )
            .toLowerCase()
            .includes(query.toLowerCase());
          const matchesFilter =
            filter === "all" ||
            (filter === "critical" && account.risk === "critical") ||
            (filter === "weak" && account.strengthScore <= 2) ||
            (filter === "reused" && account.reusedCount > 1) ||
            (filter === "exposed" && account.breachState === "exposed") ||
            (filter === "unchecked" && account.breachState === "unknown") ||
            (filter === "secured" && account.secured);
          return matchesQuery && matchesFilter;
        })
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : riskRank(a.risk) - riskRank(b.risk) ||
              a.name.localeCompare(b.name),
        ),
    [snapshot.accounts, query, filter, sort],
  );
  return (
    <div className="page-content">
      <PageHeading
        title="Accounts"
        description="Search imported accounts and review their password and authentication settings."
      >
        <button
          className="button button-secondary"
          onClick={onExport}
          disabled={busy}
        >
          <Download size={16} /> Export results
        </button>
      </PageHeading>
      <section className="panel accounts-panel">
        <div className="accounts-toolbar">
          <label className="search-box">
            <Search size={17} />
            <input
              aria-label="Search accounts"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search site or username"
            />
          </label>
          <label className="select-field">
            <span>Show</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label="Filter accounts"
            >
              <option value="all">All accounts</option>
              <option value="critical">Critical</option>
              <option value="weak">Weak passwords</option>
              <option value="reused">Reused passwords</option>
              <option value="exposed">Found in breaches</option>
              <option value="unchecked">Not checked</option>
              <option value="secured">Marked secured</option>
            </select>
          </label>
          <label className="select-field">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="Sort accounts"
            >
              <option value="risk">Risk first</option>
              <option value="name">Account name</option>
            </select>
          </label>
        </div>
        <AccountTable accounts={filtered} onSelect={onSelect} />
        {filtered.length === 0 && (
          <div className="empty-filter">
            <Search size={25} />
            <strong>No matching accounts</strong>
            <span>Try another search or filter.</span>
            <button
              className="text-button"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
        <div className="table-footer">
          <span>
            {filtered.length.toLocaleString()} of{" "}
            {snapshot.stats.accounts.toLocaleString()} accounts
          </span>
          <span>
            <EyeOff size={14} /> Passwords hidden by default
          </span>
        </div>
      </section>
    </div>
  );
}

function GeneratorPanel({ setToast }: { setToast: SetToast }) {
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [generated, setGenerated] = useState<{
    value: string;
    strengthScore: number;
  } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!revealed) return;
    const timeout = setTimeout(() => setRevealed(false), 10_000);
    return () => clearTimeout(timeout);
  }, [revealed]);
  const generate = async () => {
    setBusy(true);
    try {
      setGenerated(await window.lazaVault.generatePassword(options));
      setRevealed(false);
    } catch (error) {
      setToast({ message: readableError(error), tone: "warning" });
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!generated) return;
    try {
      const result = await window.lazaVault.copyGenerated(generated.value);
      setToast({
        message:
          "Copied. Clipboard clears in " +
          result.clearsInSeconds +
          " seconds if unchanged.",
        tone: "success",
      });
    } catch (error) {
      setToast({ message: readableError(error), tone: "warning" });
    }
  };
  const hasCharacterSet =
    options.lowercase ||
    options.uppercase ||
    options.numbers ||
    options.symbols;
  return (
    <div className="page-content">
      <PageHeading
        title="Password generator"
        description="Generate a password using the operating system cryptographic random source."
      />
      <div className="generator-layout">
        <section className="panel generator-output-panel">
          <h2>Generated password</h2>
          <p className="panel-description">
            Kept for this view only. Copy it to your password manager before
            leaving.
          </p>
          <div className="generated-output">
            <code>
              {generated
                ? revealed
                  ? generated.value
                  : "•".repeat(Math.min(generated.value.length, 24))
                : "No password generated"}
            </code>
            {generated && (
              <button
                className="icon-button"
                onClick={() => setRevealed(!revealed)}
                aria-label={
                  revealed
                    ? "Hide generated password"
                    : "Reveal generated password"
                }
              >
                {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            )}
          </div>
          <div className="generator-meta">
            <span>
              {generated
                ? generated.value.length + " characters"
                : "Hidden by default"}
            </span>
            {generated && (
              <span>
                Estimated strength:{" "}
                {generated.strengthScore >= 3
                  ? "Strong"
                  : generated.strengthScore === 2
                    ? "Moderate"
                    : "Weak"}
              </span>
            )}
          </div>
          <div className="generator-actions">
            <button
              className="button button-primary"
              onClick={generate}
              disabled={busy || !hasCharacterSet}
            >
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <KeyRound size={17} />
              )}
              {generated ? "Generate another" : "Generate password"}
            </button>
            <button
              className="button button-secondary"
              onClick={copy}
              disabled={!generated}
            >
              <Copy size={17} /> Copy password
            </button>
          </div>
          {!hasCharacterSet && (
            <p className="inline-error">Select at least one character type.</p>
          )}
          <div className="clipboard-note">
            <Clipboard size={17} />
            <p>
              The clipboard clears after 45 seconds if its contents are
              unchanged. Other applications may read or retain copied passwords.
            </p>
          </div>
        </section>
        <GeneratorControls options={options} setOptions={setOptions} />
      </div>
    </div>
  );
}

function GeneratorControls({
  options,
  setOptions,
}: {
  options: PasswordOptions;
  setOptions: (options: PasswordOptions) => void;
}) {
  const toggles: Array<{
    key: keyof PasswordOptions;
    label: string;
    sample: string;
  }> = [
    { key: "lowercase", label: "Lowercase letters", sample: "a to z" },
    { key: "uppercase", label: "Uppercase letters", sample: "A to Z" },
    { key: "numbers", label: "Numbers", sample: "0 to 9" },
    { key: "symbols", label: "Symbols", sample: "! @ # $" },
    {
      key: "avoidAmbiguous",
      label: "Exclude similar characters",
      sample: "I l O 0",
    },
  ];
  return (
    <section className="panel generator-controls">
      <h2>Password options</h2>
      <div className="length-control">
        <div>
          <label htmlFor="password-length">Length</label>
          <output htmlFor="password-length">{options.length} characters</output>
        </div>
        <input
          id="password-length"
          type="range"
          min="12"
          max="64"
          value={options.length}
          onChange={(event) =>
            setOptions({ ...options, length: Number(event.target.value) })
          }
        />
        <div className="range-labels">
          <span>12</span>
          <span>64</span>
        </div>
      </div>
      <div className="toggle-list">
        {toggles.map((toggle) => (
          <label key={toggle.key}>
            <input
              type="checkbox"
              checked={Boolean(options[toggle.key])}
              onChange={(event) =>
                setOptions({ ...options, [toggle.key]: event.target.checked })
              }
            />
            <span>
              {toggle.label}
              <small>{toggle.sample}</small>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

function ThreatModel() {
  return (
    <div className="page-content security-page">
      <PageHeading
        title="Security model"
        description="The protection boundary and limitations of this application."
      />
      <section className="security-summary">
        <ShieldCheck size={24} />
        <div>
          <h2>Imported passwords are not transmitted</h2>
          <p>
            Parsing, strength analysis, reuse detection, generation, and exports
            run in the local desktop process. There is no account system, cloud
            storage, telemetry, or credential logging.
          </p>
        </div>
      </section>
      <div className="security-columns">
        <section className="security-section">
          <h2>Within scope</h2>
          <ul>
            <li>
              Preventing accidental upload of browser exports through this app.
            </li>
            <li>
              Keeping complete passwords and complete hashes out of breach check
              requests.
            </li>
            <li>Keeping credentials out of application analytics and logs.</li>
            <li>
              Restricting the sandboxed interface from direct access to the
              source file.
            </li>
            <li>
              Blocking popups, embedded websites, and remote navigation in the
              application window.
            </li>
          </ul>
        </section>
        <section className="security-section">
          <h2>Outside scope</h2>
          <ul>
            <li>
              Malware, keyloggers, screen capture, or a compromised operating
              system.
            </li>
            <li>Other users or programs that can read the original export.</li>
            <li>
              Clipboard monitoring, history, or operating system clipboard sync.
            </li>
            <li>Malicious websites opened in your normal browser.</li>
            <li>Guaranteed forensic memory erasure in a JavaScript runtime.</li>
          </ul>
        </section>
      </div>
      <section className="security-section breach-explanation">
        <h2>Optional HIBP breach checks</h2>
        <p>
          LazaVault computes a SHA1 hash locally. Only the first five
          hexadecimal characters are sent to the fixed Pwned Passwords range
          endpoint over TLS. Padded results are returned and suffixes are
          compared in memory. The complete password and complete hash are never
          sent.
        </p>
        <p>
          HIBP can observe your IP address and the hash prefix. A password not
          found in breach data is not a guarantee that an account is secure. A
          found password does not prove that this specific account was breached.
        </p>
      </section>
      <section className="security-section">
        <h2>Session and export handling</h2>
        <p>
          Checklist progress and staged replacements are not saved
          automatically. Close the session or exit LazaVault to clear the
          active data. Explicit CSV exports contain readable passwords; import
          them into your manager, verify the result, then delete the files. JSON
          reports omit passwords but still contain account identifiers and
          security findings.
        </p>
        <p>
          LazaVault assists with rotation. It cannot bypass site
          authentication, MFA, CAPTCHAs, or recovery requirements, and never
          changes a website password automatically.
        </p>
      </section>
    </div>
  );
}

function AccountDrawer({
  account,
  onClose,
  onSnapshot,
  setToast,
  sessionBusy,
}: {
  account: AccountSummary;
  onClose: () => void;
  onSnapshot: (snapshot: VaultSnapshot) => void;
  setToast: SetToast;
  sessionBusy: boolean;
}) {
  const titleId = useId();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const [showGenerated, setShowGenerated] = useState(false);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const disabled = Boolean(busy) || sessionBusy;

  useEffect(() => {
    if (!revealed) return;
    const timeout = setTimeout(() => setRevealed(null), 10_000);
    return () => clearTimeout(timeout);
  }, [revealed]);
  useEffect(() => {
    if (!showGenerated) return;
    const timeout = setTimeout(() => setShowGenerated(false), 10_000);
    return () => clearTimeout(timeout);
  }, [showGenerated]);

  const run = async (action: string, work: () => Promise<void>) => {
    setBusy(action);
    try {
      await work();
    } catch (error) {
      setToast({ message: readableError(error), tone: "warning" });
    } finally {
      setBusy(null);
    }
  };
  const reveal = () => {
    if (revealed) {
      setRevealed(null);
      return;
    }
    void run("reveal", async () =>
      setRevealed((await window.lazaVault.revealPassword(account.id)).value),
    );
  };
  const copy = () =>
    void run("copy", async () => {
      const result = await window.lazaVault.copyPassword(account.id);
      setToast({
        message:
          "Copied. Clipboard clears in " +
          result.clearsInSeconds +
          " seconds if unchanged.",
        tone: "success",
      });
    });
  const generate = () =>
    void run("generate", async () => {
      const result = await window.lazaVault.generateForAccount(
        account.id,
        DEFAULT_OPTIONS,
      );
      setGenerated(result.generated.value);
      setShowGenerated(false);
      setRevealed(null);
      onSnapshot(result.snapshot);
      setToast({
        message:
          "Replacement staged. Change the password on the website before marking it updated.",
        tone: "success",
      });
    });
  const saveManual = () =>
    void run("manual", async () => {
      onSnapshot(await window.lazaVault.setReplacement(account.id, manual));
      setManual("");
      setGenerated(null);
      setRevealed(null);
      setToast({
        message: "Replacement staged in this session.",
        tone: "success",
      });
    });
  const checkBreach = () =>
    void run("breach", async () => {
      const result = await window.lazaVault.checkAccountBreach(account.id);
      onSnapshot(result);
      if (
        result.accounts.find((item) => item.id === account.id)?.breachState ===
        "error"
      )
        setToast({
          message: "Breach check failed. Check your connection and try again.",
          tone: "warning",
        });
    });
  const update = (patch: ChecklistPatch) =>
    void run("checklist", async () =>
      onSnapshot(await window.lazaVault.updateChecklist(account.id, patch)),
    );
  const open = (url: string | null) => {
    if (url) void run("open", async () => window.lazaVault.openExternal(url));
  };
  const discard = () =>
    void run("discard", async () => {
      onSnapshot(await window.lazaVault.discardReplacement(account.id));
      setGenerated(null);
      setShowGenerated(false);
      setRevealed(null);
    });

  return (
    <Dialog variant="drawer" labelledBy={titleId} onClose={onClose}>
      <div className="drawer-header">
        <div>
          <span className="drawer-host">{account.hostname}</span>
          <h2 id={titleId}>{account.name}</h2>
          <p>{account.username || "No username"}</p>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close account details"
        >
          <X size={19} />
        </button>
      </div>
      <div className="drawer-scroll">
        <div className="drawer-risk">
          <RiskBadge risk={account.risk} />
          <span>{account.completedSteps} of 4 checklist items completed</span>
        </div>
        <section className="drawer-section">
          <h3>
            {account.hasReplacement ? "Staged password" : "Current password"}
          </h3>
          <div className="secret-field">
            <code>{revealed ?? "••••••••••••••••••"}</code>
            <button
              className="icon-button"
              onClick={reveal}
              disabled={disabled}
              aria-label={revealed ? "Hide password" : "Reveal password"}
            >
              {revealed ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
            <button
              className="icon-button"
              onClick={copy}
              disabled={disabled}
              aria-label="Copy password"
            >
              <Copy size={17} />
            </button>
          </div>
          <p className="section-help">
            Revealed passwords hide after 10 seconds. Copied passwords clear
            after 45 seconds if the clipboard is unchanged.
          </p>
        </section>
        <section className="drawer-section">
          <div className="section-title">
            <h3>Findings</h3>
            <button
              className="text-button"
              onClick={checkBreach}
              disabled={disabled}
            >
              {busy === "breach" ? (
                <LoaderCircle className="spin" size={14} />
              ) : (
                <ShieldAlert size={14} />
              )}{" "}
              Check breaches
            </button>
          </div>
          <div className="drawer-breach-state">
            <span>Breach check</span>
            <BreachStatus account={account} />
          </div>
          {account.findings.length ? (
            <div className="finding-list">
              {account.findings.map((finding, index) => (
                <div
                  className={"finding finding-" + finding.severity}
                  key={finding.code + "-" + index}
                >
                  <AlertTriangle size={16} />
                  <div>
                    <strong>{finding.label}</strong>
                    <p>{finding.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="section-help">
              No local weakness detected. Breach checks and website security
              settings must be reviewed separately.
            </p>
          )}
        </section>
        <section className="drawer-section">
          <h3>Replacement password</h3>
          <p className="section-help">
            Stage a replacement here, then change it on the website. Staging
            does not update the website.
          </p>
          <button
            className="button button-secondary full-button"
            onClick={generate}
            disabled={disabled}
          >
            {busy === "generate" ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <KeyRound size={16} />
            )}{" "}
            Generate 24 character replacement
          </button>
          {generated && (
            <div className="secret-field generated-mini">
              <code>{showGenerated ? generated : "•".repeat(24)}</code>
              <button
                className="icon-button"
                onClick={() => setShowGenerated(!showGenerated)}
                aria-label={
                  showGenerated ? "Hide replacement" : "Reveal replacement"
                }
              >
                {showGenerated ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
              <button
                className="icon-button"
                disabled={disabled}
                onClick={() =>
                  void run("copy", async () => {
                    await window.lazaVault.copyGenerated(generated);
                    setToast({
                      message:
                        "Copied. Clipboard clears after 45 seconds if unchanged.",
                      tone: "success",
                    });
                  })
                }
                aria-label="Copy replacement"
              >
                <Copy size={17} />
              </button>
            </div>
          )}
          <label className="manual-label" htmlFor="manual-replacement">
            Or enter a replacement
          </label>
          <div className="manual-secret">
            <input
              id="manual-replacement"
              type="password"
              aria-label="Replacement password"
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              placeholder="At least 12 characters"
              maxLength={128}
              autoComplete="new-password"
            />
            <button
              className="button button-secondary"
              onClick={saveManual}
              disabled={manual.length < 12 || disabled}
            >
              Stage
            </button>
          </div>
          {account.hasReplacement && (
            <button
              className="text-button discard-link"
              onClick={discard}
              disabled={disabled}
            >
              Discard staged replacement
            </button>
          )}
        </section>
        <section className="drawer-section">
          <div className="section-title">
            <h3>Rotation checklist</h3>
            <span>{account.completedSteps} / 4</span>
          </div>
          <div className="checklist">
            <ChecklistItem
              checked={account.checklist.passwordUpdated}
              disabled={disabled}
              onChange={(value) => update({ passwordUpdated: value })}
              title="Password changed on website"
              detail="Complete the website authentication and password change flow."
            />
            <ChecklistItem
              checked={account.checklist.mfaReviewed}
              disabled={disabled}
              onChange={(value) => update({ mfaReviewed: value })}
              title="MFA reviewed"
              detail={account.mfaRecommendation}
            />
            <ChecklistItem
              checked={account.checklist.passkeyReviewed}
              disabled={disabled}
              onChange={(value) => update({ passkeyReviewed: value })}
              title={
                account.passkeyKnown
                  ? "Passkey added or reviewed"
                  : "Passkey support checked"
              }
              detail={account.passkeyRecommendation}
            />
            <ChecklistItem
              checked={account.checklist.managerUpdated}
              disabled={disabled}
              onChange={(value) => update({ managerUpdated: value })}
              title="Password manager updated"
              detail="Verify the new credential works before deleting exports."
            />
          </div>
        </section>
      </div>
      <div className="drawer-footer">
        <button
          className="button button-secondary"
          onClick={() => open(account.websiteUrl)}
          disabled={!account.websiteUrl || disabled}
        >
          <ExternalLink size={16} /> Website
        </button>
        <button
          className="button button-primary"
          onClick={() => open(account.changePasswordUrl)}
          disabled={!account.changePasswordUrl || disabled}
        >
          <KeyRound size={16} /> Change password
        </button>
      </div>
    </Dialog>
  );
}

function ChecklistItem({
  checked,
  disabled,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
  title: string;
  detail: string;
}) {
  return (
    <label className={checked ? "check-item checked" : "check-item"}>
      <input
        type="checkbox"
        disabled={disabled}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
    </label>
  );
}

function ExportDialog({
  accounts,
  onClose,
  setToast,
}: {
  accounts: AccountSummary[];
  onClose: () => void;
  setToast: SetToast;
}) {
  const titleId = useId();
  const [includeUnchanged, setIncludeUnchanged] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const stagedCount = accounts.filter(
    (account) => account.hasReplacement,
  ).length;
  const exportPasswords = async () => {
    setBusy("passwords");
    try {
      const result =
        await window.lazaVault.exportPasswordManagerCsv(includeUnchanged);
      if (!result.cancelled) {
        setToast({
          message:
            result.fileName + " saved. Import it, verify it, then delete it.",
          tone: "warning",
        });
        onClose();
      }
    } catch (error) {
      setToast({ message: readableError(error), tone: "warning" });
    } finally {
      setBusy(null);
    }
  };
  const exportReport = async () => {
    setBusy("report");
    try {
      const result = await window.lazaVault.exportSecurityReport();
      if (!result.cancelled) {
        setToast({
          message: result.fileName + " saved without passwords.",
          tone: "success",
        });
        onClose();
      }
    } catch (error) {
      setToast({ message: readableError(error), tone: "warning" });
    } finally {
      setBusy(null);
    }
  };
  return (
    <Dialog labelledBy={titleId} onClose={onClose} dismissible={!busy}>
      <div className="modal-heading">
        <h2 id={titleId}>Export results</h2>
        <button
          className="icon-button"
          onClick={onClose}
          disabled={Boolean(busy)}
          aria-label="Close export"
        >
          <X size={19} />
        </button>
      </div>
      <p className="modal-description">
        Exports are saved only after you choose a file location.
      </p>
      <section className="export-choice">
        <div className="export-choice-heading">
          <FileKey size={20} />
          <div>
            <h3>Password manager CSV</h3>
            <p>{stagedCount} staged replacements available</p>
          </div>
        </div>
        <label className="export-include">
          <input
            type="checkbox"
            checked={includeUnchanged}
            disabled={Boolean(busy)}
            onChange={(event) => setIncludeUnchanged(event.target.checked)}
          />{" "}
          Include unchanged imported passwords
        </label>
        <div className="notice notice-warning export-warning">
          <AlertTriangle size={17} />
          <p>
            This file contains readable passwords. Import it into your manager,
            verify the result, then delete it.
          </p>
        </div>
        <button
          className="button button-primary"
          onClick={exportPasswords}
          disabled={Boolean(busy) || (!includeUnchanged && stagedCount === 0)}
        >
          {busy === "passwords" ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Download size={16} />
          )}{" "}
          Save password CSV
        </button>
        {!includeUnchanged && stagedCount === 0 && (
          <p className="section-help">
            Stage a replacement or include unchanged passwords to export a CSV.
          </p>
        )}
      </section>
      <section className="export-choice">
        <div className="export-choice-heading">
          <FileJson size={20} />
          <div>
            <h3>Security report</h3>
            <p>Findings and checklist progress in JSON</p>
          </div>
        </div>
        <p className="section-help">
          No passwords. Contains account identifiers and security findings;
          handle it as private information.
        </p>
        <button
          className="button button-secondary"
          onClick={exportReport}
          disabled={Boolean(busy)}
        >
          {busy === "report" ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <FileJson size={16} />
          )}{" "}
          Save JSON report
        </button>
      </section>
    </Dialog>
  );
}

function ConfirmDialog({
  title,
  confirmLabel,
  onClose,
  onConfirm,
  children,
}: {
  title: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <Dialog labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId}>{title}</h2>
      <div className="confirm-description">{children}</div>
      <div className="confirm-actions">
        <button className="button button-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="button button-primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

function Dialog({
  variant = "modal",
  labelledBy,
  onClose,
  children,
  dismissible = true,
}: {
  variant?: "modal" | "drawer";
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  useEffect(() => {
    closeRef.current = onClose;
    dismissibleRef.current = dismissible;
  });
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const container = ref.current;
    const focusable = () => [
      ...(container?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
      ) ?? []),
    ];
    (focusable()[0] ?? container)?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissibleRef.current) {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) {
        event.preventDefault();
        container?.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!container?.contains(document.activeElement)) {
        event.preventDefault();
        first?.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === container)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div
      className={"dialog-backdrop dialog-" + variant}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) onClose();
      }}
    >
      <div
        ref={ref}
        className={variant === "drawer" ? "account-drawer" : "modal"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}

function Toast({
  toast,
  onClose,
}: {
  toast: NonNullable<ToastState>;
  onClose: () => void;
}) {
  return (
    <div
      className={"toast " + (toast.tone === "warning" ? "toast-warning" : "")}
      role={toast.tone === "warning" ? "alert" : "status"}
    >
      {toast.tone === "warning" ? (
        <AlertTriangle size={17} />
      ) : (
        <CheckCircle2 size={17} />
      )}
      <span>{toast.message}</span>
      <button onClick={onClose} aria-label="Dismiss notification">
        <X size={16} />
      </button>
    </div>
  );
}

function riskRank(risk: RiskLevel): number {
  return { critical: 0, high: 1, medium: 2, healthy: 3 }[risk];
}

export default App;
