<#
  tally-sync-agent.ps1

  WHERE THIS RUNS: on the Tally-on-Cloud Windows server itself (the RDP
  machine your cloud provider gives you), NOT on your own laptop. It talks
  to Tally over 127.0.0.1:9000 -- localhost only -- so it needs no firewall
  change and does not expose Tally to anything outside that server.

  WHAT IT DOES: every few minutes it asks Tally (via its built-in XML/HTTP
  export, the same interface "Tally Desk" uses when Tally is local) for the
  list of companies and the current Trial Balance, and writes the raw
  responses into a folder on that server. Point that folder at a Google
  Drive / OneDrive / Dropbox desktop-sync folder that is ALSO installed on
  that server, and the files will sync down to your own PC automatically.
  Tally Desk (running on your PC, "Cloud folder sync" mode) then just reads
  the local, already-synced copy of that folder -- no inbound port on the
  cloud server is ever opened.

  SETUP (one-time, on the cloud server):
    1. Edit $OutputFolder below to a folder INSIDE your Drive/OneDrive/
       Dropbox sync folder on that server, e.g.
       "$env:USERPROFILE\Google Drive\TallySync"
    2. Edit $CompanyName to your exact Tally company name (or leave blank
       to sync whichever company is first in the list).
    3. Open Tally > F1 (Help) > Settings > Connectivity, and make sure
       "Client/Server configuration" / ODBC port is enabled (default 9000).
    4. Run install-agent.ps1 (as the same Windows user who is logged into
       that RDP session) to register this script as a scheduled task that
       runs every 10 minutes, even after the server reboots.
    5. On your own PC, in Tally Desk > Settings > Sync mode, choose
       "Cloud folder sync" and point it at the LOCAL copy of the same
       Drive/OneDrive/Dropbox folder.
#>

param(
  [string]$OutputFolder = "$env:USERPROFILE\Google Drive\TallySync",
  [string]$CompanyName = "",
  [string]$TallyHost = "127.0.0.1",
  [int]$TallyPort = 9000
)

if (!(Test-Path $OutputFolder)) {
  New-Item -ItemType Directory -Path $OutputFolder -Force | Out-Null
}

function Invoke-TallyXML {
  param([string]$Xml)
  $uri = "http://$($TallyHost):$($TallyPort)"
  try {
    $resp = Invoke-WebRequest -Uri $uri -Method Post -Body $Xml -ContentType "text/xml" -TimeoutSec 20 -UseBasicParsing
    return $resp.Content
  } catch {
    Write-Warning "Tally request failed: $($_.Exception.Message)"
    return $null
  }
}

$listCompaniesXml = @"
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Companies</REPORTNAME>
        <STATICVARIABLES><SVEXPORTFORMAT>`$`$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>
"@

$companiesXml = Invoke-TallyXML -Xml $listCompaniesXml
if (-not $companiesXml) {
  Write-Error "Could not reach Tally on $($TallyHost):$($TallyPort). Is Tally open with a company loaded on this server?"
  exit 1
}
$companiesXml | Out-File -FilePath (Join-Path $OutputFolder "Companies.xml") -Encoding UTF8

if (-not $CompanyName) {
  if ($companiesXml -match '<COMPANY[^>]*NAME="([^"]+)"') { $CompanyName = $Matches[1] }
}

$today = Get-Date
$fyStartYear = if ($today.Month -ge 4) { $today.Year } else { $today.Year - 1 }
$fromDate = "{0}0401" -f $fyStartYear
$toDate = $today.ToString("yyyyMMdd")

$trialBalanceXml = @"
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Trial Balance</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>`$`$SysName:XML</SVEXPORTFORMAT>
          <SVCURRENTCOMPANY>$CompanyName</SVCURRENTCOMPANY>
          <SVFROMDATE>$fromDate</SVFROMDATE>
          <SVTODATE>$toDate</SVTODATE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>
"@

$tbXml = Invoke-TallyXML -Xml $trialBalanceXml
if ($tbXml) {
  $tbXml | Out-File -FilePath (Join-Path $OutputFolder "TrialBalance.xml") -Encoding UTF8
}

$dayBookXml = @"
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Day Book</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>`$`$SysName:XML</SVEXPORTFORMAT>
          <SVCURRENTCOMPANY>$CompanyName</SVCURRENTCOMPANY>
          <SVFROMDATE>$fromDate</SVFROMDATE>
          <SVTODATE>$toDate</SVTODATE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>
"@

$dbXml = Invoke-TallyXML -Xml $dayBookXml
if ($dbXml) {
  $dbXml | Out-File -FilePath (Join-Path $OutputFolder "DayBook.xml") -Encoding UTF8
}

Write-Output "Synced company '$CompanyName' to $OutputFolder at $(Get-Date -Format 'u')"
