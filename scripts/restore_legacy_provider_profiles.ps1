param(
  [switch]$Apply
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRef = "dhhhftzdfpqthzvkrqoz"
$SupabaseUrl = "https://$ProjectRef.supabase.co"
$RestBase = "$SupabaseUrl/rest/v1"

function Get-ServiceRoleKey {
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  try {
    $rawKeys = & npx supabase projects api-keys `
      --project-ref $ProjectRef `
      -o json 2>$null
    $cliExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorAction
  }
  if ($cliExitCode -ne 0) {
    throw "No se pudieron consultar las claves vigentes del proyecto."
  }

  $keys = $rawKeys | ConvertFrom-Json
  $serviceRole = $keys |
    Where-Object { $_.name -eq "service_role" } |
    Select-Object -First 1
  if (-not $serviceRole -or -not $serviceRole.api_key) {
    throw "No se encontró la clave service_role vigente."
  }

  return [string]$serviceRole.api_key
}

function Get-RestRows {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [hashtable]$Headers,
    [int]$PageSize = 1000
  )

  $allRows = @()
  for ($offset = 0; ; $offset += $PageSize) {
    $separator = if ($Path.Contains("?")) { "&" } else { "?" }
    $uri = "$RestBase/$Path${separator}limit=$PageSize&offset=$offset"
    $response = Invoke-RestMethod -Method Get -Uri $uri -Headers $Headers
    $page = @($response | ForEach-Object { $_ })
    $allRows += $page
    if ($page.Count -lt $PageSize) {
      break
    }
  }

  return $allRows
}

