import initTurbo, * as turbo from "/pkg/turbo_genesis_host_wasm_bindgen.js";

/**************************************************/
/* CONFIGURATION                                  */
/**************************************************/

// Game metadata
const APP_NAME = "My Turbo Game";
const APP_VERSION = "0.0.0";
const APP_AUTHOR = "Leeroy Jenkins";
const APP_DESCRIPTION = "An awesome game about awesomeness";

// NOTE: You can find your builds in your rust crate in one of two places:
// - target/wasm32-unknown-unknown/release/[package_name].wasm
// - target/wasm32-unknown-unknown/debug/[package_name].wasm
// Copy it into this web directory
const WASM_SRC = "/my_game.wasm";

// The game's resolution
const RESOLUTION = [144, 256];

// Add sprites to this array
const SPRITES = [
  "/sprites/pepe.png",
  // Add as many as you have in your /sprites folder
];

/**************************************************/

// This proxy prevents WebAssembly.LinkingError from being thrown
// prettier-ignore
window.createWasmImportsProxy = (target = {}) => {
    console.log("imports", target);
    return new Proxy(target, {
      get: (target, namespace) => {
          // Stub each undefined namespace with a Proxy
          target[namespace] = target[namespace] ?? new Proxy({}, {
              get: (_, prop) => {
                  // Generate a sub function for any accessed property
                  return (...args) => {
                      console.log(`Calling ${namespace}.${prop} with arguments:`, args);
                      // Implement the actual function logic here
                  };
              }
          });
          return target[namespace];
        }
    })
  };

/**************************************************/

try {
  // Initalize Turbo's WASM runtime
  await initTurbo();

  // Create the game's canvas
  const player = document.getElementById("player");

  // Initialize a temporary 2D context canvas for loading state
  const loading = document.createElement("canvas");
  player?.appendChild(loading);
  var context = loading.getContext("2d");
  context.fillStyle = "white";
  context.font = "bold 14px 04b03";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("Loading...", loading.width / 2, loading.height / 2);

  // Fetch sprites
  const spriteData = await Promise.all(
    SPRITES.map(async (src) => {
      try {
        let res = await fetch(src);
        let buf = await res.arrayBuffer();
        return [
          src.replace(/^.*[\\/]/, "").replace(/.(png|jpg|jpeg|gif)$/, ""),
          buf,
        ];
      } catch (err) {
        console.error("Could not fetch sprite:", src);
        return null;
      }
    }).filter((x) => !!x)
  );

  // Remove loading state
  player?.removeChild(loading);

  // Append game canvas
  const canvas = document.createElement("canvas");
  player?.appendChild(canvas);

  // Run game
  await turbo.run(canvas, spriteData, {
    source: WASM_SRC,
    meta: {
      appName: APP_NAME,
      appVersion: APP_VERSION,
      appAuthor: APP_AUTHOR,
      appDescription: APP_DESCRIPTION,
    },
    config: {
      resolution: RESOLUTION,
    },
  });
} catch (err) {
  console.error("Turbo failed to initialize", err);
}
