# Third-party notices

Second Look's own source is MIT licensed (see LICENSE). It uses the following open-source
components, all of which existed before this event. Each keeps its own licence.

| Component                                                     | Version                | Licence                  | Use                                                         |
| ------------------------------------------------------------- | ---------------------- | ------------------------ | ----------------------------------------------------------- |
| Preact                                                        | 11.1.1                 | MIT                      | Interface                                                   |
| Inter (`@fontsource-variable/inter`), Latin subset            | 5.3.0                  | SIL OFL 1.1              | Typeface, self-hosted                                       |
| tldts (with the Public Suffix List)                           | 7.4.19                 | MIT (list: MPL-2.0)      | Registrable-domain parsing                                  |
| Tesseract.js and tesseract.js-core                            | 7.0.0                  | Apache-2.0               | On-device text recognition, self-hosted                     |
| English Tesseract model (`@tesseract.js-data/eng`)            | 1.0.0 (data 4.0.0)     | Apache-2.0 (package MIT) | Text recognition model, self-hosted                         |
| jsQR                                                          | 1.4.0                  | Apache-2.0               | QR codes in images                                          |
| Workbox (precaching, routing, strategies, cacheable-response) | 7.4.1                  | MIT                      | Offline cache                                               |
| vite-plugin-pwa                                               | 2.0.0                  | MIT                      | Offline build                                               |
| Vite                                                          | 8.3.5                  | MIT                      | Build                                                       |
| Vitest                                                        | 5.0.5                  | MIT                      | Unit tests                                                  |
| Playwright Test                                               | 1.64.1                 | Apache-2.0               | End-to-end tests and screenshots                            |
| qrcode, sharp                                                 | 1.5.4, 0.35.5          | MIT, Apache-2.0          | Test image generation and icon rendering (development only) |
| Prettier, tsx, TypeScript                                     | 3.9.10, 4.23.15, 7.0.2 | MIT, MIT, Apache-2.0     | Development tools                                           |

## Data used only for local evaluation (not shipped)

- UCI SMS Spam Collection. Almeida, T. and Hidalgo, J. (2012). CC BY 4.0. DOI 10.24432/C5CC84.
- SMS Phishing Dataset for Machine Learning and Pattern Recognition. Mishra, S. and Soni, D. (2022).
  Mendeley Data, CC BY 4.0. DOI 10.17632/f45bkkt8pr.1. Changes made: rows already in the UCI
  collection were removed, and the labels were used as given.

Each package's licence text is in its folder under `node_modules` after `npm ci`.
