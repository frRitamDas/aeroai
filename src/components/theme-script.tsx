/**
 * Applies the persisted theme before first paint so there is no flash of the
 * wrong colour scheme. Kept as an inline script (no client component needed).
 */
export function ThemeScript() {
  const code = `(function(){try{var raw=localStorage.getItem('aerotext-preferences');var mode='system';if(raw){var parsed=JSON.parse(raw);mode=(parsed&&parsed.state&&parsed.state.theme)||'system';}var dark=mode==='dark'||(mode==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);document.documentElement.style.colorScheme=dark?'dark':'light';}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
