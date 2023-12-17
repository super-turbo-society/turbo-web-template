# Turbo Web Template

## Getting Started

In the "Steps" section, replace `my-game` with the path to wherever your actual project dir is in the following commands.

### Steps

> ℹ️ You should run all these commands from the project root directory.

#### 1. Build your game

From the `my-game` dir run:

```sh
cd my-game && cargo build -r --target wasm32-unknown-unknown
```

#### 2. Copy the wasm file to the root of the `www` dir

```sh
cp my-game/target/wasm32-unknown-unknown/release/my_game.wasm www/my_game.wasm
```

> Note that the wasm binary will replace dashes in the package name with underscores.

#### 3. Copy the sprites from `my-game` to www

Be extra careful not to delete the sprites in your project dir!

```sh
rm -rf www/sprites && cp -r my-game/sprites www/sprites
```

#### 4. Edit your game configuration in `www/main.js` and `www/solana.js`

The most important parts are the wasm source, resolution, and the sprites in `www/solana.js`.

If you are using solana features, be sure to update the rpc urls in `www/solana.js`.

#### 5. Update `www/manifest.json`, `www/favicon.ico`, `www/logo_192x192.png`, the meta tags in `www/index.html`, etc

This is how you can customize your game's appearance as a PWA.

## Shipping

You just copy the content of the `www` to whatever hosting service you are using :)

If you want to see a preview beforehand, just start a local server and host that dir.

## Debugging

### I see an error on the console: `JsValue(CompileError: WebAssembly.instantiate(): expected magic word ....)`

Double check the `WASM_SRC` in `www/main.js`;

### I don't see my sprites

Make sure the files are in `www/sprites` and make sure you add their paths in `www/main.js`

### I don't see my wasm file in `target/wasm32-unknown-unknown/release`

If you did a non-release build, it may be in `target/wasm32-unknown-unknown/debug`. Turbo defaults to release builds. But if you compile the game manually just be careful. Either build will work on the web. The release build will be smaller / download faster.

### The ServiceWorker is throwing some console errors

`www/sw.js` is copy-pasta boilerplate, yeah that thing needs to get updated sorry. I should get around to it soon. But feel free to make a PR in the meantime if you want!

### I don't like the way the virtual gamepad buttons look on mobile

Feel free to mess with the css in `www/style.css`