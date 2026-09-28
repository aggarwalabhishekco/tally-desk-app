<#
  install-agent.ps1
  Run this ONCE on the Tally-on-Cloud server, in an elevated PowerShell
  prompt, logged in as the same Windows user whose session has Tally open.
  It registers tally-sync-agent.ps1 as a Scheduled Task that runs every
  10 minutes (and 2 minutes after any logon/reboot), so syncing keeps
  going even if nobody is actively watching that RDP session.

  Usage:
    .\install-agent.ps1 -OutputFolder "C:\Users\<you>\Google Drive\TallySync" -CompanyName "Your Company Pvt Ltd"
#>

param(
  [Parameter(Mandatory = $true)][string]$OutputFolder,
  [string]$CompanyName = ""
)

$scriptPath = Join-Path $PSScriptRoot "tally-sync-agent.ps1"
$taskName = "TallyDesk Cloud Sync Agent"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -OutputFolder `"$OutputFolder`" -CompanyName `"$CompanyName`""

$trigger1 = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration ([TimeSpan]::MaxValue)
$trigger2 = New-ScheduledTaskTrigger -AtLogOn
$trigger2.Delay = "PT2M"

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($trigger1, $trigger2) -Settings $settings -Force

Write-Output "Installed scheduled task '$taskName'. It will sync Tally -> $OutputFolder every 10 minutes."
Write-Output "Running it once now to confirm it works..."
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 5
Write-Output "Check $OutputFolder for Companies.xml / TrialBalance.xml / DayBook.xml"
