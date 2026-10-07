param(
    [Parameter(Mandatory=$true)][string]$DocumentPath,
    [Parameter(Mandatory=$true)][string]$PdfPath
)
$ErrorActionPreference = 'Stop'
$wordRenderer = $null
$wordDocument = $null
try {
    $wordRenderer = New-Object -ComObject Word.Application
    $wordRenderer.Visible = $false
    $wordRenderer.DisplayAlerts = 0
    $wordRenderer.AutomationSecurity = 3
    $wordDocument = $wordRenderer.Documents.Open($DocumentPath, $false, $true)
    $wordDocument.Repaginate()
    $pageCount = $wordDocument.ComputeStatistics(2)
    $wordDocument.ExportAsFixedFormat($PdfPath, 17, $false)
    Write-Output ('Rendered pages: ' + $pageCount)
    Write-Output $PdfPath
}
finally {
    if ($null -ne $wordDocument) {
        try { $wordDocument.Close(0) } catch {}
        try { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordDocument) } catch {}
    }
    if ($null -ne $wordRenderer) {
        try { $wordRenderer.Quit(0) } catch {}
        try { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordRenderer) } catch {}
    }
}
