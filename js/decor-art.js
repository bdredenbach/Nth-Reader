/* Nth Reader — decor-art.js
 * Inline SVG illustrations for decor items — shaded with gradients so they
 * read as small 3D objects rather than flat icons. Kept as plain functions
 * (not files) so they're easy to swap for real art assets later: replace
 * the body of any DECOR_ART[type] function with an <img> tag pointing at
 * a real illustration and everything else (placement, sizing, dragging,
 * glow) keeps working unchanged.
 */
window.DECOR_ART = {
  bust: () => `
    <svg viewBox="0 0 100 130" width="100%" height="100%">
      <defs>
        <linearGradient id="bustMarble" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#8f8f96"/>
          <stop offset=".35" stop-color="#f2f0ec"/>
          <stop offset=".55" stop-color="#fbfbf9"/>
          <stop offset=".8" stop-color="#c9c8c4"/>
          <stop offset="1" stop-color="#8a898f"/>
        </linearGradient>
        <radialGradient id="bustBase" cx=".5" cy=".2" r=".8">
          <stop offset="0" stop-color="#d8d6d1"/>
          <stop offset="1" stop-color="#8f8d89"/>
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="122" rx="30" ry="7" fill="#000" opacity=".25"/>
      <path d="M22 118 L20 100 Q18 92 26 90 L74 90 Q82 92 80 100 L78 118 Z" fill="url(#bustBase)"/>
      <path d="M32 92 Q26 70 34 54 Q30 46 36 36 Q40 26 50 24 Q60 26 64 36 Q70 46 66 54 Q74 70 68 92
               Q68 84 58 82 L56 88 Q50 91 44 88 L42 82 Q32 84 32 92 Z" fill="url(#bustMarble)"/>
      <path d="M40 34 Q44 24 50 23 Q47 30 46 40 Q42 38 40 34Z" fill="#fff" opacity=".55"/>
      <path d="M60 30 Q66 40 64 52 Q68 44 66 36 Q64 32 60 30Z" fill="#6f6e73" opacity=".35"/>
      <circle cx="45" cy="46" r="1.6" fill="#5c5b60" opacity=".6"/>
      <circle cx="55" cy="46" r="1.6" fill="#5c5b60" opacity=".6"/>
    </svg>`,

  globe: () => `
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <radialGradient id="globeSphere" cx=".35" cy=".3" r=".8">
          <stop offset="0" stop-color="#8fd3f4"/>
          <stop offset=".45" stop-color="#4aa3d8"/>
          <stop offset="1" stop-color="#1b5a8a"/>
        </radialGradient>
        <linearGradient id="globeStand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#c99a4d"/>
          <stop offset="1" stop-color="#7a5320"/>
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="90" rx="22" ry="5" fill="#000" opacity=".25"/>
      <path d="M32 82 L36 66 L64 66 L68 82 Z" fill="url(#globeStand)"/>
      <rect x="46" y="58" width="8" height="10" fill="#8a6532"/>
      <circle cx="50" cy="42" r="30" fill="url(#globeSphere)"/>
      <path d="M22 42 Q50 30 78 42" stroke="#0d3c5c" stroke-width="1.4" fill="none" opacity=".55"/>
      <path d="M22 42 Q50 54 78 42" stroke="#0d3c5c" stroke-width="1.4" fill="none" opacity=".55"/>
      <path d="M50 12 Q38 42 50 72" stroke="#0d3c5c" stroke-width="1.2" fill="none" opacity=".45"/>
      <path d="M28 24 Q34 20 42 22 Q38 30 30 32 Q26 28 28 24Z" fill="#3f9155" opacity=".85"/>
      <path d="M55 20 Q66 18 70 26 Q62 30 54 28 Q52 24 55 20Z" fill="#3f9155" opacity=".85"/>
      <path d="M38 46 Q48 42 58 48 Q54 58 42 56 Q36 52 38 46Z" fill="#357a49" opacity=".85"/>
      <ellipse cx="40" cy="30" rx="9" ry="5" fill="#fff" opacity=".35"/>
    </svg>`,

  plant: () => `
    <svg viewBox="0 0 100 110" width="100%" height="100%">
      <defs>
        <linearGradient id="potGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#e2895a"/>
          <stop offset="1" stop-color="#a3502a"/>
        </linearGradient>
        <linearGradient id="leafGrad1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#6fbf6b"/>
          <stop offset="1" stop-color="#2e7d43"/>
        </linearGradient>
        <linearGradient id="leafGrad2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#4f9a52"/>
          <stop offset="1" stop-color="#255e34"/>
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="102" rx="24" ry="6" fill="#000" opacity=".22"/>
      <path d="M30 68 L34 100 L66 100 L70 68 Z" fill="url(#potGrad)"/>
      <rect x="28" y="62" width="44" height="9" rx="2" fill="#c96b3e"/>
      <path d="M50 66 C40 40 20 40 16 20 C34 22 44 40 50 60 Z" fill="url(#leafGrad1)"/>
      <path d="M50 66 C60 36 84 34 90 16 C68 20 56 40 50 60 Z" fill="url(#leafGrad2)"/>
      <path d="M50 66 C46 30 50 18 46 4 C56 16 56 34 54 60 Z" fill="url(#leafGrad1)"/>
      <path d="M50 66 C54 42 66 34 62 18 C50 26 46 44 46 60 Z" fill="url(#leafGrad2)" opacity=".9"/>
      <path d="M16 20 C24 24 34 32 42 46" stroke="#1e4a2a" stroke-width="1" fill="none" opacity=".5"/>
      <path d="M90 16 C80 22 68 30 58 44" stroke="#173a20" stroke-width="1" fill="none" opacity=".5"/>
    </svg>`,

  candle: () => `
    <svg viewBox="0 0 60 120" width="100%" height="100%">
      <defs>
        <linearGradient id="candleWax" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#b89a6a"/>
          <stop offset=".4" stop-color="#f4e6c8"/>
          <stop offset=".6" stop-color="#fff8e6"/>
          <stop offset="1" stop-color="#c9ac78"/>
        </linearGradient>
        <linearGradient id="candleHolder" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#e8c877"/>
          <stop offset="1" stop-color="#8a6a2c"/>
        </linearGradient>
        <radialGradient id="flameGrad" cx=".5" cy=".7" r=".7">
          <stop offset="0" stop-color="#fff6d0"/>
          <stop offset=".35" stop-color="#ffcf4d"/>
          <stop offset=".75" stop-color="#ff8a2b"/>
          <stop offset="1" stop-color="#ff8a2b" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="30" cy="114" rx="16" ry="5" fill="#000" opacity=".22"/>
      <path d="M14 96 L46 96 L42 112 L18 112 Z" fill="url(#candleHolder)"/>
      <rect x="16" y="40" width="28" height="58" rx="3" fill="url(#candleWax)"/>
      <path d="M30 40 Q26 34 30 28 Q34 34 30 40 Z" fill="#d9c48f"/>
      <rect x="29" y="20" width="2" height="10" fill="#5b4a2c"/>
      <ellipse class="decor-flame" cx="30" cy="16" rx="10" ry="16" fill="url(#flameGrad)"/>
    </svg>`,

  vine: () => `
    <svg viewBox="0 0 100 140" width="100%" height="100%">
      <defs>
        <linearGradient id="vineLeaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#7fc46b"/>
          <stop offset="1" stop-color="#2f6d3a"/>
        </linearGradient>
        <linearGradient id="vinePotGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#8a8f96"/>
          <stop offset="1" stop-color="#4c5157"/>
        </linearGradient>
      </defs>
      <rect x="34" y="2" width="32" height="14" rx="2" fill="url(#vinePotGrad)"/>
      <path d="M40 14 C20 30 46 50 26 68 C50 60 34 44 52 30" stroke="url(#vineLeaf)" stroke-width="3" fill="none"/>
      <path d="M60 14 C82 30 54 52 76 70 C50 60 68 44 48 32" stroke="url(#vineLeaf)" stroke-width="3" fill="none"/>
      <path d="M50 14 C46 46 54 74 44 108" stroke="url(#vineLeaf)" stroke-width="3" fill="none"/>
      ${[[30,26],[22,44],[34,60],[70,26],[78,46],[66,62],[44,50],[52,78],[40,94],[50,110],[38,26]]
        .map(([x,y],i)=>`<ellipse cx="${x}" cy="${y}" rx="8" ry="5" fill="url(#vineLeaf)" transform="rotate(${(i*37)%360} ${x} ${y})"/>`).join("")}
    </svg>`,

  lamp: () => `
    <svg viewBox="0 0 90 120" width="100%" height="100%">
      <defs>
        <linearGradient id="lampShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f6dfa6"/>
          <stop offset="1" stop-color="#d8ad5e"/>
        </linearGradient>
        <linearGradient id="lampBase" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#d8b866"/>
          <stop offset="1" stop-color="#7a5c22"/>
        </linearGradient>
        <radialGradient id="lampGlow" cx=".5" cy=".55" r=".6">
          <stop offset="0" stop-color="#fff3cf" stop-opacity=".95"/>
          <stop offset="1" stop-color="#fff3cf" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="45" cy="112" rx="20" ry="5" fill="#000" opacity=".22"/>
      <ellipse class="decor-flame" cx="45" cy="46" rx="34" ry="30" fill="url(#lampGlow)"/>
      <path d="M20 40 L70 40 L60 12 L30 12 Z" fill="url(#lampShade)"/>
      <rect x="42" y="40" width="6" height="46" fill="url(#lampBase)"/>
      <path d="M26 86 L64 86 L70 100 L20 100 Z" fill="url(#lampBase)"/>
    </svg>`,

  mug: () => `
    <svg viewBox="0 0 90 90" width="100%" height="100%">
      <defs>
        <linearGradient id="mugBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f4f1ea"/>
          <stop offset="1" stop-color="#c9c2b3"/>
        </linearGradient>
        <radialGradient id="steamGrad" cx=".5" cy=".5" r=".5">
          <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <path d="M20 34 Q14 34 14 44 Q14 54 24 54" stroke="#c9c2b3" stroke-width="6" fill="none"/>
      <path d="M22 30 L66 30 L62 74 Q60 82 50 82 L34 82 Q26 82 24 74 Z" fill="url(#mugBody)"/>
      <path d="M22 30 L66 30 L65 38 L23 38 Z" fill="#a49a86"/>
      <path d="M30 20 Q34 12 30 6" stroke="url(#steamGrad)" stroke-width="4" fill="none"/>
      <path d="M42 18 Q46 10 42 2" stroke="url(#steamGrad)" stroke-width="4" fill="none"/>
    </svg>`,

  frame: () => `
    <svg viewBox="0 0 100 90" width="100%" height="100%">
      <defs>
        <linearGradient id="frameWood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#a3703c"/>
          <stop offset="1" stop-color="#5c3c1c"/>
        </linearGradient>
        <linearGradient id="framePhoto" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#bcd8ea"/>
          <stop offset=".5" stop-color="#e8d9b0"/>
          <stop offset="1" stop-color="#96b989"/>
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="86" rx="22" ry="4" fill="#000" opacity=".18"/>
      <rect x="8" y="6" width="84" height="68" rx="3" fill="url(#frameWood)"/>
      <rect x="16" y="14" width="68" height="52" fill="url(#framePhoto)"/>
      <path d="M16 54 L36 34 L50 48 L62 30 L84 54 L84 66 L16 66 Z" fill="#5b7a52" opacity=".8"/>
      <circle cx="70" cy="26" r="7" fill="#f4e28a"/>
    </svg>`,
};

window.DECOR_TYPES = Object.keys(window.DECOR_ART);
window.DECOR_LABELS = {
  bust: "Bust", globe: "Globe", plant: "Plant", candle: "Candle",
  vine: "Vine", lamp: "Lamp", mug: "Mug", frame: "Frame",
};
// Items that hang from the shelf above rather than stand on the ledge.
window.DECOR_HANGING = { vine: true };
