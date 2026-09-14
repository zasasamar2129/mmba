import re

svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 320" width="100%" height="100%">
  <defs>
    <style>
      .cls-blue { fill: #007BFF; }
      .cls-orange { fill: #FF7A00; }
      .cls-line { stroke: #007BFF; stroke-width: 4; stroke-linecap: round; }
      .cls-panel {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-weight: 800;
        font-size: 22px;
        fill: #64748B;
        letter-spacing: 0.38em;
      }
      @media (prefers-color-scheme: dark) {
        .cls-panel { fill: #94A3B8; }
      }
    </style>
  </defs>

  <!-- TOP ICON: STYLIZED M WITH CELLULAR GROWTH BARS -->
  <g id="icon-m" transform="translate(0, 0)">
    <!-- 1. Left Vertical Pillar of M -->
    <path class="cls-blue" d="
      M 160,172
      L 160,65
      C 160,42 178,28 200,28
      C 214,28 226,35 233,46
      L 250,72
      L 250,172
      C 250,177 246,180 241,180
      L 229,180
      C 224,180 220,177 220,172
      L 220,96
      C 220,91 216,87 211,87
      C 206,87 202,91 202,96
      L 202,172
      C 202,177 198,180 193,180
      L 169,180
      C 164,180 160,177 160,172
      Z
    " />

    <!-- 2. Blue Diagonal Wing of M (Top Right) -->
    <path class="cls-blue" d="
      M 250,72
      L 267,46
      C 274,35 286,28 300,28
      C 322,28 340,42 340,65
      L 340,82
      C 340,86 337,89 333,91
      L 254,124
      C 248,127 242,122 243,116
      L 250,72
      Z
    " />

    <!-- 3. Orange Cellular Signal Bars (Ascending 1, 2, 3) -->
    <!-- Bar 1 (Shortest) -->
    <rect class="cls-orange" x="256" y="142" width="20" height="38" rx="6" />

    <!-- Bar 2 (Medium) -->
    <rect class="cls-orange" x="284" y="116" width="22" height="64" rx="6" />

    <!-- Bar 3 (Tallest) -->
    <rect class="cls-orange" x="314" y="86" width="26" height="94" rx="7" />
  </g>

  <!-- TYPOGRAPHY: MMBA -->
  <g id="text-mmba">
    <!-- Letter 'M' (1) -->
    <path class="cls-blue" d="
      M 76,264 L 76,212 C 76,204 82,198 90,198 C 96,198 102,201 105,207
      L 115,226 L 125,207 C 128,201 134,198 140,198 C 148,198 154,204 154,212
      L 154,264 C 154,267 151,270 148,270 L 138,270 C 135,270 132,267 132,264
      L 132,228 L 121,248 C 119,252 113,254 109,252 C 107,251 106,250 105,248
      L 98,228 L 98,264 C 98,267 95,270 92,270 L 82,270 C 79,270 76,267 76,264 Z
    " />

    <!-- Letter 'M' (2) -->
    <path class="cls-blue" d="
      M 166,264 L 166,212 C 166,204 172,198 180,198 C 186,198 192,201 195,207
      L 205,226 L 215,207 C 218,201 224,198 230,198 C 238,198 244,204 244,212
      L 244,264 C 244,267 241,270 238,270 L 228,270 C 225,270 222,267 222,264
      L 222,228 L 211,248 C 209,252 203,254 199,252 C 197,251 196,250 195,248
      L 188,228 L 188,264 C 188,267 185,270 182,270 L 172,270 C 169,270 166,267 166,264 Z
    " />

    <!-- Letter 'B' -->
    <path class="cls-blue" d="
      M 256,204 C 256,200 259,198 263,198 L 305,198
      C 318,198 328,206 328,217
      C 328,225 322,231 315,233
      C 324,235 330,242 330,251
      C 330,262 319,270 305,270
      L 263,270 C 259,270 256,267 256,263
      Z
      M 278,214 L 278,226 L 302,226 C 306,226 309,223 309,220 C 309,217 306,214 302,214 Z
      M 278,240 L 278,254 L 303,254 C 307,254 311,251 311,247 C 311,243 307,240 303,240 Z
    " />

    <!-- Letter 'A' (Outer Blue Arch + Inner Orange Counter) -->
    <path class="cls-blue" d="
      M 342,264 L 342,216
      C 342,204 352,198 365,198
      L 403,198
      C 416,198 426,204 426,216
      L 426,264
      C 426,267 423,270 420,270
      L 408,270
      C 405,270 402,267 402,264
      L 402,246
      L 366,246
      L 366,264
      C 366,267 363,270 360,270
      L 348,270
      C 345,270 342,267 342,264
      Z
      M 366,232 L 402,232 L 402,216 C 402,212 399,209 395,209 L 373,209 C 369,209 366,212 366,216 Z
    " />

    <!-- Iconic Orange Counter inside 'A' -->
    <rect class="cls-orange" x="374" y="244" width="28" height="24" rx="4" />
  </g>

  <!-- SUBTITLE: — PANEL — -->
  <g id="panel-group">
    <line class="cls-line" x1="88" y1="298" x2="152" y2="298" />
    <text class="cls-panel" x="254" y="306" text-anchor="middle">PANEL</text>
    <line class="cls-line" x1="350" y1="298" x2="414" y2="298" />
  </g>
</svg>'''

with open("public/logo.svg", "w") as f:
    f.write(svg)

print("Generated public/logo.svg successfully!")
