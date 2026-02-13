$ErrorActionPreference = 'Stop'

function Normalize-Header([string]$text) {
    if (-not $text) { return '' }
    $t = $text.Trim().ToLowerInvariant()
    $t = [regex]::Replace($t, '[\u064b-\u065f]', '')
    $t = $t.Replace('أ','ا').Replace('إ','ا').Replace('آ','ا').Replace('ة','ه').Replace('ى','ي')
    $t = [regex]::Replace($t, '[^a-z0-9\u0621-\u064a\s]', ' ')
    $t = [regex]::Replace($t, '\s+', ' ')
    return $t.Trim()
}

function Score-HeaderCell([string]$cell, [string[]]$synonyms) {
    if (-not $cell) { return 0 }
    $best = 0
    foreach ($syn in $synonyms) {
        $n = Normalize-Header $syn
        if (-not $n) { continue }
        if ($cell -eq $n) { if ($best -lt 12) { $best = 12 }; continue }
        if ($cell.Contains($n) -or $n.Contains($cell)) { if ($best -lt 8) { $best = 8 }; continue }
        $wordsCell = $cell.Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries)
        $wordsSyn = $n.Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries)
        $shared = 0
        foreach ($w in $wordsCell) { if ($wordsSyn -contains $w) { $shared++ } }
        if ($shared -ge 2 -and $best -lt 6) { $best = 6 }
        elseif ($shared -eq 1 -and $best -lt 3) { $best = 3 }
    }
    return $best
}

function Get-NsMgr([xml]$xmlDoc, [string]$prefix, [string]$uri) {
    $mgr = New-Object System.Xml.XmlNamespaceManager -ArgumentList $xmlDoc.NameTable
    $null = $mgr.AddNamespace($prefix, $uri)
    return ,$mgr
}

function Extract-CellValue($cellNode, $sharedStrings, $nsMgr) {
    if ($null -eq $cellNode) { return '' }

    $cellType = ''
    if ($cellNode.Attributes['t']) { $cellType = [string]$cellNode.Attributes['t'].Value }

    if ($cellType -eq 'inlineStr') {
        $tNode = $cellNode.SelectSingleNode('x:is/x:t', $nsMgr)
        if ($tNode) { return [string]$tNode.InnerText }
    }

    $vNode = $cellNode.SelectSingleNode('x:v', $nsMgr)
    if (-not $vNode) { return '' }
    $raw = [string]$vNode.InnerText

    if ($cellType -eq 's') {
        $idx = 0
        if ([int]::TryParse($raw, [ref]$idx)) {
            if ($idx -ge 0 -and $idx -lt $sharedStrings.Count) {
                return [string]$sharedStrings[$idx]
            }
        }
        return ''
    }

    return $raw
}

function Is-NumericLike([string]$value) {
    if (-not $value) { return $false }
    $clean = ($value -replace '[^0-9\\.,-]', '')
    if (-not $clean) { return $false }
    $normalized = $clean.Replace(',', '.')
    $num = 0.0
    return [double]::TryParse($normalized, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$num)
}

$files = @(
    'C:\Users\sale zone store\Downloads\ليفيلز1.xlsx',
    'C:\Users\sale zone store\Downloads\جمله2.xlsx'
)

$nameSyn = @('name','product','product name','اسم','اسم المنتج','الصنف','المنتج')
$priceSyn = @('price','retail','selling','sale price','سعر','السعر','سعر البيع','سعر القطاعي')

$allOk = $true

