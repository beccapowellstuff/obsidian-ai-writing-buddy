# AI Draft Bench

AI Draft Bench is an experimental Obsidian plugin for working with selected text in a safer, side-panel based AI workflow.

The basic idea is simple:

Select text in a note, right click, ask the AI what to do with it, then review the result in a separate panel before deciding whether to use it.

This plugin is currently in early development. At the moment it uses fake placeholder AI responses while the Obsidian workflow, UI structure, and selection handling are being built properly.

## Current Status of tasks

See TASKS.MD

## Why This Exists

Most AI workflows in Obsidian either require copying text out to another tool, or they write directly into the note in ways that can feel risky or messy.

AI Draft Bench is intended to be more controlled:

1. The user selects text.
2. The user gives an instruction.
3. The AI response appears separately in a side panel.
4. The user decides what to do with it.

The plugin should not silently overwrite note content.

## Current Workflow

1. Highlight text in an Obsidian note.
2. Right click the selected text.
3. Choose **Ask AI about selection**.
4. Enter an instruction in the modal.
5. Press **Ask**.
6. The AI Draft Bench side panel opens.
7. The selected text and placeholder response are displayed.

## Development Setup

Install dependencies:

    npm install

Start the development watcher:

    npm run dev

This rebuilds the plugin when TypeScript files change.

## Deploying to Obsidian Vault

This project includes a deploy script:

    npm run deploy

The deploy script copies the built plugin files into the configured Obsidian vault plugin folder.

Currently copied files:

    main.js
    manifest.json
    styles.css

After deploying, Obsidian still needs to reload the plugin.

Usually this means:

1. Disable **AI Draft Bench** in Obsidian Community Plugins.
2. Enable **AI Draft Bench** again.

Sometimes closing the side panel and reopening it is also needed during development.

## Current Design Principles

- Keep `main.ts` small.
- Avoid one huge TypeScript file.
- Split responsibilities into services, views, modals, and types.
- Do not directly overwrite note content without explicit user action.
- Capture selection metadata early so later replacement actions can be safer.
- Build the workflow with fake responses before adding real AI integration.
- Prefer small, testable milestones over giant feature jumps.
- Allow for local AI (and future online options)

## Notes

This is an early development plugin. It is not ready for general release yet.

The current priority is getting the Obsidian interaction model right before connecting it to a real AI backend.

## BUILT FROM BELOW PLUGIN

---

# Obsidian Sample Plugin

This is a sample plugin for Obsidian (https://obsidian.md).

This project uses TypeScript to provide type checking and documentation.
The repo depends on the latest plugin API (obsidian.d.ts) in TypeScript Definition format, which contains TSDoc comments describing what it does.

This sample plugin demonstrates some of the basic functionality the plugin API can do.
- Adds a ribbon icon, which shows a Notice when clicked.
- Adds a command "Open modal (simple)" which opens a Modal.
- Adds a plugin setting tab to the settings page.
- Registers a global click event and output 'click' to the console.
- Registers a global interval which logs 'setInterval' to the console.

## First time developing plugins?

Quick starting guide for new plugin devs:

- Check if [someone already developed a plugin for what you want](https://obsidian.md/plugins)! There might be an existing plugin similar enough that you can partner up with.
- Make a copy of this repo as a template with the "Use this template" button (login to GitHub if you don't see it).
- Clone your repo to a local development folder. For convenience, you can place this folder in your `.obsidian/plugins/your-plugin-name` folder.
- Install NodeJS, then run `npm i` in the command line under your repo folder.
- Run `npm run dev` to compile your plugin from `main.ts` to `main.js`.
- Make changes to `main.ts` (or create new `.ts` files). Those changes should be automatically compiled into `main.js`.
- Reload Obsidian to load the new version of your plugin.
- Enable plugin in settings window.
- For updates to the Obsidian API run `npm update` in the command line under your repo folder.

## Releasing new releases

- Update your `manifest.json` with your new version number, such as `1.0.1`, and the minimum Obsidian version required for your latest release.
- Update your `versions.json` file with `"new-plugin-version": "minimum-obsidian-version"` so older versions of Obsidian can download an older version of your plugin that's compatible.
- Create new GitHub release using your new version number as the "Tag version". Use the exact version number, don't include a prefix `v`. See here for an example: https://github.com/obsidianmd/obsidian-sample-plugin/releases
- Upload the files `manifest.json`, `main.js`, `styles.css` as binary attachments. Note: The manifest.json file must be in two places, first the root path of your repository and also in the release.
- Publish the release.

> You can simplify the version bump process by running `npm version patch`, `npm version minor` or `npm version major` after updating `minAppVersion` manually in `manifest.json`.
> The command will bump version in `manifest.json` and `package.json`, and add the entry for the new version to `versions.json`

## Adding your plugin to the community plugin list

- Check the [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).
- Publish an initial version.
- Make sure you have a `README.md` file in the root of your repo.
- Make a pull request at https://github.com/obsidianmd/obsidian-releases to add your plugin.

## How to use

- Clone this repo.
- Make sure your NodeJS is at least v16 (`node --version`).
- `npm i` or `yarn` to install dependencies.
- `npm run dev` to start compilation in watch mode.

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

## Improve code quality with eslint
- [ESLint](https://eslint.org/) is a tool that analyzes your code to quickly find problems. You can run ESLint against your plugin to find common bugs and ways to improve your code. 
- This project already has eslint preconfigured, you can invoke a check by running`npm run lint`
- Together with a custom eslint [plugin](https://github.com/obsidianmd/eslint-plugin) for Obsidan specific code guidelines.
- A GitHub action is preconfigured to automatically lint every commit on all branches.

## Funding URL

You can include funding URLs where people who use your plugin can financially support it.

The simple way is to set the `fundingUrl` field to your link in your `manifest.json` file:

```json
{
    "fundingUrl": "https://buymeacoffee.com"
}
```

If you have multiple URLs, you can also do:

```json
{
    "fundingUrl": {
        "Buy Me a Coffee": "https://buymeacoffee.com",
        "GitHub Sponsor": "https://github.com/sponsors",
        "Patreon": "https://www.patreon.com/"
    }
}
```

## API Documentation

See https://docs.obsidian.md
