$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$VaultPluginPath = "H:\- ! Creations\- !TP Work\- - ! STORIES\Story Ideas\Story Ideas\.obsidian\plugins\obsidian-ai-writing-buddy"

Write-Host "Deploying AI Draft Bench to Obsidian vault..."
Write-Host "Project: $ProjectRoot"
Write-Host "Target:  $VaultPluginPath"

New-Item -ItemType Directory -Force -Path $VaultPluginPath | Out-Null

Copy-Item "$ProjectRoot\main.js" "$VaultPluginPath\main.js" -Force
Copy-Item "$ProjectRoot\manifest.json" "$VaultPluginPath\manifest.json" -Force
Copy-Item "$ProjectRoot\styles.css" "$VaultPluginPath\styles.css" -Force

Write-Host "Deploy complete."