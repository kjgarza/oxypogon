// Theme management for Oxypogon
// Supports daisyUI themes via data-theme attribute

(function() {
  // Available themes (daisyUI)
  const themes = ['fantasy', 'dark', 'light', 'cupcake', 'forest'];

  // Get saved theme or default
  function getSavedTheme() {
    return localStorage.getItem('oxypogon-theme') || 'fantasy';
  }

  // Apply theme to document
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('oxypogon-theme', theme);
  }

  // Initialize theme on page load
  applyTheme(getSavedTheme());

  // Expose theme functions globally for optional theme switcher
  window.themeManager = {
    themes,
    current: getSavedTheme,
    set: applyTheme,
    toggle: function() {
      const current = getSavedTheme();
      const currentIndex = themes.indexOf(current);
      const nextIndex = (currentIndex + 1) % themes.length;
      applyTheme(themes[nextIndex]);
      return themes[nextIndex];
    }
  };
})();