function Get-AuthUser {
  param(
    [Parameter(Mandatory = $true)]
    [string]$UserId,
    [Parameter(Mandatory = $true)]
    [hashtable]$Headers
  )

  try {
    return Invoke-RestMethod `
      -Method Get `
      -Uri "$SupabaseUrl/auth/v1/admin/users/$UserId" `
      -Headers $Headers
  } catch {
    return $null
  }
}

function Normalize-State {
  param([object]$Value)
  return (([string]$Value).ToLowerInvariant() -replace "[^a-z]", "")
}

function Convert-ToPhoneNumber {
  param([object]$Value)

  $digits = ([string]$Value) -replace "\D", ""
  if (-not $digits) {
    return $null
  }

  $number = 0D
  if ([decimal]::TryParse($digits, [ref]$number)) {
    return $number
  }

  return $null
}

function Convert-ToCategories {
  param([object]$Value)

  if ($null -eq $Value) {
    return @()
  }

  $items = @()
  if ($Value -is [Array]) {
    $items = @($Value)
  } elseif ($Value -is [string]) {
    try {
      $parsed = $Value | ConvertFrom-Json
      $items = if ($parsed -is [Array]) { @($parsed) } else { @($Value) }
    } catch {
      $items = @($Value)
    }
  } else {
    $items = @([string]$Value)
  }

  return @(
    $items |
      ForEach-Object {
        (([string]$_).Trim() -replace "^'+|'+$", "")
      } |
      Where-Object { $_ } |
      Sort-Object -Unique
  )
}

function Get-OptionalProperty {
  param(
    [object]$Object,
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  if ($null -eq $Object) {
    return $null
  }
  $property = $Object.PSObject.Properties[$Name]
  if ($property) {
    return $property.Value
  }
  return $null
}

function Get-ErrorResponse {
  param(
    [Parameter(Mandatory = $true)]
    [System.Management.Automation.ErrorRecord]$ErrorRecord
  )

  $response = $ErrorRecord.Exception.Response
  if (-not $response) {
    return "sin respuesta HTTP"
  }

  try {
    $reader = New-Object System.IO.StreamReader(
      $response.GetResponseStream()
    )
    $rawBody = $reader.ReadToEnd()
    $reader.Dispose()
    $body = $rawBody | ConvertFrom-Json
    return "código=$($body.code); mensaje=$($body.message)"
  } catch {
    return "respuesta HTTP no legible"
  }
}

$serviceRoleKey = Get-ServiceRoleKey
$headers = @{
  apikey = $serviceRoleKey
  Authorization = "Bearer $serviceRoleKey"
}

$users = @(
  Get-RestRows -Path "usuarios?select=id" -Headers $headers
)
$services = @(
  Get-RestRows `
    -Path "servicios?select=id,user_id,usuario_id,categoria,estado" `
    -Headers $headers
)
$campaignProfiles = @(
  Get-RestRows `
    -Path "sy_perfiles?select=id,nombre,telefono,oficios,rol,foto_url,verificado,antiguedad,edad" `
    -Headers $headers
)

$userIds = [Collections.Generic.HashSet[string]]::new(
  [StringComparer]::OrdinalIgnoreCase
)
foreach ($user in $users) {
  [void]$userIds.Add([string]$user.id)
}

$orphanServiceGroups = @{}
foreach ($service in $services) {
  $state = Normalize-State $service.estado
  if ($state -and $state -ne "activo") {
    continue
  }

  $candidateIds = @($service.user_id, $service.usuario_id) |
    Where-Object { $_ }
  $alreadyLinked = @(
    $candidateIds |
      Where-Object { $userIds.Contains([string]$_) }
  ).Count -gt 0
  if ($alreadyLinked) {
    continue
  }

  foreach ($candidateId in $candidateIds) {
    $key = [string]$candidateId
    if (-not $orphanServiceGroups.ContainsKey($key)) {
      $orphanServiceGroups[$key] = @()
    }
    $orphanServiceGroups[$key] += $service
  }
}

$unlinkedCampaignProfiles = @(
  $campaignProfiles |
    Where-Object {
      (Normalize-State $_.rol) -notin @("admin", "administrador") -and
      -not $userIds.Contains([string]$_.id)
    }
)

$profilesToInsert = @()
$sourceKinds = @()

foreach ($ownerId in @($orphanServiceGroups.Keys)) {
  $authUser = Get-AuthUser -UserId $ownerId -Headers $headers
  if (
    -not $authUser -or
    -not $authUser.email -or
    -not $authUser.email_confirmed_at
  ) {
    continue
  }

  $metadata = $authUser.user_metadata
  $displayName = Get-OptionalProperty $metadata "nombre"
  if (-not $displayName) {
    $displayName = Get-OptionalProperty $metadata "full_name"
  }
  if (-not $displayName) {
    $displayName = Get-OptionalProperty $metadata "name"
  }
  if (-not $displayName) {
    $displayName = "Prestador de ServiciosYa"
  }

  $categories = @(
    $orphanServiceGroups[$ownerId] |
      ForEach-Object { Convert-ToCategories $_.categoria } |
      Sort-Object -Unique
  )
  $phoneValue = if ($authUser.phone) {
    $authUser.phone
  } elseif (Get-OptionalProperty $metadata "celular") {
    Get-OptionalProperty $metadata "celular"
  } elseif (Get-OptionalProperty $metadata "telefono") {
    Get-OptionalProperty $metadata "telefono"
  } else {
    Get-OptionalProperty $metadata "phone"
  }

  $profilesToInsert += [pscustomobject][ordered]@{
    id = [string]$authUser.id
    usuario_id = [string]$authUser.id
    email = [string]$authUser.email
    nombre = [string]$displayName
    rol = "worker"
    categoria = $categories
    perfilPublico = $true
    perfil_completo = $false
    dni_verificado = $false
    verificado = $false
    celular = Convert-ToPhoneNumber $phoneValue
    foto_perfil = $null
    antiguedad = $null
    edad = $null
  }
  $sourceKinds += "servicio_historico"
}

foreach ($profile in $unlinkedCampaignProfiles) {
  $authUser = Get-AuthUser -UserId $profile.id -Headers $headers
  if (
    -not $authUser -or
    -not $authUser.email -or
    -not $authUser.email_confirmed_at
  ) {
    continue
  }

  $displayName = if ($profile.nombre) {
    [string]$profile.nombre
  } else {
    "Prestador de ServiciosYa"
  }

  $profilesToInsert += [pscustomobject][ordered]@{
    id = [string]$authUser.id
    usuario_id = [string]$authUser.id
    email = [string]$authUser.email
    nombre = $displayName
    rol = "worker"
    categoria = @(Convert-ToCategories $profile.oficios)
    perfilPublico = $true
    perfil_completo = $false
    dni_verificado = $false
    verificado = [bool]$profile.verificado
    celular = Convert-ToPhoneNumber $profile.telefono
    foto_perfil = if ($profile.foto_url) {
      [string]$profile.foto_url
    } else {
      $null
    }
    antiguedad = $profile.antiguedad
    edad = $profile.edad
  }
  $sourceKinds += "campana"
}

$duplicateIds = @(
  $profilesToInsert |
    Group-Object id |
    Where-Object Count -gt 1
)
$alreadyExisting = @(
  $profilesToInsert |
    Where-Object { $userIds.Contains([string]$_.id) }
)
$withoutCategory = @(
  $profilesToInsert |
    Where-Object { @($_.categoria).Count -eq 0 }
)

if (
  $duplicateIds.Count -gt 0 -or
  $alreadyExisting.Count -gt 0 -or
  $withoutCategory.Count -gt 0
) {
  throw "Preflight inseguro: hay duplicados, perfiles existentes o categorías faltantes."
}

$summary = [pscustomobject]@{
  Mode = if ($Apply) { "apply" } else { "audit" }
  RecoverableProfiles = $profilesToInsert.Count
  FromHistoricalServices = @(
    $sourceKinds | Where-Object { $_ -eq "servicio_historico" }
  ).Count
  FromCampaign = @(
    $sourceKinds | Where-Object { $_ -eq "campana" }
  ).Count
  PublicButIncomplete = @(
    $profilesToInsert |
      Where-Object { $_.perfilPublico -and -not $_.perfil_completo }
  ).Count
  UnrecoverableServiceOwners = [Math]::Max(
    0,
    $orphanServiceGroups.Keys.Count -
      @($sourceKinds | Where-Object { $_ -eq "servicio_historico" }).Count
  )
  UnrecoverableCampaignProviders = [Math]::Max(
    0,
    $unlinkedCampaignProfiles.Count -
      @($sourceKinds | Where-Object { $_ -eq "campana" }).Count
  )
  ExcludedAdminProfiles = @(
    $campaignProfiles |
      Where-Object {
        (Normalize-State $_.rol) -in @("admin", "administrador")
      }
  ).Count
  DocumentationRequired = 0
}
$summary | Format-List

if (-not $Apply) {
  Write-Output "Auditoría completada. Use -Apply para insertar."
  exit 0
}

if ($profilesToInsert.Count -eq 0) {
  Write-Output "No hay perfiles recuperables pendientes."
  exit 0
}

$insertHeaders = $headers.Clone()
$insertHeaders["Prefer"] = "return=representation"
$jsonBody = $profilesToInsert | ConvertTo-Json -Depth 8 -Compress

try {
  $insertedResponse = Invoke-RestMethod `
    -Method Post `
    -Uri "$RestBase/usuarios" `
    -Headers $insertHeaders `
    -ContentType "application/json; charset=utf-8" `
    -Body ([Text.Encoding]::UTF8.GetBytes($jsonBody))
} catch {
  $safeError = Get-ErrorResponse -ErrorRecord $_
  throw "Supabase rechazó la inserción: $safeError"
}

$inserted = @($insertedResponse | ForEach-Object { $_ })
if ($inserted.Count -ne $profilesToInsert.Count) {
  throw "Supabase no devolvió todos los perfiles esperados."
}

$insertedIds = [Collections.Generic.HashSet[string]]::new(
  [StringComparer]::OrdinalIgnoreCase
)
foreach ($insertedProfile in $inserted) {
  [void]$insertedIds.Add([string]$insertedProfile.id)
}
$missingAfterInsert = @(
  $profilesToInsert |
    Where-Object { -not $insertedIds.Contains([string]$_.id) }
)
if ($missingAfterInsert.Count -gt 0) {
  throw "La verificación posterior encontró perfiles faltantes."
}

[pscustomobject]@{
  Inserted = $inserted.Count
  WorkerRole = @(
    $inserted | Where-Object { $_.rol -eq "worker" }
  ).Count
  PublicProfiles = @(
    $inserted | Where-Object { $_.perfilPublico }
  ).Count
  IncompleteProfiles = @(
    $inserted | Where-Object { -not $_.perfil_completo }
  ).Count
} | Format-List
