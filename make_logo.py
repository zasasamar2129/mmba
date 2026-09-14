import os

svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="100%" height="100%">
  <defs>
    <!-- Crisp Drop Shadow for Dark and Light Modes -->
    <filter id="soft-glow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.08" />
    </filter>
  </defs>

  <g filter="url(#soft-glow)">
    <!-- ==================== 1. TOP ICON: M WITH ORANGE SIGNAL BARS ==================== -->
    <g id="icon-m">
      <!-- Blue Left Pillar and Center Stem of M -->
      <path fill="#007BFF" d="
        M 194,204
        C 194,209 198,212 204,212
        L 226,212
        C 232,212 236,209 236,204
        L 236,134
        C 236,126 242,120 250,120
        C 258,120 264,126 264,134
        L 264,204
        C 264,209 268,212 274,212
        L 294,212
        C 300,212 304,209 304,204
        L 304,138
        C 304,132 308,128 314,128
        C 317,128 320,129 322,131
        L 364,101
        C 368,98 368,92 364,89
        L 348,77
        C 342,72 334,72 328,77
        L 278,114
        C 272,118 264,118 258,114
        L 224,84
        C 216,77 206,73 196,80
        C 194,82 194,87 194,92
        Z
      " />

      <!-- Blue Top-Right Wing of M -->
      <path fill="#007BFF" d="
        M 268,106
        L 336,54
        C 348,45 366,45 380,54
        C 398,68 410,84 410,106
        C 410,114 406,120 398,126
        L 306,192
        C 298,198 290,192 292,184
        L 304,142
        Z
      " />

      <!-- Left Blue Arch Main Body (smoothing out full M contour) -->
      <path fill="#007BFF" d="
        M 194,204
        L 194,98
        C 194,72 212,54 238,54
        C 252,54 266,61 274,72
        L 282,84
        L 266,96
        L 258,85
        C 253,78 245,74 236,74
        C 222,74 212,84 212,98
        L 212,204
        C 212,208 208,212 203,212
        L 203,212
        C 198,212 194,208 194,204
        Z
      " />

      <!-- Center Blue Peak/Stem Connector -->
      <path fill="#007BFF" d="
        M 268,130
        L 268,204
        C 268,208 272,212 276,212
        L 290,212
        C 294,212 298,208 298,204
        L 298,136
        C 298,131 295,127 290,126
        L 274,124
        C 270,124 268,126 268,130
        Z
      " />

      <!-- Orange Cellular Signal / Growth Bar 1 (Short) -->
      <rect fill="#FF7A00" x="308" y="162" width="22" height="50" rx="6" />

      <!-- Orange Cellular Signal / Growth Bar 2 (Medium) -->
      <rect fill="#FF7A00" x="340" y="132" width="24" height="80" rx="6" />

      <!-- Orange Cellular Signal / Growth Bar 3 (Tall, matching outer slope) -->
      <path fill="#FF7A00" d="
        M 374,96
        C 374,90 378,86 384,86
        C 396,86 408,98 408,112
        L 408,204
        C 408,209 404,212 398,212
        L 384,212
        C 378,212 374,209 374,204
        Z
      " />
    </g>

    <!-- ==================== 2. TYPOGRAPHY: MMBA ==================== -->
    <g id="typography-mmba">
      <!-- M #1 -->
      <path fill="#007BFF" d="
        M 90,284 L 90,230
        C 90,222 96,216 104,216
        C 112,216 118,220 122,226
        L 134,245
        L 146,226
        C 150,220 156,216 164,216
        C 172,216 178,222 178,230
        L 178,284
        C 178,288 174,291 170,291
        L 158,291
        C 154,291 151,288 151,284
        L 151,244
        L 140,262
        C 137,266 131,266 128,262
        L 117,244
        L 117,284
        C 117,288 114,291 110,291
        L 98,291
        C 94,291 90,288 90,284
        Z
      " />

      <!-- M #2 -->
      <path fill="#007BFF" d="
        M 194,284 L 194,230
        C 194,222 200,216 208,216
        C 216,216 222,220 226,226
        L 238,245
        L 250,226
        C 254,220 260,216 268,216
        C 276,216 282,222 282,230
        L 282,284
        C 282,288 278,291 274,291
        L 262,291
        C 258,291 255,288 255,284
        L 255,244
        L 244,262
        C 241,266 235,266 232,262
        L 221,244
        L 221,284
        C 221,288 218,291 214,291
        L 202,291
        C 198,291 194,288 194,284
        Z
      " />

      <!-- B -->
      <path fill="#007BFF" d="
        M 298,222
        C 298,218 302,216 306,216
        L 352,216
        C 366,216 376,224 376,236
        C 376,244 370,250 362,252
        C 372,254 378,262 378,271
        C 378,283 366,291 352,291
        L 306,291
        C 302,291 298,288 298,284
        Z
        M 322,232 L 322,244 L 348,244 C 352,244 355,241 355,238 C 355,235 352,232 348,232 Z
        M 322,260 L 322,274 L 350,274 C 354,274 358,271 358,267 C 358,263 354,260 350,260 Z
      " />

      <!-- A (Blue Structure) -->
      <path fill="#007BFF" d="
        M 392,284 L 392,232
        C 392,222 402,216 414,216
        L 468,216
        C 480,216 490,222 490,232
        L 490,284
        C 490,288 486,291 482,291
        L 468,291
        C 464,291 461,288 461,284
        L 461,266
        L 421,266
        L 421,284
        C 421,288 418,291 414,291
        L 400,291
        C 396,291 392,288 392,284
        Z
        M 421,250 L 461,250 L 461,234 C 461,230 457,227 453,227 L 429,227 C 425,227 421,230 421,234 Z
      " />

      <!-- A Inner Orange Accent Feature -->
      <rect fill="#FF7A00" x="427" y="264" width="28" height="20" rx="4" />
    </g>

    <!-- ==================== 3. SUBTITLE: — PANEL — ==================== -->
    <g id="panel-rule">
      <line stroke="#007BFF" stroke-width="4.5" stroke-linecap="round" x1="104" y1="328" x2="176" y2="328" />
      <text
        x="300"
        y="337"
        text-anchor="middle"
        fill="#5A687D"
        style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 800; font-size: 26px; letter-spacing: 0.42em;"
      >PANEL</text>
      <line stroke="#007BFF" stroke-width="4.5" stroke-linecap="round" x1="404" y1="328" x2="476" y2="328" />
    </g>
  </g>
</svg>
'''

with open("public/logo.svg", "w") as f:
    f.write(svg_content.strip())

with open("dist/logo.svg", "w") as f:
    f.write(svg_content.strip())

print("make_logo.py completed successfully")
