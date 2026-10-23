# Third-party notices

This project is MIT licensed (see [LICENSE](LICENSE)). It depends on open-source packages installed from npm, each under its own license. Two need a notice:

- **sharp** and its prebuilt libvips binaries (`@img/sharp-*`, Apache-2.0 AND LGPL-3.0-or-later). Installed by Next.js for image optimisation. The libvips binaries are not stored in this repository and are linked dynamically. Source: https://github.com/lovell/sharp and https://github.com/libvips/libvips
- **caniuse-lite** (CC-BY-4.0), browser-support data used at build time by Next.js tooling. Source: https://github.com/browserslist/caniuse-lite

Web fonts (Inter, DM Sans, Fraunces, Lora, Manrope, Outfit, Playfair Display, Poppins) are loaded through `next/font/google` and are licensed under the SIL Open Font License 1.1 (or Apache-2.0 for some families). They are not committed to this repository.
