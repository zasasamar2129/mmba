# Let's write an ultra-precise SVG matching the user's image exactly

svg_code = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="100%" height="100%">
  <defs>
    <style>
      .blue-color { fill: #007BFF; }
      .orange-color { fill: #FF7A00; }
      .line-color { stroke: #007BFF; stroke-width: 4.5; stroke-linecap: round; }
      .panel-text {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 800;
        font-size: 26px;
        fill: #64748B;
        letter-spacing: 0.42em;
      }
      @media (prefers-color-scheme: dark) {
        .panel-text { fill: #94A3B8; }
      }
    </style>
  </defs>

  <!-- ==================== TOP ICON ==================== -->
  <g id="top-icon">
    <!-- 1. Left Pillar & Center Segment of the M (Blue) -->
    <!--
      Left outer edge: X = 190
      Left inner edge: X = 236
      Center valley: X = 270, Y = 135
      Center pillar right edge: X = 296, Y = 210
    -->
    <path class="blue-color" d="
      M 190,202
      C 190,207 194,210 200,210
      L 224,210
      C 230,210 234,207 234,202
      L 234,130
      C 234,124 238,120 244,120
      C 250,120 254,124 254,130
      L 254,202
      C 254,207 258,210 264,210
      L 288,210
      C 294,210 298,207 298,202
      L 298,142
      L 372,88
      C 378,84 378,74 372,70
      L 348,52
      C 342,48 332,48 326,53
      L 278,92
      C 274,95 268,95 264,92
      L 224,58
      C 216,52 206,48 196,54
      C 190,58 190,66 190,74
      Z
    " />

    <!-- 2. Upper Right Blue Wing of the M -->
    <path class="blue-color" d="
      M 264,92
      L 332,38
      C 344,28 362,28 376,38
      C 394,52 410,68 410,92
      C 410,102 404,110 396,116
      L 300,186
      C 294,190 286,186 288,178
      L 298,142
      L 264,92
      Z
    " />

    <!-- 3. Ascending Orange Signal / Growth Bars (3 Bars) -->
    <!-- Bar 1 (Leftmost, Short) -->
    <rect class="orange-color" x="308" y="166" width="22" height="44" rx="6" />

    <!-- Bar 2 (Middle, Medium) -->
    <rect class="orange-color" x="342" y="136" width="24" height="74" rx="6" />

    <!-- Bar 3 (Rightmost, Tallest with rounded top-right matching M contour) -->
    <path class="orange-color" d="
      M 378,96
      C 378,90 382,86 388,86
      C 398,86 410,96 410,110
      L 410,202
      C 410,207 406,210 400,210
      L 386,210
      C 381,210 378,207 378,202
      Z
    " />
  </g>

  <!-- ==================== MMBA TYPOGRAPHY ==================== -->
  <g id="typography-mmba">
    <!-- Letter 'M' #1 -->
    <path class="blue-color" d="
      M 90,282 L 90,230
      C 90,222 96,216 104,216
      C 112,216 118,220 122,226
      L 134,245
      L 146,226
      C 150,220 156,216 164,216
      C 172,216 178,222 178,230
      L 178,282
      C 178,286 174,289 170,289
      L 158,289
      C 154,289 151,286 151,282
      L 151,244
      L 140,262
      C 137,266 131,266 128,262
      L 117,244
      L 117,282
      C 117,286 114,289 110,289
      L 98,289
      C 94,289 90,286 90,282
      Z
    " />

    <!-- Letter 'M' #2 -->
    <path class="blue-color" d="
      M 194,282 L 194,230
      C 194,222 200,216 208,216
      C 216,216 222,220 226,226
      L 238,245
      L 250,226
      C 254,220 260,216 268,216
      C 276,216 282,222 282,230
      L 282,282
      C 282,286 278,289 274,289
      L 262,289
      C 258,289 255,286 255,282
      L 255,244
      L 244,262
      C 241,266 235,266 232,262
      L 221,244
      L 221,282
      C 221,286 218,289 214,289
      L 202,289
      C 198,289 194,286 194,282
      Z
    " />

    <!-- Letter 'B' -->
    <path class="blue-color" d="
      M 298,222
      C 298,218 302,216 306,216
      L 352,216
      C 366,216 376,224 376,236
      C 376,244 370,250 362,252
      C 372,254 378,262 378,271
      C 378,282 366,289 352,289
      L 306,289
      C 302,289 298,286 298,282
      Z
      M 322,232 L 322,244 L 348,244 C 352,244 355,241 355,238 C 355,235 352,232 348,232 Z
      M 322,258 L 322,272 L 350,272 C 354,272 358,269 358,265 C 358,261 354,258 350,258 Z
    " />

    <!-- Letter 'A' (Blue Body) -->
    <path class="blue-color" d="
      M 392,282 L 392,232
      C 392,222 402,216 414,216
      L 468,216
      C 480,216 490,222 490,232
      L 490,282
      C 490,286 486,289 482,289
      L 468,289
      C 464,289 461,286 461,282
      L 461,264
      L 421,264
      L 421,282
      C 421,286 418,289 414,289
      L 400,289
      C 396,289 392,286 392,282
      Z
      M 421,248 L 461,248 L 461,234 C 461,230 457,227 453,227 L 429,227 C 425,227 421,230 421,234 Z
    " />

    <!-- Letter 'A' (Orange Accent Block) -->
    <rect class="orange-color" x="428" y="262" width="28" height="18" rx="4" />
  </g>

  <!-- ==================== SUBTITLE — PANEL — ==================== -->
  <g id="panel-rule">
    <line class="line-color" x1="104" y1="325" x2="176" y2="325" />
    <text class="panel-text" x="300" y="334" text-anchor="middle">PANEL</text>
    <line class="line-color" x1="404" y1="325" x2="476" y2="325" />
  </g>
</svg>
'''

with open("public/logo.svg", "w") as f:
    f.write(svg_code.strip())

with open("dist/logo.svg", "w") as f:
    f.write(svg_code.strip())

print("Updated public/logo.svg and dist/logo.svg successfully!")
