/**
 * Remote — tarayıcı açma (best-effort).
 *
 * Cihaz girişi onay sayfasını açmaya çalışır; başarısız olursa sessizce yutar —
 * çağıran taraf URL'yi zaten kullanıcıya yazdırır, bu yüzden açma işlemi kritik
 * yol değildir (headless sunucu/SSH oturumlarında spawn başarısız olabilir).
 *
 * Bun.spawn kullanılır (App.tsx'teki git-branch tespiti ile aynı desen) —
 * eksik binary'de senkron fırlatır, node:child_process'in async "error" event'i
 * gibi dinleyicisiz bırakılırsa süreci çökertme riski yoktur.
 */

function openCommand(url: string): string[] {
  if (process.platform === "darwin") return ["open", url]
  if (process.platform === "win32") return ["cmd", "/c", "start", "", url]
  return ["xdg-open", url]
}

export function openInBrowser(url: string): void {
  const cmd = openCommand(url)
  import("bun").then(({ spawn }) => {
    try {
      spawn(cmd, { stdout: "ignore", stderr: "ignore", stdin: "ignore" })
    } catch {
      // best-effort — caller prints the URL regardless
    }
  }).catch(() => { /* not running under bun — shouldn't happen for this CLI */ })
}
