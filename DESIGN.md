# Limen visual system

Limen is a pond box. The screen should stay calm, because the thing being watched is a pond.

## Color

Six values are enough.

| Name | Light | Dark | Job |
| --- | --- | --- | --- |
| Ground | `#e4efe9` | `#172421` | Page clay |
| Surface | `#eef6f2` | `#22302b` | Raised card |
| Ink | `#16332e` | `#e8f4ef` | Text |
| Soft ink | `#244740` | `#c9e2d9` | Secondary text |
| Accent | `#1c6558` | `#9ed9cb` | Button and line |
| Accent ink | `#f4fbf8` | `#10211c` | Text on a button |

Light comes from the upper left. A raised card has a dark shadow at the lower right and a light shadow at the upper left. Wells (the water trough, the badge, the slider) use an inner shadow. Status color lives in the water. Text stays ink.

## Type

Fraunces for titles and the big number. Outfit for the interface and body. Both are bundled with the app. Large titles use tight tracking. Body tracking stays at zero. Line length is about 40rem.

## Layout

Start flows from the left: the sentence, the explanation, two actions, and the water trough beside them. Pond conditions sit under that. Then four sensor cards, one score list, field notes, and the open tray.

Readings are tighter: state, score parts, four sensors, basin depth, chart, table, shifts.

Guide is a transcript and a question field. The answer card is raised. The question card is inset.

## Motion

The shine on the water trough is the only ornament. Numbers move because the readings move. Cards do not bounce in on load. `prefers-reduced-motion` turns off the shine and the press scale. A hidden tab stops new readings.
