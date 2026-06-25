# FigUI Surfacing Plugin

A spoilboard / timber surfacing G-code generator for [FigUI](https://github.com/figamore/FigUI).

## Features

- **Configurable work area** — set Width (X) and Length (Y) dimensions
- **Total depth of cut** — target Z depth to remove from the surface
- **Multi-pass cutting** — splits total depth into N equal passes, each doing a full raster over the area. Useful for large depths where a single pass would overload the tool
- **Stepover control** — radial distance between adjacent raster rows
- **One-direction climb milling** — cuts in only one direction per row, lifting between rows. This ensures the cutting edge always leads, preventing the trailing edge from rubbing
- **Four cutting directions** — East (+X), West (-X), North (+Y), South (-Y)
- **Row progression** — Normal (back-to-front) or Reverse (front-to-back) for flexible cutting order
- **Z lift** — configurable retract height for all rapid movements
- **Independent feed, plunge, and travel rates**
- **G-code preview** — generated code displayed in a read-only textarea
- **Save to device** — writes the G-code file to the machine's SD card
- **Send to machine** — streams G-code directly via the FigUI WebSocket
- **Statistics** — shows pass count, row count, cutting distance, travel distance, and estimated time

## Installation

### Via FigUI Plugin Store (if published)
1. Open FigUI → Plugins tab
2. Browse the store → find **Surfacing** → click **Install**

### Manual install (folder upload)
1. Download or clone this repo
2. In FigUI → Plugins tab → click **Add**
3. Select the `surfacing/` folder → choose storage location
4. The plugin appears in your plugin list

### Manual install (direct copy)
Copy the `surfacing/` folder to the device:
- Internal flash: `/plugins/surfacing/`
- SD card: `/sd/plugins/surfacing/`

Then refresh the Plugins tab in FigUI.

## Usage

1. Open FigUI → Plugins → **Surfacing**
2. Configure dimensions, cut parameters, speeds, and strategy
3. Click **Generate G-code**
4. Review the generated code in the preview pane
5. Save to the machine's SD card or send directly

## Parameters

| Parameter | Description |
|---|---|
| Width (X) | Area size in the X axis (mm) |
| Length (Y) | Area size in the Y axis (mm) |
| Total Depth of Cut | Total Z depth to remove (mm). Positive value |
| Number of Passes | Split total depth into this many equal passes |
| Stepover | Radial distance between adjacent rows (mm) |
| Z Lift | Height to retract to for rapid moves (mm) |
| Feed Rate | Cutting speed (mm/min) |
| Plunge Rate | Z-axis descent speed (mm/min) |
| Travel Rate | XY rapid speed (mm/min) |
| Cut Direction | E (+X), W (-X), N (+Y), S (-Y) |
| Row Progression | Normal or Reverse |

## Assumptions

- The machine is already zeroed (X0 Y0 Z0) at the top-left corner of the area before starting
- Spindle is started automatically (`M3 S10000`)
- Climb milling direction is enforced by only cutting in one direction per row

## Credits

Inspired by [gcode_tpgen](https://github.com/vector76/gcode_tpgen) by vector76. The surfacing raster algorithm (one-direction climb milling with configurable cut direction, row progression, and stepover) is derived from that project. The implementation in this plugin has been rewritten and extended with multi-pass Z depth support.