foreach ($file in $files) {
    Write-Host "---" -ForegroundColor DarkGray
    Write-Host "FILE: $file"

    if (-not (Test-Path -LiteralPath $file)) {
        Write-Host "[FAIL] File not found" -ForegroundColor Red
        $allOk = $false
        continue
    }

    $tempRoot = Join-Path $env:TEMP ("xlsx_test_" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tempRoot | Out-Null

    $fileHasUsableSheet = $false

    try {
        $zipPath = Join-Path $tempRoot 'src.zip'
        Copy-Item -LiteralPath $file -Destination $zipPath
        Expand-Archive -LiteralPath $zipPath -DestinationPath $tempRoot -Force

        $wbPath = Join-Path $tempRoot 'xl\workbook.xml'
        $relsPath = Join-Path $tempRoot 'xl\_rels\workbook.xml.rels'
        if (-not (Test-Path $wbPath) -or -not (Test-Path $relsPath)) {
            throw "Invalid workbook structure"
        }

        [xml]$wb = Get-Content -LiteralPath $wbPath -Raw -Encoding UTF8
        [xml]$rels = Get-Content -LiteralPath $relsPath -Raw -Encoding UTF8

        $wbNs = Get-NsMgr $wb 'x' 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
        $wbNs.AddNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')

        $relsNs = New-Object System.Xml.XmlNamespaceManager($rels.NameTable)
        $relsNs.AddNamespace('p', 'http://schemas.openxmlformats.org/package/2006/relationships')

        $sharedStrings = @()
        $sstPath = Join-Path $tempRoot 'xl\sharedStrings.xml'
        if (Test-Path $sstPath) {
            [xml]$sst = Get-Content -LiteralPath $sstPath -Raw -Encoding UTF8
            $sstNs = Get-NsMgr $sst 'x' 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
            $siNodes = $sst.SelectNodes('//x:sst/x:si', $sstNs)
            foreach ($si in $siNodes) {
                $tNode = $si.SelectSingleNode('x:t', $sstNs)
                if ($tNode) { $sharedStrings += [string]$tNode.InnerText; continue }
                $rNodes = $si.SelectNodes('x:r/x:t', $sstNs)
                if ($rNodes.Count -gt 0) {
                    $parts = @()
                    foreach ($r in $rNodes) { $parts += [string]$r.InnerText }
                    $sharedStrings += ($parts -join '')
                } else {
                    $sharedStrings += ''
                }
            }
        }

        $sheetNodes = $wb.SelectNodes('//x:sheets/x:sheet', $wbNs)
        Write-Host ("Sheets: " + (($sheetNodes | ForEach-Object { $_.Attributes['name'].Value }) -join ', '))

        foreach ($sheet in $sheetNodes) {
            $sheetName = [string]$sheet.Attributes['name'].Value
            $rid = [string]$sheet.Attributes['r:id'].Value
            $rel = $rels.SelectSingleNode("//p:Relationship[@Id='$rid']", $relsNs)
            if (-not $rel) { continue }

            $target = [string]$rel.Attributes['Target'].Value
            if ($target.StartsWith('/')) { $target = $target.TrimStart('/') }
            elseif ($target.StartsWith('worksheets/')) { $target = "xl/$target" }
            else { $target = "xl/$target" }

            $sheetPath = Join-Path $tempRoot $target
            if (-not (Test-Path $sheetPath)) { continue }

            [xml]$sx = Get-Content -LiteralPath $sheetPath -Raw -Encoding UTF8
            $sxNs = Get-NsMgr $sx 'x' 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
            $rowNodes = $sx.SelectNodes('//x:worksheet/x:sheetData/x:row', $sxNs)

            $rows = @()
            foreach ($rowNode in ($rowNodes | Select-Object -First 30)) {
                $vals = @()
                $cellNodes = $rowNode.SelectNodes('x:c', $sxNs)
                foreach ($c in $cellNodes) {
                    $vals += (Extract-CellValue $c $sharedStrings $sxNs)
                }
                $rows += ,$vals
            }

            if ($rows.Count -eq 0) {
                Write-Host "  [WARN] Sheet: $sheetName | no data rows"
                continue
            }

            $bestIdx = 0
            $bestScore = -1.0
            for ($i = 0; $i -lt [Math]::Min($rows.Count, 25); $i++) {
                $cells = @($rows[$i] | ForEach-Object { Normalize-Header ([string]$_) } | Where-Object { $_ })
                if ($cells.Count -eq 0) { continue }
                $score = $cells.Count * 0.4
                foreach ($cell in $cells) {
                    $score += Score-HeaderCell $cell $nameSyn
                    $score += Score-HeaderCell $cell $priceSyn
                }
                if ($score -gt $bestScore) {
                    $bestScore = $score
                    $bestIdx = $i
                }
            }

            $header = @($rows[$bestIdx] | ForEach-Object { [string]$_ })
            $nameFound = $false
            $priceFound = $false
            foreach ($h in $header) {
                $n = Normalize-Header $h
                if (-not $nameFound -and (Score-HeaderCell $n $nameSyn -gt 0)) { $nameFound = $true }
                if (-not $priceFound -and (Score-HeaderCell $n $priceSyn -gt 0)) { $priceFound = $true }
            }

            $maxCols = 0
            foreach ($r in $rows) { if ($r.Count -gt $maxCols) { $maxCols = $r.Count } }
            $numericCandidates = @()
            for ($col = 0; $col -lt $maxCols; $col++) {
                $numericCount = 0
                $sampleCount = 0
                for ($ri = ($bestIdx + 1); $ri -lt [Math]::Min($rows.Count, $bestIdx + 26); $ri++) {
                    $val = ''
                    if ($col -lt $rows[$ri].Count) { $val = [string]$rows[$ri][$col] }
                    if (-not [string]::IsNullOrWhiteSpace($val)) {
                        $sampleCount++
                        if (Is-NumericLike $val) { $numericCount++ }
                    }
                }
                if ($sampleCount -ge 3 -and $numericCount -ge 3) {
                    $numericCandidates += ($col + 1)
                }
            }

            $manualPricePossible = (-not $priceFound) -and ($numericCandidates.Count -gt 0)
            $sheetUsable = $nameFound -and ($priceFound -or $manualPricePossible)
            $status = if ($sheetUsable) { '[PASS]' } else { '[WARN]' }
            if ($sheetUsable) { $fileHasUsableSheet = $true }

            Write-Host "  $status Sheet: $sheetName | Header row: $($bestIdx + 1) | NameColMatch=$nameFound | PriceColMatch=$priceFound"
            Write-Host ("    Header sample: " + (($header | Select-Object -First 10) -join ' | '))
            if ($manualPricePossible) {
                Write-Host ("    Manual price selection supported. Numeric candidate columns: C" + (($numericCandidates | Select-Object -First 8) -join ', C'))
            }
        }

        if (-not $fileHasUsableSheet) {
            Write-Host "  [FAIL] No usable sheet found for import wizard." -ForegroundColor Red
            $allOk = $false
        }

    } catch {
        Write-Host ("[FAIL] " + $_.Exception.Message) -ForegroundColor Red
        $allOk = $false
    } finally {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "---" -ForegroundColor DarkGray
if ($allOk) {
    Write-Host "EXCEL_COMPAT_TEST: PASS" -ForegroundColor Green
    exit 0
} else {
    Write-Host "EXCEL_COMPAT_TEST: WARN/FAIL" -ForegroundColor Yellow
    exit 0
}
