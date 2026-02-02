import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { windowsSign } from "./windowsSign";
import * as path from "path";
import * as fs from "fs";

const config: ForgeConfig = {
  outDir: "out",
  packagerConfig: {
    asar: {
      unpack: "**/node_modules/{better-sqlite3,bindings,file-uri-to-path}/**",
    },
    icon: "./assets/icon",
    extraResource: [
      "./python-dist/samsara-backend", // Python sidecar directory
    ],
    // macOS signing (only applied when building for macOS with certs)
    ...(process.env.APPLE_ID
      ? {
          osxSign: {
            identity: process.env.APPLE_IDENTITY || "Developer ID Application",
            hardenedRuntime: true,
            entitlements: "./entitlements.plist",
            entitlementsInherit: "./entitlements.plist",
          },
          osxNotarize: {
            appleId: process.env.APPLE_ID,
            appleIdPassword: process.env.APPLE_ID_PASSWORD!,
            teamId: process.env.APPLE_TEAM_ID!,
          },
        }
      : {}),
    // Windows signing
    ...(windowsSign ? { windowsSign } : {}),
  },
  rebuildConfig: {},
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      // Vite doesn't copy node_modules — native modules and their deps must be copied manually
      const modules = ["better-sqlite3", "bindings", "file-uri-to-path"];
      for (const mod of modules) {
        const src = path.resolve("node_modules", mod);
        const dest = path.join(buildPath, "node_modules", mod);
        fs.cpSync(src, dest, { recursive: true });
      }
    },
  },
  makers: [
    new MakerSquirrel({
      name: "samsara",
      setupIcon: "./assets/icon.ico",
      setupExe: "SamsaraSetup.exe",
    }),
    new MakerZIP({}, ["win32", "darwin"]),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      // Prevent OOM issues during builds
      concurrent: false,
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: "src/main/index.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/main/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
};

export default config;
