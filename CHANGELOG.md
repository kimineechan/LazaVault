# Changelog

## 0.3.0

A dark interface, in the style of LazaReplay, LazaScrub and LazaBinder. What LazaVault checks and exports is unchanged.

* Black interface with rounded panels, buttons and fields. The button for the next step is the light one.
* The window frame, the menus of lists and the file dialogs of Windows follow the dark look.
* On Windows 11 from its 2022 update, what is behind the window shows through, blurred. On Windows 10 the window is solid, because that blur is not available there to a window that keeps its frame.
* Risk labels and findings recoloured to stay readable on black.
* Electron updated to 44.11.3 and the build tools updated, which clears the high severity findings of the dependency audit.

## 0.2.0

First LazaVault source release.

* System font, light desktop interface, and a lock icon.
* Local Chrome and Firefox CSV import with password strength and reuse analysis.
* Optional Have I Been Pwned checks using five character hash prefixes.
* Searchable account table, password generator, rotation checklist, and progress tracking.
* Explicit password manager CSV and password free JSON exports.
* No demo vault or bundled account data.
* Automated security and interface tests, dependency audits, and Windows release builds.
