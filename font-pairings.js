// Font pairing configurations based on fontpair.co recommendations
const fontPairings = {
  'reddit-sans-sora': {
    name: 'Reddit Sans + Sora',
    heading: 'Reddit Sans',
    body: 'Sora',
    headingWeight: '700',
    bodyWeight: '400',
    googleFonts: 'Reddit+Sans:ital,wght@0,200..900;1,200..900&family=Sora:wght@100..800'
  },
  'arvo-geist': {
    name: 'Arvo + Geist',
    heading: 'Arvo',
    body: 'Geist',
    headingWeight: '700',
    bodyWeight: '400',
    googleFonts: 'Arvo:ital,wght@0,400;0,700;1,400;1,700&family=Geist:wght@100..900'
  },
  'merriweather-sans': {
    name: 'Merriweather + Merriweather Sans',
    heading: 'Merriweather',
    body: 'Merriweather Sans',
    headingWeight: '700',
    bodyWeight: '400',
    googleFonts: 'Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900&family=Merriweather+Sans:ital,wght@0,300..800;1,300..800'
  },
  'arvo-montserrat': {
    name: 'Arvo + Montserrat',
    heading: 'Arvo',
    body: 'Montserrat',
    headingWeight: '700',
    bodyWeight: '400',
    googleFonts: 'Arvo:ital,wght@0,400;0,700;1,400;1,700&family=Montserrat:ital,wght@0,100..900;1,100..900'
  },
  'dm-serif-sans': {
    name: 'DM Serif Text + DM Sans',
    heading: 'DM Serif Text',
    body: 'DM Sans',
    headingWeight: '400',
    bodyWeight: '400',
    googleFonts: 'DM+Serif+Text:ital,wght@0,400;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000'
  },
  'mozilla-fonts': {
    name: 'Mozilla Headline + Mozilla Text',
    heading: 'Mozilla Headline',
    body: 'Mozilla Text',
    headingWeight: '600',
    bodyWeight: '400',
    googleFonts: 'Mozilla+Headline:wght@200..700&family=Mozilla+Text:wght@200..700'
  },
  'bitter-raleway': {
    name: 'Bitter + Raleway',
    heading: 'Bitter',
    body: 'Raleway',
    headingWeight: '700',
    bodyWeight: '400',
    googleFonts: 'Bitter:ital,wght@0,100..900;1,100..900&family=Raleway:ital,wght@0,100..900;1,100..900'
  },
  'dm-serif-display-mono': {
    name: 'DM Serif Display + Roboto Mono',
    heading: 'DM Serif Display',
    body: 'Roboto Mono',
    headingWeight: '400',
    bodyWeight: '400',
    googleFonts: 'DM+Serif+Display:ital,wght@0,400;1,400&family=Roboto+Mono:ital,wght@0,100..700;1,100..700'
  },
  'inconsolata-spectral': {
    name: 'Inconsolata + Spectral',
    heading: 'Spectral', // Usually the serif is used for headings in this pairing
    body: 'Inconsolata',
    headingWeight: '600',
    bodyWeight: '400',
    googleFonts: 'Spectral:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,200;1,300;1,400;1,500;1,600;1,700;1,800&family=Inconsolata:wght@200..900'
  }
};

// Font pairing management functions
class FontPairingManager {
  constructor() {
    this.currentPairing = 'mozilla-fonts'; // Default pairing
  }

  // Function to load fonts and apply styles
  loadFontPairing(pairingKey) {
    if (!fontPairings[pairingKey]) {
      console.error(`Font pairing "${pairingKey}" not found`);
      return;
    }

    const pairing = fontPairings[pairingKey];
    this.currentPairing = pairingKey;

    // Remove existing font link
    const existingLink = document.querySelector('link[data-font-pairing]');
    if (existingLink) {
      existingLink.remove();
    }

    // Load Google Fonts
    const fontLink = document.createElement('link');
    fontLink.href = `https://fonts.googleapis.com/css2?family=${pairing.googleFonts}&display=swap`;
    fontLink.rel = 'stylesheet';
    fontLink.setAttribute('data-font-pairing', '');
    document.head.appendChild(fontLink);

    // Apply custom styles
    const styleElement = document.getElementById('font-styles') || document.createElement('style');
    styleElement.id = 'font-styles';
    styleElement.textContent = `
      :root {
        --font-heading: '${pairing.heading}', sans-serif;
        --font-body: '${pairing.body}', sans-serif;
        --weight-heading: ${pairing.headingWeight};
        --weight-body: ${pairing.bodyWeight};
      }

      h1, h2, h3, h4, h5, h6, .font-heading {
        font-family: var(--font-heading);
        font-weight: var(--weight-heading);
      }

      body, p, div, span, .font-body {
        font-family: var(--font-body);
        font-weight: var(--weight-body);
      }

      .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 {
        font-family: var(--font-heading);
        font-weight: var(--weight-heading);
      }

      .prose p, .prose li, .prose td, .prose th {
        font-family: var(--font-body);
        font-weight: var(--weight-body);
      }
    `;

    if (!document.getElementById('font-styles')) {
      document.head.appendChild(styleElement);
    }
  }

  // Get all available font pairings
  getAvailablePairings() {
    return Object.keys(fontPairings);
  }

  // Get current pairing info
  getCurrentPairing() {
    return {
      key: this.currentPairing,
      ...fontPairings[this.currentPairing]
    };
  }

  // Set current pairing
  setCurrentPairing(pairingKey) {
    this.loadFontPairing(pairingKey);
  }
}

// Initialize the font manager (will be used in HTML)
const fontManager = new FontPairingManager();
