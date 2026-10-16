# Tesla Roadster: 3D Design Explorer
An interactive, real-time 3D model of Tesla's new Roadster that runs in the browser. Orbit it, open the butterfly doors, switch aero modes, drive it across a salt flat, or hit **Fly** and watch it lift off on its thrusters.
**Try it: [tesla-roadster-two.vercel.app](https://tesla-roadster-two.vercel.app/)**
![The Roadster hovering at night on its thrusters](docs/flight.jpg)
## Features
- **Three trims:** Performance, Thrust and Rocket, each with its own spec card.
- **Three aero modes:** Road, High Downforce and Low Drag. The wing deploys and the car lowers.
- **Butterfly doors, hidden headlights, cold-gas thrusters and a detailed cabin**, plus clickable hotspots that explain each feature.
- **Fly mode:** the car lifts off on four downward thrusters that kick up a smoke cloud.
- **Free Drive:** an arcade driving model with steering, boost and flight, across endless ground.
- **Three scenes:** a photo studio, a sunlit salt flat and a starry night desert.
- **Six paints:** Ano White, Titanium, Stealth Grey, Midnight, Ultra Red and Frost Blue.
- **Adaptive soundtrack and sound effects:** the music builds as you drive, boost and fly.
- **Phone friendly:** touch pedals and a steering pad in Free Drive, plus a lighter render on phones.
![The Roadster in the studio](docs/studio.jpg)
## Controls
**Mouse:** drag to orbit, scroll to zoom, right-drag to pan, double-click the car to focus.
**Touch:** drag to orbit and pinch to zoom. Free Drive shows on-screen pedals and a steering pad.
| Key | Action |
| --- | --- |
| `1` `2` `3` | Road / High Downforce / Low Drag |
| `D` | Open or close the doors (`O` while in Free Drive) |
| `L` | Lights |
| `T` | Fire the thrusters |
| `F` | Fly (in Free Drive: take off / land) |
| `V` | Drive demo |
| `G` | Free Drive on / off |
| `W` `A` `S` `D` / arrows | Free Drive: throttle, steer, brake |
| `Space` | Free Drive: thruster boost |
| `U` | Underside view on / off |
| `C` / `E` / `P` | Next camera / scene / paint |
| `R` | Turntable |
| `M` | Music on / off |
| `H` | Hide or show the interface |
| `?` | Show all shortcuts |
| `Esc` | Close panels |
## Tech stack
- **[Three.js](https://threejs.org/) (r186)** with WebGL 2: physically based clear-coat paint, soft shadows, bloom and neutral tone mapping.
- **[three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh)** for fast raycasts that lay the panel lines onto the body.
- **Web Audio API:** the music and every sound effect are synthesized live, with no audio files.
- **[Vite](https://vite.dev/)** for the dev server and production build.
- **[Vercel](https://vercel.com/)** for hosting.
- **[Playwright](https://playwright.dev/)** for the screenshot, interaction and phone test scripts.
There are no 3D model, texture or audio files. The car body, wheels, cabin, scenery and textures are all generated in code when the page loads.
Built with **Claude Opus 5.5** in [Cursor](https://cursor.com/).
## Run locally
You need [Node.js](https://nodejs.org/) 20.19 or newer.
```bash
npm install
npm run dev       # http://localhost:5199
npm run build     # production build in dist/
npm run preview   # serve the production build
```
## Project structure
```text
index.html            page shell and loading screen
src/
  main.js             renderer, scene, frame loop and app state
  quality.js          lighter settings for phones
  car/                car body, panel lines, wheels, cabin, materials and logos
  env/                studio, salt flat and night scenes
  fx/                 thruster plumes, flight smoke and contact shadow
  drive/              Free Drive physics
  camera/             camera moves between views
  audio/              synthesized music, engine and sound effects
  ui/                 interface, text content and styles
tools/                Playwright test and screenshot scripts
docs/                 README images
vercel.json           Vercel build settings
```
## Test scripts
These scripts need the dev server running (`npm run dev`) and Google Chrome installed.
```bash
node tools/shot.mjs /tmp/shots "night:env=night&cam=34"   # screenshots from URL options
node tools/interact.mjs /tmp/run                          # clicks through the app and checks for errors
node tools/mobile.mjs /tmp/mobile                         # phone-sized touch test, portrait and landscape
node tools/perf.mjs                                       # frame time in each scene
```
## Deploy
1. Push or upload this folder to a GitHub repo, without `node_modules/` or `dist/`.
2. On [Vercel](https://vercel.com/), choose **Add New → Project** and import the repo.
3. Keep the detected settings: Vite, `npm run build`, output `dist`. No environment variables are needed.
4. Click **Deploy**. Each new commit redeploys automatically.
## Disclaimer
This is an unofficial fan project and is not affiliated with or endorsed by Tesla, Inc. "Tesla" and "Roadster" are trademarks of Tesla, Inc. The model is an artistic interpretation built from public photos and reveal coverage.
