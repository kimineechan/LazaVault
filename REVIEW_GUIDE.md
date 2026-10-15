# Review LazaVault 0.2.0

LazaVault is the redesigned desktop password review application. It uses the system font and has no demo vault.

## Launch on Windows

Open `LazaVault-Portable-0.2.0-x64.exe`. Node.js and npm are not required for the portable build.

If the portable wrapper does not launch, extract `LazaVault-Windows-Unpacked-0.2.0-x64.zip`, keep every included file together, and open `LazaVault.exe` inside the extracted folder.

The review builds are unsigned. Windows may show an unknown publisher warning. Do not disable Windows security globally.

## Run the source

Extract the source ZIP into a new folder so your existing checkout remains intact. Open CMD in the inner `lazavault` folder that contains `package.json`.

Node.js 24 or later is required. Run:

```bat
npm ci
npm run dev
```

To verify the code:

```bat
npm run check
```

To create both an installer and portable executable on Windows:

```bat
npm run package:win
```

## Review the interface

The empty workspace provides a real local CSV import. The generator and security documentation can be opened before importing anything. There is no bundled sample vault or demo mode.

After importing a CSV, review the summary, account inventory, filters, account details, replacement staging, checklist, and export dialog. Passwords remain hidden unless explicitly revealed. A staged replacement does not change a website password.

Imported passwords, staged replacements, and checklist progress remain in the current session only. Export anything you need before replacing the import or closing the session. CSV exports contain readable passwords; JSON reports contain account identifiers and findings.

## GitHub

Create a new empty public repository named `lazavault` and follow [GITHUB_RELEASE.md](GITHUB_RELEASE.md). The source ZIP contains the app and repository files without old Git history. The included Windows release workflow builds the installer, portable executable, unpacked ZIP, and checksums on a Windows runner when you publish `v0.2.0`.
