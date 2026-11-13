# Circuit data notice

The circuit layouts in `../circuits.ts` (Monza, Suzuka, Spa, Interlagos) are derived from the
**TUMFTM racetrack-database** by the Institute of Automotive Technology, Technical University of
Munich: https://github.com/TUMFTM/racetrack-database

That data is licensed under the **GNU Lesser General Public License v3.0** — full text in
[`LICENSE-LGPL-3.0.txt`](LICENSE-LGPL-3.0.txt).

Changes made for CoinDraft: each centerline is centred, scaled so its longest side is 140 scene
units, resampled to 400 points, and its y axis flipped onto the scene's Z axis. Measured lap lengths
and track widths are kept as published. The conversion is reproducible from the original CSVs.

Circuit names are used as place names only; CoinDraft is not affiliated with any racing series,
event or circuit owner.
