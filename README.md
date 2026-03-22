# Skyscraper Ragdoll Run

A third-person 3D ragdoll physics game built with Three.js + cannon-es.

## How to run

```bash
cd /Users/ianchoefroggggy/Documents/GitHub/balloon-world-sim
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000).

## Controls

- `W A S D`: Move
- `Shift`: Sprint
- `Space`: Jump
- Hold **right mouse button** + drag: Orbit third-person camera
- Mouse wheel: Zoom camera in/out
- `F`: Turn into ragdoll (physics limbs)
- `R`: Respawn
- `N`: Toggle day/night (same as UI button)

## What is implemented

- Very tall skyscraper styled like the reference image (concrete + dark frame + window grid).
- Interior spiral stairs all the way to rooftop level.
- Floor teleport pad beside the building: stepping on it sends you to the top.
- Default humanoid with separate limbs.
- Ragdoll physics with independent body parts and constraints for crumpling falls.
- Third-person camera follow system.
- Animated pointy grass blades with wind sway.
- Sky dome with cloud texture and day/night transitions.
- Sun and moon visuals that swap with day/night mode.

## Notes

- The building height is intentionally very large (`260` world units) for long falls.
- If you fall too far while ragdolled, the game auto-respawns.
