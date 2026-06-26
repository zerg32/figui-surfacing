# FigUI Surfacing

A spoilboard / timber surfacing G-code generator plugin for [FigUI](https://github.com/figamore/FigUI).

## Features

- Configurable width (X) and length (Y) dimensions
- Total depth of cut with multi-pass splitting
- Stepover-controlled raster rows
- One-direction climb milling (E/W/N/S)
- Z lift, independent feed/plunge/travel rates
- Spindle RPM control
- Dry Run mode — traces perimeter at safe height then pauses for verification
- Save generated G-code to device SD card or send directly to the machine
- Settings persist across sessions

## Installation

### Via FigUI Plugin Store
Open FigUI → Plugins → browse store → install **Surfacing**.

### Manual upload
1. Download or clone this repo
2. In FigUI → Plugins → **Add** → select the `plugins/surfacing/` folder
3. The plugin appears in your plugin list

### Direct copy
Copy `plugins/surfacing/` to `/plugins/surfacing/` or `/sd/plugins/surfacing/` on the device, then refresh FigUI's Plugins tab.

## Parameters

| Parameter | Description |
|---|---|
| Width (X) | Area size in X (mm) |
| Length (Y) | Area size in Y (mm) |
| Total Depth of Cut | Z depth to remove (mm, positive) |
| Number of Passes | Split depth into N equal passes |
| Stepover | Radial distance between rows (mm) |
| Z Lift | Retract height for rapids (mm) |
| Feed Rate | Cutting speed (mm/min) |
| Plunge Rate | Z descent speed (mm/min) |
| Travel Rate | XY rapid speed (mm/min) |
| Spindle Speed | RPM |
| Dry Run | Trace perimeter at safe height then M0 pause |
| Cut Direction | E (+X), W (-X), N (+Y), S (-Y) |
| Row Progression | Normal or Reverse |

## Credits

Inspired by [gcode_tpgen](https://github.com/vector76/gcode_tpgen) by vector76. The one-direction climb milling raster algorithm with configurable direction and stepover is derived from that project. This implementation is rewritten and extended with multi-pass Z depth support, settings persistence, and a FigUI plugin UI.
