# Exécute une requête SQL sur le projet Supabase via l'API de management (NAT64 + token CLI)
param(
  [Parameter(Mandatory=$true)][string]$SqlFile,
  [switch]$ReadOnly
)

$ErrorActionPreference = "Stop"

# --- Lire le token CLI depuis le Credential Manager (cible "Supabase CLI:supabase") ---
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class CredMan {
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool CredRead(string target, int type, int flags, out IntPtr credPtr);
  [DllImport("advapi32.dll")]
  public static extern void CredFree(IntPtr cred);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags; public int Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public int CredentialBlobSize; public IntPtr CredentialBlob; public int Persist;
    public int AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
  }
}
"@

$ptr = [IntPtr]::Zero
if (-not [CredMan]::CredRead("Supabase CLI:supabase", 1, 0, [ref]$ptr)) {
  throw "Credential 'Supabase CLI:supabase' introuvable"
}
$cred = [System.Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][CredMan+CREDENTIAL])
$bytes = New-Object byte[] $cred.CredentialBlobSize
[System.Runtime.InteropServices.Marshal]::Copy($cred.CredentialBlob, $bytes, 0, $cred.CredentialBlobSize)
[CredMan]::CredFree($ptr)
$token = [System.Text.Encoding]::UTF8.GetString($bytes).Trim()
if ($token -notlike "sbp_*") { throw "Token inattendu (ne commence pas par sbp_)" }

# --- Construire le body JSON { query: <contenu du fichier> } ---
$sql = [System.IO.File]::ReadAllText($SqlFile)

# --- -ReadOnly : garantie exécutée, plus une simple intention ---
#
# 🔴 Ce commutateur était DÉCLARÉ mais jamais lu : toute requête partait telle
# quelle sur la production, y compris passée avec -ReadOnly. Relevé le
# 27/07/2026 par un vérificateur, après que je m'y étais fié moi-même.
# Désormais il enveloppe réellement la requête dans une transaction que
# PostgreSQL refusera d'écrire, et qui est annulée dans tous les cas.
if ($ReadOnly) {
  # Le refus est volontairement LARGE, et il attrape aussi le `begin` d'un
  # corps plpgsql (`as $$ ... begin ... end $$`) — qui n'est pourtant pas une
  # instruction de transaction. C'est assume : distinguer les deux demanderait
  # d'analyser le SQL, et se tromper dans ce sens-la ferait croire a une
  # protection qui n'envelopperait rien. Mieux vaut refuser un script legitime
  # que d'en laisser passer un en pretendant le proteger.
  # (Les commentaires `-- begin ...` ne matchent pas : le mot doit ouvrir la ligne.)
  if ($sql -match '(?im)^\s*(begin|commit|rollback|start\s+transaction)\b') {
    Write-Error "-ReadOnly refuse un script contenant 'begin', 'commit', 'rollback' ou 'start transaction' en debut de ligne : l'enveloppe read only ne pourrait pas garantir son effet. Cela inclut le 'begin' d'un corps plpgsql. Retirez -ReadOnly (et pilotez vous-meme begin/rollback), ou passez une requete simple."
    exit 1
  }
  $sql = "begin;`nset transaction read only;`n$sql`nrollback;"
}

$body = @{ query = $sql } | ConvertTo-Json -Depth 4
$bodyFile = Join-Path $env:TEMP "sb-query-body.json"
[System.IO.File]::WriteAllText($bodyFile, $body, (New-Object System.Text.UTF8Encoding($false)))

# --- Appel API via NAT64 ---
$out = & curl.exe -s -w "`nHTTP:%{http_code}" --max-time 60 --ssl-no-revoke `
  --connect-to "api.supabase.com:443:[64:ff9b::104.20.27.145]:443" `
  -X POST "https://api.supabase.com/v1/projects/bvdzrhvbiglwrhzpmuwy/database/query" `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  --data-binary "@$bodyFile"
Remove-Item $bodyFile -Force
$out
